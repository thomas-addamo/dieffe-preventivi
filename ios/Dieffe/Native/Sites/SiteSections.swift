import Charts
import SwiftUI

// Sezioni della pagina del cantiere: SAL e fatture, calendario con analisi
// del ritardo, note e consigli IA (come le schede del sito).

// MARK: SAL e fatture

struct SiteMilestonesSection: View {
    let detail: SiteDetail
    let canEdit: Bool
    let mutate: SiteMutation
    let present: (SiteSheet) -> Void

    var body: some View {
        let m = detail.metrics
        let vat = Dictionary(uniqueKeysWithValues: detail.quotes.map { ($0.id, $0.vatRate) })
        let phaseTitle = Dictionary(uniqueKeysWithValues: detail.phases.map { ($0.id, $0.title) })

        Section {
            LabeledContent("Totale SAL") { Text(Format.currency(m.milestonesTotal)).monospacedDigit() }
            LabeledContent("Da fatturare") {
                Text(Format.currency(m.toInvoice)).monospacedDigit().foregroundStyle(m.toInvoice > 0 ? .orange : .secondary)
            }
            LabeledContent("Fatturato") { Text(Format.currency(m.invoiced)).monospacedDigit() }
            LabeledContent("Da incassare") {
                Text(Format.currency(m.toCollect)).monospacedDigit().foregroundStyle(m.toCollect > 0 ? .orange : .secondary)
            }
            if m.milestonesTotal > 0 {
                SiteProgressBar(value: m.invoiced / m.milestonesTotal * 100, health: .on_track)
            }
        }

        Section {
            if detail.milestones.isEmpty {
                Text("Nessun SAL. L'IA li ricava dalle condizioni di pagamento del preventivo; puoi aggiungerli anche a mano.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            ForEach(detail.milestones) { x in
                let rate = x.quoteId.flatMap { vat[$0] } ?? 22
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top) {
                        Image(systemName: x.reachedAt != nil ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(x.reachedAt != nil ? .green : .secondary)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 4) {
                                Text(x.label).font(.body.weight(.semibold))
                                if let p = x.percent, x.amount == nil {
                                    Text("\(p.formatted())%").foregroundStyle(.secondary)
                                }
                            }
                            Text(SiteText.triggerLabel(x.trigger, phase: x.phaseId.flatMap { phaseTitle[$0] })
                                 + " · " + (x.reachedAt != nil ? "raggiunto il \(SiteDate.short(x.reachedAt))" : "non ancora raggiunto"))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(Format.currency(x.value)).font(.subheadline.weight(.semibold)).monospacedDigit()
                            Text("\(Format.currency(x.value * (1 + rate / 100))) con IVA")
                                .font(.caption2).foregroundStyle(.secondary).monospacedDigit()
                        }
                    }
                    HStack(spacing: 8) {
                        toggle("Fatturato", on: x.invoicedAt != nil, attention: x.reachedAt != nil && x.invoicedAt == nil) {
                            if x.invoicedAt == nil {
                                present(.invoice(x))
                            } else {
                                patch(x, ["invoiced": false])
                            }
                        }
                        toggle("Incassato", on: x.paidAt != nil, attention: false) {
                            patch(x, ["paid": x.paidAt == nil])
                        }
                        if let n = x.invoiceNumber, x.invoicedAt != nil {
                            Text("Fatt. \(n)").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if x.trigger == "manual", x.invoicedAt == nil, canEdit {
                            Button(x.reachedAt == nil ? "Segna raggiunto" : "Annulla") {
                                patch(x, ["reached": x.reachedAt == nil])
                            }
                            .font(.caption.weight(.semibold))
                            .buttonStyle(.borderless)
                        }
                    }
                }
                .padding(.vertical, 4)
                .swipeActions(edge: .trailing) {
                    if canEdit {
                        Button(role: .destructive) {
                            Task { await mutate("DELETE", "/api/sites/\(detail.site.id)/milestones/\(x.id)", [:]) }
                        } label: { Label("Elimina", systemImage: "trash") }
                    }
                }
            }
            if canEdit {
                Button("Aggiungi SAL", systemImage: "plus.circle") { present(.addMilestone) }
            }
        } header: {
            Text("Stati di avanzamento")
        }
    }

    private func patch(_ x: SiteDetail.Milestone, _ body: [String: Any?]) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        Task { await mutate("PATCH", "/api/sites/\(detail.site.id)/milestones/\(x.id)", body) }
    }

    private func toggle(_ title: String, on: Bool, attention: Bool, action: @escaping () -> Void) -> some View {
        let color: Color = on ? .green : attention ? .orange : .secondary
        return Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: on ? "checkmark.circle.fill" : "circle")
                Text(title)
            }
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .foregroundStyle(color)
            .background(color.opacity(on || attention ? 0.14 : 0.08), in: Capsule())
        }
        .buttonStyle(.borderless)
        .disabled(!canEdit)
    }
}

