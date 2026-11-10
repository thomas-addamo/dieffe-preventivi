import SwiftUI

/// Pagina del cantiere (come src/app/(app)/cantieri/[id]/CantiereClient.tsx):
/// fasi da spuntare, SAL e fatture, calendario con analisi del ritardo,
/// diario e consigli IA, foto. "Concludi lavori" sposta il cantiere in
/// archivio: si consulta in sola lettura, si riapre o (admin) si elimina.
struct SiteDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let siteID: String
    var initialTab: String?

    enum Tab: String, CaseIterable {
        case avanzamento = "Fasi", sal = "SAL", calendario = "Calendario", note = "Note", foto = "Foto"
        init(param: String?) {
            switch param {
            case "sal": self = .sal
            case "calendario": self = .calendario
            case "note": self = .note
            case "foto": self = .foto
            default: self = .avanzamento
            }
        }

        var symbol: String {
            switch self {
            case .avanzamento: "checklist"
            case .sal: "eurosign.circle"
            case .calendario: "calendar"
            case .note: "note.text"
            case .foto: "photo.on.rectangle"
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
    @State private var confirmPurge = false
    @State private var busy = false
    @State private var editMode: EditMode = .inactive
    @State private var uploader = SitePhotoUploader()
    @State private var viewer: PhotoViewerItem?
    @State private var camera: CameraRequest?
    @State private var confirmDeletePhoto: SiteDetail.Photo?

    private var canEdit: Bool { model.canEdit }
    private var isAdmin: Bool { model.currentUser?.role == "admin" }
    private var me: String? { model.currentUser?.id }
    /// Si modifica solo un cantiere in corso: quelli in archivio si consultano.
    private var editable: Bool { canEdit && data?.isArchived != true }

    /// Note e foto: le elimina (e le note le modifica) chi le ha scritte o un admin.
    private func owns(_ userId: String?) -> Bool { isAdmin || (userId != nil && userId == me) }

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
        .task(id: data?.setupPending == true && data?.isArchived != true) {
            // L'IA sta ricavando fasi e SAL: si ricontrolla ogni pochi secondi.
            while data?.setupPending == true, data?.isArchived != true, !Task.isCancelled {
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
            if d.isArchived {
                ArchivedBanner(detail: d, canReopen: canEdit && d.archiveReason == .completed, canPurge: isAdmin,
                               busy: busy, reopen: reopen, purge: { confirmPurge = true })
            }

            HeaderSection(detail: d, openQuote: { model.openQuote($0) })

            if d.isPending, !d.isArchived {
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
                SiteFilterBar(selection: $tab, items: Tab.allCases.map { t in
                    .init(value: t, title: t == .sal && d.metrics.toInvoice > 0 ? "SAL •" : t.rawValue,
                          count: t == .foto ? (d.allPhotos.isEmpty ? nil : d.allPhotos.count) : nil, symbol: t.symbol)
                })
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            switch tab {
            case .avanzamento:
                SitePhasesSection(detail: d, canEdit: editable, onSettings: { showSettings = true },
                                  mutate: mutate, toggle: togglePhase, present: present, reorder: movePhase,
                                  editMode: $editMode)
            case .sal:
                SiteMilestonesSection(detail: d, canEdit: editable, mutate: mutate, present: present)
            case .calendario:
                SiteCalendarSection(detail: d, canEdit: editable, mutate: mutate, onSettings: { showSettings = true },
                                    present: present)
            case .note:
                SiteNotesSection(detail: d, canEdit: editable, loadingInsights: loadingInsights,
                                 refreshInsights: { Task { await loadInsights(force: true) } },
                                 canManage: { editable && owns($0.userId) },
                                 add: addNote, edit: { present(.editNote($0)) }, delete: deleteNote)
            case .foto:
                SitePhotosSection(detail: d, editable: editable, uploader: uploader,
                                  canDelete: { editable && owns($0.userId) },
                                  upload: uploadPhotos, openCamera: { camera = CameraRequest(phaseID: $0) },
                                  open: { viewer = PhotoViewerItem(id: $0.id, photos: $1) },
                                  edit: { present(.editPhoto($0)) },
                                  delete: { confirmDeletePhoto = $0 })
            }
        }
        .environment(\.editMode, $editMode)
        .onChange(of: tab) { editMode = .inactive }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu("Azioni", systemImage: "ellipsis") {
                    if let url = SiteLinks.directions(lat: d.site.lat, lng: d.site.lng, address: d.site.address) {
                        Link(destination: url) { Label("Indicazioni", systemImage: "car.fill") }
                    }
                    if d.isArchived {
                        if canEdit, d.archiveReason == .completed {
                            Button("Riapri cantiere", systemImage: "arrow.uturn.backward", action: reopen)
                        }
                        if isAdmin {
                            Divider()
                            Button("Elimina definitivamente", systemImage: "trash", role: .destructive) { confirmPurge = true }
                        }
                    } else if canEdit {
                        Button("Tempi e costi", systemImage: "calendar.badge.clock") { showSettings = true }
                        if !d.isPending {
                            Divider()
                            Button("Concludi lavori", systemImage: "flag.checkered") { confirmComplete = true }
                        }
                    }
                }
                .disabled(busy)
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
            case .editNote(let n):
                NoteEditSheet(note: n) { body in await editNote(n, body) }
            case .editPhoto(let p):
                PhotoEditSheet(photo: p, phases: d.phases) { await savePhoto($0) }
            case .invoice:
                EmptyView()
            }
        }
        .fullScreenCover(item: $viewer) { item in
            SitePhotoViewer(item: item, phases: d.phases, editable: editable,
                            canDelete: { editable && owns($0.userId) },
                            save: savePhoto, delete: deletePhoto)
        }
        .fullScreenCover(item: $camera) { request in
            CameraPicker { image in uploadPhotos([.camera(image)], request.phaseID) }
                .ignoresSafeArea()
        }
        .confirmationDialog("Eliminare la foto?", isPresented: Binding(get: { confirmDeletePhoto != nil },
                                                                      set: { if !$0 { confirmDeletePhoto = nil } }),
                            titleVisibility: .visible, presenting: confirmDeletePhoto) { p in
            Button("Elimina foto", role: .destructive) { Task { await deletePhoto(p) } }
        } message: { _ in
            Text("La foto viene cancellata per tutti e non si può recuperare.")
        }
        .confirmationDialog("Eliminare definitivamente il cantiere?", isPresented: $confirmPurge, titleVisibility: .visible) {
            Button("Elimina definitivamente", role: .destructive, action: purge)
        } message: {
            Text("«\(SiteText.title(d.site.name))»: fasi, SAL, calendario, diario e foto non si potranno recuperare. I preventivi restano.")
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
            Button("Concludi e archivia") { complete() }
            Button("Non ancora", role: .cancel) {}
        } message: {
            Text(completeMessage(d))
        }
        .overlay {
            if completing || busy { ProgressView().controlSize(.large) }
        }
        .sensoryFeedback(.success, trigger: d.isArchived)
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
        var text = "Il cantiere va in archivio con fasi, SAL, calendario, diario e foto: si consulta quando serve e si può riaprire. I preventivi vengono segnati \"lavori conclusi\"."
        if !open.isEmpty {
            text += "\n\nAttenzione: \(open.count == 1 ? "1 SAL non è" : "\(open.count) SAL non sono") ancora fatturati (\(Format.currency(open.reduce(0) { $0 + $1.value }))). In archivio non arrivano più i promemoria."
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
            await fail(error)
            return false
        }
    }

    /// Errore di una modifica. 409 `{ archived: true }`: il cantiere è stato
    /// archiviato nel frattempo (da un altro dispositivo o dal promemoria
    /// automatico): si ricarica e compare il riquadro dell'archivio.
    private func fail(_ error: Error) async {
        model.lastError = error.localizedDescription
        if case APIError.server(let message) = error, message.localizedCaseInsensitiveContains("archivio") {
            model.sites.reset()
        }
        await load()
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
                await fail(error)
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
                // Resta sulla pagina: compare il riquadro dell'archivio con "Riapri".
                await load()
            } catch {
                await fail(error)
            }
        }
    }

    // MARK: Archivio

    private func reopen() {
        busy = true
        Task {
            defer { busy = false }
            do {
                try await APIClient.shared.send("POST", "/api/sites/\(siteID)/reopen", as: Empty.self)
                model.sites.reset()
                model.dataChanged()
                await load()
            } catch {
                // 409: archiviato per preventivo ritirato, si riapre da solo.
                model.lastError = error.localizedDescription
            }
        }
    }

    private func purge() {
        busy = true
        Task {
            defer { busy = false }
            do {
                try await APIClient.shared.delete("/api/sites/\(siteID)")
                model.sites.reset()
                model.dataChanged()
                dismiss()
            } catch {
                model.lastError = error.localizedDescription
            }
        }
    }

    // MARK: Fasi

    /// Trascinamento nativo: `onMove` dà la destinazione prima della rimozione,
    /// il server vuole la posizione finale (`toIndex`).
    private func movePhase(_ from: IndexSet, _ to: Int) {
        guard editable, let source = from.first, let phase = data?.phases[source] else { return }
        let target = to > source ? to - 1 : to
        guard target != source else { return }
        data?.phases.move(fromOffsets: from, toOffset: to)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        Task { await mutate("PATCH", "/api/sites/\(siteID)/phases/\(phase.id)", ["toIndex": target]) }
    }

    // MARK: Note

    /// La nota compare subito (in cima, come sul sito), poi si ricarica.
    private func addNote(_ body: String) {
        let note = SiteDetail.Note(id: "tmp-\(UUID().uuidString)", body: body, createdAt: ISO8601DateFormatter().string(from: .now),
                                   updatedAt: nil, userId: me, userName: model.currentUser?.name)
        withAnimation { data?.notes.insert(note, at: 0) }
        Task { await mutate("POST", "/api/sites/\(siteID)/notes", ["body": body]) }
    }

    private func editNote(_ note: SiteDetail.Note, _ body: String) async -> Bool {
        if let i = data?.notes.firstIndex(where: { $0.id == note.id }) {
            data?.notes[i].body = body
            data?.notes[i].updatedAt = ISO8601DateFormatter().string(from: .now)
        }
        return await mutate("PATCH", "/api/sites/\(siteID)/notes/\(note.id)", ["body": body])
    }

    private func deleteNote(_ note: SiteDetail.Note) {
        withAnimation { data?.notes.removeAll { $0.id == note.id } }
        Task { await mutate("DELETE", "/api/sites/\(siteID)/notes/\(note.id)", [:]) }
    }

    // MARK: Foto

    private func uploadPhotos(_ sources: [SitePhotoUploader.Source], _ phaseID: String?) {
        Task {
            let result = await uploader.upload(sources, siteID: siteID, phaseID: phaseID)
            await load()
            if result.failed > 0 {
                let what = result.failed == 1 ? "Una foto non è stata caricata" : "\(result.failed) foto non sono state caricate"
                model.lastError = [what, result.error].compactMap { $0 }.joined(separator: ": ")
                if let e = result.error, e.localizedCaseInsensitiveContains("archivio") { model.sites.reset() }
            } else {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        }
    }

    private func savePhoto(_ photo: SiteDetail.Photo) async -> Bool {
        if let i = data?.photos?.firstIndex(where: { $0.id == photo.id }) { data?.photos?[i] = photo }
        do {
            try await APIClient.shared.send("PATCH", "/api/sites/\(siteID)/photos/\(photo.id)",
                                            json: ["caption": photo.caption, "phaseId": photo.phaseId], as: Empty.self)
            return true
        } catch {
            await fail(error)
            return false
        }
    }

    private func deletePhoto(_ photo: SiteDetail.Photo) async -> Bool {
        withAnimation { data?.photos?.removeAll { $0.id == photo.id } }
        do {
            try await APIClient.shared.delete("/api/sites/\(siteID)/photos/\(photo.id)")
            return true
        } catch {
            await fail(error)
            return false
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
    case editNote(SiteDetail.Note)
    case editPhoto(SiteDetail.Photo)

    var id: String {
        switch self {
        case .editPhase(let p): "phase-\(p.id)"
        case .addMilestone: "milestone"
        case .event(let d): "event-\(d.id ?? "new")"
        case .invoice(let m): "invoice-\(m.id)"
        case .editNote(let n): "note-\(n.id)"
        case .editPhoto(let p): "photo-\(p.id)"
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
                    if let reason = detail.archiveReason {
                        Label("Archivio", systemImage: "archivebox.fill")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .foregroundStyle(reason.color)
                            .background(reason.color.opacity(0.14), in: Capsule())
                    } else {
                        HealthBadge(health: detail.metrics.health)
                    }
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
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.vertical, 4)
        }
        .buttonStyle(.glass)
        .disabled(url == nil)
        .accessibilityLabel(title)
    }
}

/// Riquadro in cima a un cantiere in archivio (come sul sito).
private struct ArchivedBanner: View {
    let detail: SiteDetail
    let canReopen: Bool
    let canPurge: Bool
    let busy: Bool
    let reopen: () -> Void
    let purge: () -> Void

    var body: some View {
        let reason = detail.archiveReason ?? .completed
        Section {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "archivebox.fill")
                        .font(.title2)
                        .foregroundStyle(.purple)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(reason == .completed ? "Lavori conclusi il \(SiteDate.long(detail.site.archivedAt))" : "In archivio")
                            .font(.headline)
                        Text(reason == .completed
                             ? "Il cantiere è in archivio e si consulta in sola lettura."
                             : "Il preventivo principale non è più inviato o accettato (bozza, rifiutato o cestinato). Torna in corso da solo, con tutti i suoi dati, quando il preventivo torna inviato o accettato.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .accessibilityElement(children: .combine)
                if canReopen || canPurge {
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 8) { buttons }
                        VStack(spacing: 8) { buttons }
                    }
                    .disabled(busy)
                }
            }
            .padding(.vertical, 6)
        }
        .listRowBackground(Color.purple.opacity(0.08))
    }

    @ViewBuilder private var buttons: some View {
        if canReopen {
            Button(action: reopen) {
                Label("Riapri cantiere", systemImage: "arrow.uturn.backward")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.glassProminent)
            .tint(.purple)
        }
        if canPurge {
            Button(role: .destructive, action: purge) {
                Label("Elimina definitivamente", systemImage: "trash")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.glass)
            .tint(.red)
        }
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
    let reorder: (IndexSet, Int) -> Void
    @Binding var editMode: EditMode

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
                    .frame(minWidth: 44, minHeight: 44, alignment: .topLeading)
                    .contentShape(Rectangle())
                    .disabled(!canEdit || editMode.isEditing)
                    .accessibilityLabel(p.isDone ? "\(p.title), completata" : "\(p.title), da fare")
                    .accessibilityHint(canEdit ? (p.isDone ? "Tocca per segnarla da fare" : "Tocca per segnarla completata") : "")

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
                        Button { present(.editPhase(p)) } label: { Label("Modifica", systemImage: "pencil") }
                            .tint(.blue)
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
            .onMove(perform: canEdit ? reorder : nil)
            if canEdit, !editMode.isEditing {
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
            HStack {
                Text(Format.count(detail.phases.count, "fase", "fasi"))
                Spacer()
                if canEdit, detail.phases.count > 1 {
                    Button(editMode.isEditing ? "Fine" : "Riordina") {
                        withAnimation { editMode = editMode.isEditing ? .inactive : .active }
                    }
                    .font(.subheadline.weight(.semibold))
                    .textCase(nil)
                    .frame(minHeight: 44)
                }
            }
        } footer: {
            if !detail.phases.isEmpty {
                Text(editMode.isEditing
                     ? "Trascina le fasi nell'ordine dei lavori: le date si ricalcolano da sole."
                     : "Ogni fase pesa quanto il suo importo nel preventivo. Scorri o tieni premuto per modificarla; Riordina per spostarle.")
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
