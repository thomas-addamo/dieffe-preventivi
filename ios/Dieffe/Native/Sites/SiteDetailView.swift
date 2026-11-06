import SwiftUI

/// Pagina del cantiere (come src/app/(app)/cantieri/[id]/CantiereClient.tsx):
/// fasi da spuntare, SAL e fatture, calendario con analisi del ritardo,
/// diario e consigli IA. "Concludi lavori" elimina il cantiere e i suoi dati;
/// i preventivi restano.
struct SiteDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let siteID: String
    var initialTab: String?

    enum Tab: String, CaseIterable {
        case avanzamento = "Fasi", sal = "SAL", calendario = "Calendario", note = "Note"
        init(param: String?) {
            switch param {
            case "sal": self = .sal
            case "calendario": self = .calendario
            case "note": self = .note
            default: self = .avanzamento
            }
        }
    }

    @State private var data: SiteDetail?
    @State private var error: String?
    @State private var tab: Tab = .avanzamento
    @State private var showSettings = false
    @State private var confirmComplete = false
    @State private var completing = false
    @State private var loadingInsights = false
    @State private var askedInsights = false
    /// Fogli e avvisi aperti dalle sezioni: stanno qui, non dentro la lista.
    @State private var sheet: SiteSheet?
    @State private var invoicing: SiteDetail.Milestone?
    @State private var invoiceNumber = ""

    private var canEdit: Bool { model.canEdit }

    var body: some View {
        Group {
            if let data {
                content(data)
            } else {
                LoadingOrError(error: error) { await load() }
            }
        }
        .navigationTitle(data.map { SiteText.title($0.site.name) } ?? "Cantiere")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            tab = Tab(param: initialTab)
            await load()
        }
        .task(id: data?.setupPending == true) {
            // L'IA sta ricavando fasi e SAL: si ricontrolla ogni pochi secondi.
            while data?.setupPending == true, !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4))
                await load()
            }
        }
        .refreshable { await load() }
    }

    // MARK: Contenuto

    @ViewBuilder
    private func content(_ d: SiteDetail) -> some View {
        List {
            HeaderSection(detail: d, openQuote: { model.openQuote($0) })

            if d.isPending {
                Section {
                    Label("Il preventivo è stato inviato ma non ancora accettato: fasi e SAL arrivano all'accettazione. Puoi già annotare sopralluoghi ed eventi.",
                          systemImage: "hourglass")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            } else {
                MetricsSection(detail: d)
            }

            Section {
                Picker("Sezione", selection: $tab) {
                    ForEach(Tab.allCases, id: \.self) { t in
                        if t == .sal, d.metrics.toInvoice > 0 {
                            Text("SAL •").tag(t)
                        } else {
                            Text(t.rawValue).tag(t)
                        }
                    }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            switch tab {
            case .avanzamento:
                SitePhasesSection(detail: d, canEdit: canEdit, onSettings: { showSettings = true },
                                  mutate: mutate, toggle: togglePhase, present: present)
            case .sal:
                SiteMilestonesSection(detail: d, canEdit: canEdit, mutate: mutate, present: present)
            case .calendario:
                SiteCalendarSection(detail: d, canEdit: canEdit, mutate: mutate, onSettings: { showSettings = true },
                                    present: present)
            case .note:
                SiteNotesSection(detail: d, canEdit: canEdit, loadingInsights: loadingInsights,
                                 refreshInsights: { Task { await loadInsights(force: true) } }, mutate: mutate)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu("Azioni", systemImage: "ellipsis") {
                    if let url = SiteLinks.directions(lat: d.site.lat, lng: d.site.lng, address: d.site.address) {
                        Link(destination: url) { Label("Indicazioni", systemImage: "car.fill") }
                    }
                    if canEdit {
                        Button("Tempi e costi", systemImage: "calendar.badge.clock") { showSettings = true }
                        if !d.isPending {
                            Divider()
                            Button("Concludi lavori", systemImage: "flag.checkered") { confirmComplete = true }
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            SiteSettingsSheet(detail: d) { body in await mutate("PATCH", "/api/sites/\(siteID)", body) }
        }
        .sheet(item: $sheet) { item in
            switch item {
            case .editPhase(let p):
                PhaseEditSheet(phase: p) { body in await mutate("PATCH", "/api/sites/\(siteID)/phases/\(p.id)", body) }
            case .addMilestone:
                MilestoneAddSheet(phases: d.phases) { body in await mutate("POST", "/api/sites/\(siteID)/milestones", body) }
            case .event(let draft):
                EventSheet(draft: draft) { body in
                    if let id = draft.id { return await mutate("PATCH", "/api/sites/\(siteID)/events/\(id)", body) }
                    return await mutate("POST", "/api/sites/\(siteID)/events", body)
                }
            case .invoice:
                EmptyView()
            }
        }
        .alert("Segna come fatturato", isPresented: Binding(get: { invoicing != nil }, set: { if !$0 { invoicing = nil } })) {
            TextField("Numero fattura (facoltativo)", text: $invoiceNumber)
            Button("Annulla", role: .cancel) { invoicing = nil }
            Button("Fatturato") {
                if let x = invoicing {
                    let n = invoiceNumber.trimmingCharacters(in: .whitespaces)
                    Task { await mutate("PATCH", "/api/sites/\(siteID)/milestones/\(x.id)", ["invoiced": true, "invoiceNumber": n.isEmpty ? nil : n]) }
                }
                invoicing = nil
            }
        } message: {
            if let x = invoicing { Text("\(x.label): \(Format.currency(x.value)) + IVA") }
        }
        .confirmationDialog("Concludere i lavori?", isPresented: $confirmComplete, titleVisibility: .visible) {
            Button("Concludi ed elimina cantiere", role: .destructive) { complete() }
        } message: {
            Text(completeMessage(d))
        }
        .overlay {
            if completing { ProgressView().controlSize(.large) }
        }
    }

    private func present(_ item: SiteSheet) {
        if case .invoice(let x) = item {
            invoiceNumber = ""
            invoicing = x
        } else {
            sheet = item
        }
    }

    private func completeMessage(_ d: SiteDetail) -> String {
        let open = d.milestones.filter { $0.invoicedAt == nil }
        var text = "Il cantiere viene chiuso ed eliminato con fasi, SAL, calendario e note, per tenere leggero il database. I preventivi restano."
        if !open.isEmpty {
            text += "\n\nAttenzione: \(open.count == 1 ? "1 SAL non è" : "\(open.count) SAL non sono") ancora fatturati (\(Format.currency(open.reduce(0) { $0 + $1.value })))."
        }
        return text
    }

    // MARK: Dati

    private func load() async {
        do {
            data = try await APIClient.shared.get("/api/sites/\(siteID)")
            error = nil
            if data?.insightsStale == true, !askedInsights {
                askedInsights = true
                await loadInsights(force: false)
            }
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch APIError.server(let message) where message.contains("non trovato") {
            // Cantiere concluso altrove: si torna all'elenco.
            model.sites.reset()
            dismiss()
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error.localizedDescription
        }
    }

    private func loadInsights(force: Bool) async {
        loadingInsights = true
        defer { loadingInsights = false }
        struct Response: Decodable { let insights: SiteInsights? }
        if let r: Response = try? await APIClient.shared.send("POST", "/api/sites/\(siteID)/insights", json: ["force": force]) {
            data?.site.aiInsights = r.insights
            data?.insightsStale = false
        }
    }

    /// Modifica sul server, poi ricarica (numeri e SAL li ricalcola il server).
    @discardableResult
    private func mutate(_ method: String, _ path: String, _ body: [String: Any?]) async -> Bool {
        do {
            if method == "DELETE" {
                try await APIClient.shared.delete(path)
            } else {
                try await APIClient.shared.send(method, path, json: body, as: Empty.self)
            }
            await load()
            model.sites.reset()
            return true
        } catch {
            model.lastError = error.localizedDescription
            return false
        }
    }

    /// Spunta immediata (l'interfaccia non aspetta la rete); con l'ultima fase
    /// completata propone di concludere i lavori.
    private func togglePhase(_ phase: SiteDetail.Phase) {
        guard canEdit, let index = data?.phases.firstIndex(where: { $0.id == phase.id }) else { return }
        let done = !phase.isDone
        data?.phases[index].doneAt = done ? ISO8601DateFormatter().string(from: .now) : nil
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        Task {
            struct Result: Decodable { let allDone: Bool? }
            do {
                let r: Result = try await APIClient.shared.send("PATCH", "/api/sites/\(siteID)/phases/\(phase.id)", json: ["done": done])
                await load()
                model.sites.reset()
                if done, r.allDone == true { confirmComplete = true }
            } catch {
                model.lastError = error.localizedDescription
                await load()
            }
        }
    }

    private func complete() {
        completing = true
        Task {
            defer { completing = false }
            do {
                try await APIClient.shared.send("POST", "/api/sites/\(siteID)/complete", as: Empty.self)
                model.sites.reset()
                model.dataChanged()
                dismiss()
            } catch {
                model.lastError = error.localizedDescription
            }
        }
    }
}

typealias SiteMutation = (_ method: String, _ path: String, _ body: [String: Any?]) async -> Bool

/// Fogli della pagina del cantiere.
enum SiteSheet: Identifiable {
    case editPhase(SiteDetail.Phase)
    case addMilestone
    case event(EventDraft)
    case invoice(SiteDetail.Milestone)

    var id: String {
        switch self {
        case .editPhase(let p): "phase-\(p.id)"
        case .addMilestone: "milestone"
        case .event(let d): "event-\(d.id ?? "new")"
        case .invoice(let m): "invoice-\(m.id)"
        }
    }
}

// MARK: Intestazione e numeri

private struct HeaderSection: View {
    let detail: SiteDetail
    let openQuote: (String) -> Void

    var body: some View {
        let s = detail.site
        Section {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text(SiteText.title(s.name))
                        .font(.title3.weight(.bold))
                    Spacer(minLength: 6)
                    HealthBadge(health: detail.metrics.health)
                }
                Label(s.address ?? "Indirizzo mancante", systemImage: "mappin.and.ellipse")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let client = detail.clientName {
                    Label(client, systemImage: "person.fill")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 8) {
                    action("Indicazioni", "car.fill", SiteLinks.directions(lat: s.lat, lng: s.lng, address: s.address))
                    action("Chiama", "phone.fill", detail.clientPhone.flatMap { URL(string: "tel:\($0.filter { !$0.isWhitespace })") })
                    action("Email", "envelope.fill", detail.clientEmail.flatMap { URL(string: "mailto:\($0)") })
                }
                .padding(.top, 4)
            }
            .padding(.vertical, 4)

            ForEach(detail.quotes) { q in
                Button { openQuote(q.id) } label: {
                    HStack {
                        Image(systemName: q.kind == "extra" ? "doc.badge.plus" : "doc.text")
                            .foregroundStyle(q.kind == "extra" ? .orange : Color.accentColor)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(q.code).font(.caption.monospaced().weight(.semibold)).foregroundStyle(Color.accentColor)
                            Text(q.title).font(.subheadline).lineLimit(1)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(Format.currency(q.net)).font(.subheadline.weight(.semibold)).monospacedDigit()
                            Text(q.kind == "extra" ? "extra" : q.status == "accepted" ? "accettato" : "inviato")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                .tint(.primary)
            }
        }
    }

    private func action(_ title: String, _ symbol: String, _ url: URL?) -> some View {
        Link(destination: url ?? URL(string: "about:blank")!) {
            VStack(spacing: 4) {
                Image(systemName: symbol).font(.system(size: 16, weight: .semibold))
                Text(title).font(.caption2.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .buttonStyle(.glass)
        .disabled(url == nil)
    }
}

private struct MetricsSection: View {
    let detail: SiteDetail

    var body: some View {
        let m = detail.metrics
        let s = detail.site
        Section {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Avanzamento").font(.subheadline).foregroundStyle(.secondary)
                    Spacer()
                    Text("\(Int(m.progress.rounded()))%").font(.title2.weight(.bold)).monospacedDigit()
                }
                SiteProgressBar(value: m.progress, expected: m.expectedProgress, health: m.health)
                Text(m.expectedProgress.map { "Atteso oggi \(Int($0.rounded()))%" } ?? "Imposta l'inizio lavori per il confronto")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
            LabeledContent("Imponibile lavori") {
                Text(Format.currency(m.contractNet)).monospacedDigit()
            }
            LabeledContent("Da fatturare") {
                Text(Format.currency(m.toInvoice)).monospacedDigit()
                    .foregroundStyle(m.toInvoice > 0 ? .orange : .secondary)
            }
            LabeledContent("Fine lavori") {
                if s.plannedEndDate == nil {
                    Text("Da fissare")
                } else if m.delayDays > 0 {
                    Text("\(SiteDate.short(m.forecastEnd)) (+\(m.delayDays) gg)").foregroundStyle(.red)
                } else {
                    Text(SiteDate.short(s.plannedEndDate))
                }
            }
        }
    }
}

// MARK: Fasi

private struct SitePhasesSection: View {
    let detail: SiteDetail
    let canEdit: Bool
    let onSettings: () -> Void
    let mutate: SiteMutation
    let toggle: (SiteDetail.Phase) -> Void
    let present: (SiteSheet) -> Void

    @State private var newTitle = ""

    var body: some View {
        let total = detail.phases.reduce(0) { $0 + $1.weight }
        let today = Calendar.current.startOfDay(for: .now)

        if detail.setupPending {
            Section {
                Label("L'IA sta ricavando fasi e SAL dal preventivo…", systemImage: "sparkles")
                    .foregroundStyle(Color.accentColor)
            }
        }
        if detail.site.startDate == nil, !detail.isPending, canEdit {
            Section {
                Button(action: onSettings) {
                    Label("Quando partono i lavori? Imposta le date", systemImage: "calendar.badge.plus")
                }
            } footer: {
                Text("Con la data di inizio le fasi si distribuiscono nel calendario e si misura il ritardo.")
            }
        }

        Section {
            ForEach(Array(detail.phases.enumerated()), id: \.element.id) { index, p in
                let late = !p.isDone && (SiteDate.date(p.plannedEnd).map { $0 < today } ?? false)
                HStack(alignment: .top, spacing: 12) {
                    Button { toggle(p) } label: {
                        Image(systemName: p.isDone ? "checkmark.circle.fill" : "circle")
                            .font(.title2)
                            .foregroundStyle(p.isDone ? .green : .secondary)
                            .contentTransition(.symbolEffect(.replace))
                    }
                    .buttonStyle(.plain)
                    .disabled(!canEdit)
                    .accessibilityLabel(p.isDone ? "Segna da fare" : "Segna completata")

                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(p.title)
                                .strikethrough(p.isDone, color: .secondary)
                                .foregroundStyle(p.isDone ? .secondary : .primary)
                            if late {
                                Text("in ritardo").font(.caption2.weight(.semibold)).foregroundStyle(.red)
                            }
                        }
                        Text(subtitle(p, total: total))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let note = p.note, !note.isEmpty {
                            Text(note).font(.caption).foregroundStyle(.primary.opacity(0.8))
                        }
                    }
                }
                .padding(.vertical, 2)
                .swipeActions(edge: .trailing) {
                    if canEdit {
                        Button(role: .destructive) {
                            Task { await mutate("DELETE", "/api/sites/\(detail.site.id)/phases/\(p.id)", [:]) }
                        } label: { Label("Elimina", systemImage: "trash") }
                    }
                }
                .contextMenu {
                    if canEdit {
                        Button("Modifica", systemImage: "pencil") { present(.editPhase(p)) }
                        if index > 0 {
                            Button("Sposta su", systemImage: "arrow.up") { move(p, -1) }
                        }
                        if index < detail.phases.count - 1 {
                            Button("Sposta giù", systemImage: "arrow.down") { move(p, 1) }
                        }
                    }
                }
            }
            if canEdit {
                HStack {
                    TextField("Nuova fase (es. Tetto)", text: $newTitle)
                        .submitLabel(.done)
                        .onSubmit(add)
                    Button("Aggiungi", systemImage: "plus.circle.fill", action: add)
                        .labelStyle(.iconOnly)
                        .font(.title3)
                        .disabled(newTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        } header: {
            Text(Format.count(detail.phases.count, "fase", "fasi"))
        } footer: {
            if !detail.phases.isEmpty {
                Text("Ogni fase pesa quanto il suo importo nel preventivo. Tieni premuto per modificarla o spostarla.")
            }
        }
    }

    private func subtitle(_ p: SiteDetail.Phase, total: Double) -> String {
        var parts: [String] = []
        parts.append(p.plannedStart != nil ? "\(SiteDate.short(p.plannedStart)) → \(SiteDate.short(p.plannedEnd))" : "Date da fissare")
        if let d = p.durationDays { parts.append("\(d) gg lav.") }
        if p.weight > 0 {
            parts.append("\(Format.currency(p.weight)) (\(total > 0 ? Int((p.weight / total * 100).rounded()) : 0)%)")
        }
        if p.isDone { parts.append("fatta il \(SiteDate.short(p.doneAt))") }
        return parts.joined(separator: " · ")
    }

    private func add() {
        let title = newTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }
        newTitle = ""
        Task { await mutate("POST", "/api/sites/\(detail.site.id)/phases", ["title": title]) }
    }

    private func move(_ p: SiteDetail.Phase, _ direction: Int) {
        Task { await mutate("PATCH", "/api/sites/\(detail.site.id)/phases/\(p.id)", ["move": direction]) }
    }
}

struct PhaseEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    let phase: SiteDetail.Phase
    let save: ([String: Any?]) async -> Bool

    @State private var title = ""
    @State private var note = ""
    @State private var days = 1
    @State private var weight = ""
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Fase") {
                    TextField("Titolo", text: $title)
                    Stepper("Durata: \(days) gg lavorativi", value: $days, in: 1...365)
                    LabeledContent("Peso (€)") {
                        TextField("0", text: $weight).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                }
                Section {
                    TextField("Ditta, materiali, problemi…", text: $note, axis: .vertical).lineLimit(3...8)
                } header: {
                    Text("Nota")
                } footer: {
                    Text("Il peso è l'importo delle lavorazioni: decide quanto la fase conta nell'avanzamento.")
                }
            }
            .navigationTitle("Modifica fase")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") {
                        saving = true
                        Task {
                            let w = Double(weight.replacingOccurrences(of: ",", with: ".")) ?? phase.weight
                            let ok = await save([
                                "title": title.trimmingCharacters(in: .whitespaces).isEmpty ? phase.title : title,
                                "note": note.isEmpty ? nil : note,
                                "durationDays": days,
                                "weight": w,
                            ])
                            saving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(saving)
                }
            }
            .onAppear {
                title = phase.title
                note = phase.note ?? ""
                days = phase.durationDays ?? 1
                weight = phase.weight > 0 ? String(format: "%.2f", phase.weight).replacingOccurrences(of: ".", with: ",") : ""
            }
        }
        .presentationDetents([.medium, .large])
    }
}

extension SiteDetail.Phase: Hashable {
    static func == (a: Self, b: Self) -> Bool { a.id == b.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: Tempi e costi

private struct SiteSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    let detail: SiteDetail
    let save: ([String: Any?]) async -> Bool

    @State private var hasStart = false
    @State private var start = Date.now
    @State private var hasEnd = false
    @State private var end = Date.now
    @State private var dailyCost = ""
    @State private var penalty = ""
    @State private var margin = ""
    @State private var saving = false

    private var totalDays: Int { detail.phases.reduce(0) { $0 + ($1.durationDays ?? 1) } }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Inizio lavori", isOn: $hasStart.animation())
                    if hasStart {
                        DatePicker("Dal", selection: $start, displayedComponents: .date)
                    }
                    Toggle("Fine prevista", isOn: $hasEnd.animation())
                    if hasEnd {
                        DatePicker("Entro", selection: $end, in: (hasStart ? start : .distantPast)..., displayedComponents: .date)
                    }
                } header: {
                    Text("Date")
                } footer: {
                    if hasStart, !hasEnd, totalDays > 0 {
                        Text("Senza fine prevista la propone il programma delle fasi (\(totalDays) giorni lavorativi).")
                    }
                }
                Section {
                    money("Costo al giorno", $dailyCost, placeholder: "es. 380")
                    money("Penale al giorno", $penalty, placeholder: "0")
                    LabeledContent("Margine atteso (%)") {
                        TextField("20", text: $margin).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                } header: {
                    Text("Costi")
                } footer: {
                    Text("Costo al giorno = squadra in cantiere + noli (ponteggio, attrezzature) + suolo pubblico. Servono per calcolare quanto costa un ritardo.")
                }
            }
            .navigationTitle("Tempi e costi")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva", action: submit).disabled(saving)
                }
            }
            .onAppear(perform: fill)
        }
    }

    private func money(_ label: String, _ value: Binding<String>, placeholder: String) -> some View {
        LabeledContent("\(label) (€)") {
            TextField(placeholder, text: value).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
        }
    }

    private func fill() {
        let s = detail.site
        if let d = SiteDate.date(s.startDate) { hasStart = true; start = d }
        if let d = SiteDate.date(s.plannedEndDate) { hasEnd = true; end = d }
        dailyCost = s.dailyCost.map { String(Int($0.rounded())) } ?? ""
        penalty = s.penaltyPerDay.map { String(Int($0.rounded())) } ?? ""
        margin = String(Int(s.marginPct.rounded()))
    }

    private func number(_ s: String) -> Double? {
        let t = s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        return t.isEmpty ? nil : Double(t)
    }

    private func submit() {
        saving = true
        var body: [String: Any?] = [
            "startDate": hasStart ? SiteDate.string(start) : nil,
            "dailyCost": number(dailyCost),
            "penaltyPerDay": number(penalty),
            "marginPct": number(margin) ?? 20,
        ]
        // Inizio senza fine: la propone il programma delle fasi.
        if hasEnd { body["plannedEndDate"] = SiteDate.string(end) } else if !hasStart { body["plannedEndDate"] = .some(nil) }
        Task {
            let ok = await save(body)
            saving = false
            if ok { dismiss() }
        }
    }
}