struct MilestoneAddSheet: View {
    @Environment(\.dismiss) private var dismiss
    let phases: [SiteDetail.Phase]
    let save: ([String: Any?]) async -> Bool

    @State private var label = ""
    @State private var usePercent = true
    @State private var value = ""
    @State private var when = "manual"

    var body: some View {
        NavigationStack {
            Form {
                TextField("Descrizione (es. Fine impianti)", text: $label)
                Picker("Importo", selection: $usePercent) {
                    Text("Percentuale").tag(true)
                    Text("Importo fisso").tag(false)
                }
                .pickerStyle(.segmented)
                LabeledContent(usePercent ? "Percentuale (%)" : "Importo (€)") {
                    TextField("0", text: $value).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                }
                Picker("Quando scatta", selection: $when) {
                    Text("Lo segno io").tag("manual")
                    Text("A fine lavori").tag("end")
                    ForEach(phases) { p in Text("A fine «\(p.title)»").tag(p.id) }
                }
            }
            .navigationTitle("Nuovo SAL")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Aggiungi") {
                        let n = Double(value.replacingOccurrences(of: ",", with: "."))
                        var body: [String: Any?] = ["label": label.trimmingCharacters(in: .whitespaces),
                                                    "percent": usePercent ? n : nil,
                                                    "amount": usePercent ? nil : n]
                        switch when {
                        case "manual", "end": body["trigger"] = when
                        default: body["trigger"] = "phase"; body["phaseId"] = when
                        }
                        Task { if await save(body) { dismiss() } }
                    }
                    .disabled(label.trimmingCharacters(in: .whitespaces).isEmpty || Double(value.replacingOccurrences(of: ",", with: ".")) == nil)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: Calendario e analisi

struct SiteCalendarSection: View {
    let detail: SiteDetail
    let canEdit: Bool
    let mutate: SiteMutation
    let onSettings: () -> Void
    let present: (SiteSheet) -> Void

    @State private var month = Calendar.current.dateInterval(of: .month, for: .now)?.start ?? .now

    var body: some View {
        Section {
            MonthGrid(detail: detail, month: $month) { day in
                if canEdit { present(.event(EventDraft(date: day))) }
            }
            .listRowInsets(EdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10))
        }

        Section {
            if detail.events.isEmpty {
                Text("Nessun evento. Esempi: occupazione del suolo pubblico, intervento dell'idraulico, consegna materiali.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            ForEach(detail.events) { e in
                let type = SiteEventType(raw: e.type)
                Button {
                    if canEdit { present(.event(EventDraft(e))) }
                } label: {
                    EventRow(type: type, title: e.title,
                             subtitle: [SiteDate.short(e.date) + (e.endDate.map { " → \(SiteDate.short($0))" } ?? ""),
                                        type.label, e.notes].compactMap { $0 }.joined(separator: " · "))
                }
                .tint(.primary)
                .swipeActions(edge: .trailing) {
                    if canEdit {
                        Button(role: .destructive) {
                            Task { await mutate("DELETE", "/api/sites/\(detail.site.id)/events/\(e.id)", [:]) }
                        } label: { Label("Elimina", systemImage: "trash") }
                    }
                }
            }
            if canEdit {
                Button("Nuovo evento", systemImage: "plus.circle") { present(.event(EventDraft(date: .now))) }
            }
        } header: {
            Text("Eventi e scadenze")
        }

        DelayAnalysisSection(detail: detail, canEdit: canEdit, onSettings: onSettings)
    }
}

struct EventDraft: Identifiable {
    var id: String?
    var date: Date
    var hasEnd = false
    var endDate: Date
    var type: SiteEventType = .intervento
    var title = ""
    var notes = ""

    init(date: Date) {
        self.date = date
        self.endDate = date
    }

    init(_ e: SiteDetail.Event) {
        id = e.id
        date = SiteDate.date(e.date) ?? .now
        hasEnd = e.endDate != nil
        endDate = SiteDate.date(e.endDate) ?? date
        type = SiteEventType(raw: e.type)
        title = e.title
        notes = e.notes ?? ""
    }
}

struct EventSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State var draft: EventDraft
    let save: ([String: Any?]) async -> Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                        ForEach(SiteEventType.allCases) { t in
                            Button {
                                draft.type = t
                            } label: {
                                VStack(spacing: 4) {
                                    Image(systemName: t.symbol)
                                    Text(t.label).font(.caption2).lineLimit(2).multilineTextAlignment(.center)
                                }
                                .frame(maxWidth: .infinity, minHeight: 52)
                                .foregroundStyle(draft.type == t ? .white : t.color)
                                .background(draft.type == t ? AnyShapeStyle(t.color.gradient) : AnyShapeStyle(t.color.opacity(0.12)),
                                            in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10))
                }
                Section {
                    TextField(draft.type.placeholder, text: $draft.title)
                    DatePicker("Dal", selection: $draft.date, displayedComponents: .date)
                    Toggle("Più giorni", isOn: $draft.hasEnd.animation())
                    if draft.hasEnd {
                        DatePicker("Al", selection: $draft.endDate, in: draft.date..., displayedComponents: .date)
                    }
                    TextField("Note (protocollo, ditta, contatto…)", text: $draft.notes, axis: .vertical).lineLimit(2...5)
                }
            }
            .navigationTitle(draft.id == nil ? "Nuovo evento" : "Modifica evento")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") {
                        let body: [String: Any?] = [
                            "date": SiteDate.string(draft.date),
                            "endDate": draft.hasEnd ? SiteDate.string(max(draft.endDate, draft.date)) : nil,
                            "type": draft.type.rawValue,
                            "title": draft.title.trimmingCharacters(in: .whitespaces),
                            "notes": draft.notes.isEmpty ? nil : draft.notes,
                        ]
                        Task { if await save(body) { dismiss() } }
                    }
                    .disabled(draft.title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.large])
    }
}

/// Mini calendario del mese: eventi (pallini colorati), fasi previste
/// (barra sotto il giorno), inizio e fine lavori. Tocca un giorno per un evento.
private struct MonthGrid: View {
    let detail: SiteDetail
    @Binding var month: Date
    let onDay: (Date) -> Void

    private let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        c.locale = Locale(identifier: "it_IT")
        return c
    }()

    var body: some View {
        let days = gridDays()
        let today = cal.startOfDay(for: .now)
        VStack(spacing: 8) {
            HStack {
                Text(month.formatted(.dateTime.month(.wide).year().locale(Locale(identifier: "it_IT"))).capitalized)
                    .font(.headline)
                Spacer()
                Button("Oggi") { month = cal.dateInterval(of: .month, for: .now)?.start ?? .now }
                    .font(.subheadline)
                Button { shift(-1) } label: { Image(systemName: "chevron.left") }
                    .padding(.horizontal, 6)
                Button { shift(1) } label: { Image(systemName: "chevron.right") }
            }
            .buttonStyle(.borderless)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 4) {
                ForEach(["L", "M", "M", "G", "V", "S", "D"].indices, id: \.self) { i in
                    Text(["L", "M", "M", "G", "V", "S", "D"][i])
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                ForEach(days, id: \.self) { day in
                    DayCell(day: day,
                            number: cal.component(.day, from: day),
                            isToday: day == today,
                            inMonth: cal.isDate(day, equalTo: month, toGranularity: .month),
                            marker: marker(day),
                            eventColors: eventsOn(day).prefix(3).map { SiteEventType(raw: $0.type).color },
                            phase: phaseOn(day)) { onDay(day) }
                }
            }

            HStack(spacing: 12) {
                legend(Color.blue.opacity(0.25), "Inizio")
                legend(Color.purple.opacity(0.25), "Fine prevista")
                if detail.metrics.delayDays > 0 { legend(Color.red.opacity(0.25), "Fine stimata") }
                Spacer()
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
    }

    private func legend(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 4) { Circle().fill(color).frame(width: 8, height: 8); Text(text) }
    }

    private func shift(_ n: Int) {
        if let d = cal.date(byAdding: .month, value: n, to: month) { month = d }
    }

    private func gridDays() -> [Date] {
        guard let interval = cal.dateInterval(of: .month, for: month),
              let firstWeek = cal.dateInterval(of: .weekOfMonth, for: interval.start) else { return [] }
        let lastDay = cal.date(byAdding: .day, value: -1, to: interval.end) ?? interval.end
        let lastWeek = cal.dateInterval(of: .weekOfMonth, for: lastDay)?.end ?? interval.end
        var days: [Date] = []
        var d = firstWeek.start
        while d < lastWeek {
            days.append(cal.startOfDay(for: d))
            d = cal.date(byAdding: .day, value: 1, to: d) ?? lastWeek
        }
        return days
    }

    private func eventsOn(_ day: Date) -> [SiteDetail.Event] {
        detail.events.filter {
            guard let s = SiteDate.date($0.date) else { return false }
            let e = SiteDate.date($0.endDate) ?? s
            return day >= cal.startOfDay(for: s) && day <= cal.startOfDay(for: e)
        }
    }

    private func phaseOn(_ day: Date) -> SiteDetail.Phase? {
        let weekday = cal.component(.weekday, from: day)
        guard weekday != 1, weekday != 7 else { return nil }
        return detail.phases.first {
            guard let s = SiteDate.date($0.plannedStart), let e = SiteDate.date($0.plannedEnd) else { return false }
            return day >= s && day <= e
        }
    }

    private func marker(_ day: Date) -> Color? {
        if let s = SiteDate.date(detail.site.startDate), cal.isDate(day, inSameDayAs: s) { return .blue.opacity(0.25) }
        if let e = SiteDate.date(detail.site.plannedEndDate), cal.isDate(day, inSameDayAs: e) { return .purple.opacity(0.25) }
        if detail.metrics.delayDays > 0, let f = SiteDate.date(detail.metrics.forecastEnd), cal.isDate(day, inSameDayAs: f) {
            return .red.opacity(0.25)
        }
        return nil
    }
}

/// Un giorno del mini calendario.
private struct DayCell: View {
    let day: Date
    let number: Int
    let isToday: Bool
    let inMonth: Bool
    let marker: Color?
    let eventColors: [Color]
    let phase: SiteDetail.Phase?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Text("\(number)")
                    .font(.subheadline.weight(isToday ? .bold : .regular))
                    .foregroundStyle(isToday ? Color.white : inMonth ? Color.primary : Color.secondary.opacity(0.5))
                    .frame(width: 30, height: 30)
                    .background(isToday ? Color.accentColor : (marker ?? .clear), in: Circle())
                HStack(spacing: 2) {
                    ForEach(eventColors.indices, id: \.self) { i in
                        Circle().fill(eventColors[i]).frame(width: 5, height: 5)
                    }
                }
                .frame(height: 5)
                Capsule()
                    .fill(phaseColor)
                    .frame(height: 3)
                    .padding(.horizontal, 2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 2)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var phaseColor: Color {
        guard let phase else { return .clear }
        return phase.isDone ? Color.green.opacity(0.6) : Color.primary.opacity(0.18)
    }

    private var label: String {
        let date = day.formatted(date: .complete, time: .omitted)
        return eventColors.isEmpty ? date : "\(date), \(eventColors.count) eventi"
    }
}

/// Tempi e costi: ritardo stimato, quanto costa e dopo quanti giorni il
/// cantiere va in perdita, con il simulatore "e se sforassimo di…".
private struct DelayAnalysisSection: View {
    let detail: SiteDetail
    let canEdit: Bool
    let onSettings: () -> Void
    @State private var simDays: Double = -1

    var body: some View {
        let m = detail.metrics
        let s = detail.site
        if s.startDate == nil || s.plannedEndDate == nil || s.dailyCost == nil {
            Section("Analisi tempi e costi") {
                Text("Per calcolare quanto costa un ritardo servono data di inizio, fine prevista e costo giornaliero del cantiere.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if canEdit { Button("Imposta tempi e costi", systemImage: "calendar.badge.clock", action: onSettings) }
            }
        } else {
            Section {
                LabeledContent("Fine prevista", value: SiteDate.short(s.plannedEndDate))
                LabeledContent("Fine stimata") {
                    Text(SiteDate.short(m.forecastEnd)).foregroundStyle(m.delayDays > 0 ? .red : .primary)
                }
                LabeledContent("Ritardo stimato") {
                    Text(m.delayDays > 0 ? SiteText.days(m.delayDays) : "nessuno").foregroundStyle(m.delayDays > 0 ? .red : .green)
                }
                LabeledContent("Costo del ritardo") {
                    Text(Format.currency(m.delayCost)).monospacedDigit().foregroundStyle(m.delayCost > 0 ? .red : .primary)
                }
                LabeledContent("Costo al giorno") { Text(Format.currency(m.dailyBurn)).monospacedDigit() }
                LabeledContent("Margine atteso") {
                    Text("\(Format.currency(m.margin)) (\(Int(s.marginPct.rounded()))%)").monospacedDigit()
                }
                if let be = m.breakEvenDelayDays {
                    Text("Oltre **\(SiteText.days(be))** di ritardo il cantiere va **in perdita**: ogni giorno in più costa \(Format.currency(m.dailyBurn)).")
                        .font(.subheadline)
                }
            } header: {
                HStack {
                    Text("Analisi tempi e costi")
                    Spacer()
                    if canEdit { Button("Modifica", action: onSettings).font(.caption).textCase(nil) }
                }
            }

            Section("E se sforassimo di…") {
                let maxDays = Double(max(60, (m.breakEvenDelayDays ?? 0) + 10, m.delayDays + 10))
                let days = simDays < 0 ? Double(max(5, m.delayDays)) : simDays
                let cost = days * m.dailyBurn
                let left = m.margin - cost
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Slider(value: Binding(get: { days }, set: { simDays = $0.rounded() }), in: 0...maxDays, step: 1)
                        Text(SiteText.days(Int(days))).font(.subheadline.weight(.semibold)).monospacedDigit()
                            .frame(minWidth: 70, alignment: .trailing)
                    }
                    HStack(spacing: 10) {
                        box("Costo in più", Format.currency(cost), .red)
                        box(left >= 0 ? "Margine che resta" : "Perdita", Format.currency(abs(left)), left >= 0 ? .green : .red)
                    }
                }
                .padding(.vertical, 4)
            }

            if let chart = ProgressCurves(detail: detail), chart.planned.count > 1 {
                Section("Avanzamento: programma e reale") {
                    Chart {
                        ForEach(chart.planned) { p in
                            LineMark(x: .value("Data", p.date), y: .value("Avanzamento", p.value), series: .value("Serie", "Programma"))
                                .interpolationMethod(.stepEnd)
                                .foregroundStyle(.gray)
                                .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                        }
                        ForEach(chart.actual) { p in
                            LineMark(x: .value("Data", p.date), y: .value("Avanzamento", p.value), series: .value("Serie", "Reale"))
                                .interpolationMethod(.stepEnd)
                                .foregroundStyle(Color.accentColor)
                                .lineStyle(StrokeStyle(lineWidth: 2.5))
                        }
                        RuleMark(x: .value("Oggi", Date.now))
                            .foregroundStyle(.secondary.opacity(0.5))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    }
                    .chartYScale(domain: 0...100)
                    .chartYAxis { AxisMarks(values: [0, 25, 50, 75, 100]) { v in
                        AxisGridLine()
                        AxisValueLabel { Text("\(v.as(Int.self) ?? 0)%") }
                    } }
                    .chartForegroundStyleScale(["Programma": Color.gray, "Reale": Color.accentColor])
                    .frame(height: 200)
                    .padding(.vertical, 6)
                }
            }
        }
    }

    private func box(_ title: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.subheadline.weight(.bold)).monospacedDigit().foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

/// Curve cumulative: programma (fine di ogni fase) e reale (fasi spuntate).
private struct ProgressCurves {
    struct Point: Identifiable {
        let date: Date
        let value: Double
        var id: Date { date }
    }
    let planned: [Point]
    let actual: [Point]

    init?(detail: SiteDetail) {
        guard let start = SiteDate.date(detail.site.startDate) else { return nil }
        let phases = detail.phases
        let total = phases.reduce(0) { $0 + $1.weight }
        let weight: (SiteDetail.Phase) -> Double = { total > 0 ? $0.weight : 1 }
        let sum = total > 0 ? total : Double(max(1, phases.count))

        var acc = 0.0
        var planned = [Point(date: start, value: 0)]
        for p in phases.compactMap({ p in SiteDate.date(p.plannedEnd).map { (p, $0) } }).sorted(by: { $0.1 < $1.1 }) {
            acc += weight(p.0)
            planned.append(Point(date: p.1, value: acc / sum * 100))
        }
        acc = 0
        var actual = [Point(date: start, value: 0)]
        for p in phases.compactMap({ p in SiteDate.date(p.doneAt).map { (p, $0) } }).sorted(by: { $0.1 < $1.1 }) {
            acc += weight(p.0)
            actual.append(Point(date: max(start, p.1), value: acc / sum * 100))
        }
        if Date.now > start, let last = actual.last, last.date < .now {
            actual.append(Point(date: .now, value: last.value))
        }
        // Date uguali (più fasi nello stesso giorno): tiene l'ultimo valore.
        func dedupe(_ list: [Point]) -> [Point] {
            var out: [Point] = []
            for p in list {
                if let i = out.firstIndex(where: { Calendar.current.isDate($0.date, inSameDayAs: p.date) }) { out[i] = p } else { out.append(p) }
            }
            return out
        }
        self.planned = dedupe(planned)
        self.actual = dedupe(actual)
    }
}

// MARK: Note e consigli

struct SiteNotesSection: View {
    let detail: SiteDetail
    let canEdit: Bool
    let loadingInsights: Bool
    let refreshInsights: () -> Void
    let mutate: SiteMutation

    @State private var text = ""

    var body: some View {
        let insights = detail.site.aiInsights
        Section {
            if let tips = insights?.tips, !tips.isEmpty {
                ForEach(tips, id: \.self) { TipRow(tip: $0) }
                    .opacity(loadingInsights ? 0.5 : 1)
            } else {
                Text(loadingInsights ? "L'IA sta analizzando fasi, SAL, scadenze e meteo…"
                     : detail.isPending ? "I consigli arrivano quando il preventivo viene accettato." : "Nessun consiglio per ora.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if let weather = insights?.weather, !weather.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(weather, id: \.self) { w in
                            VStack(spacing: 4) {
                                Text(SiteDate.short(w.date)).font(.caption2).foregroundStyle(.secondary)
                                Image(systemName: w.rain >= 2 ? "cloud.rain.fill" : "sun.max.fill")
                                    .symbolRenderingMode(.multicolor)
                                Text("\(Int(w.tmax.rounded()))°").font(.caption).monospacedDigit()
                            }
                            .frame(width: 54)
                            .padding(.vertical, 8)
                            .background((w.rain >= 2 ? Color.blue : Color.primary).opacity(0.07),
                                        in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                }
            }
        } header: {
            HStack {
                Label("Consigli per questo cantiere", systemImage: "sparkles")
                Spacer()
                if !detail.isPending, !detail.phases.isEmpty {
                    if loadingInsights {
                        ProgressView().controlSize(.mini)
                    } else {
                        Button("Rigenera", systemImage: "arrow.clockwise", action: refreshInsights)
                            .labelStyle(.iconOnly)
                    }
                }
            }
        }

        Section {
            if canEdit {
                HStack(alignment: .bottom) {
                    TextField("Diario: cosa è successo oggi…", text: $text, axis: .vertical)
                        .lineLimit(1...6)
                    Button("Aggiungi", systemImage: "arrow.up.circle.fill") {
                        let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !body.isEmpty else { return }
                        text = ""
                        Task { await mutate("POST", "/api/sites/\(detail.site.id)/notes", ["body": body]) }
                    }
                    .labelStyle(.iconOnly)
                    .font(.title2)
                    .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            if detail.notes.isEmpty {
                Text("Nessuna nota.").foregroundStyle(.secondary)
            }
            ForEach(detail.notes) { n in
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(n.userName ?? "—") · \(SiteDate.short(n.createdAt))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(n.body).textSelection(.enabled)
                }
                .padding(.vertical, 2)
                .swipeActions(edge: .trailing) {
                    if canEdit {
                        Button(role: .destructive) {
                            Task { await mutate("DELETE", "/api/sites/\(detail.site.id)/notes/\(n.id)", [:]) }
                        } label: { Label("Elimina", systemImage: "trash") }
                    }
                }
            }
        } header: {
            Text("Diario di cantiere")
        }
    }
}
