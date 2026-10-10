import Charts
import SwiftUI

/// Statistiche native con Swift Charts (come src/app/(app)/statistiche): KPI,
/// preventivi per mese e stato, valore accettato per mese, distribuzione
/// degli stati, migliori clienti e utenti. Visibili a tutti i ruoli.
struct StatsView: View {
    @Environment(AppModel.self) private var model
    @State private var period: Period = .year

    enum Period: Int, CaseIterable, Identifiable {
        case month = 30, quarter = 90, half = 180, year = 365, all = 0
        var id: Int { rawValue }
        var label: String {
            switch self {
            case .month: "30 giorni"
            case .quarter: "3 mesi"
            case .half: "6 mesi"
            case .year: "12 mesi"
            case .all: "Tutto"
            }
        }
    }

    var body: some View {
        let stats = Stats(quotes: model.home.data?.quotes ?? [], period: period)
        List {
            Section {
                Picker("Periodo", selection: $period) {
                    ForEach(Period.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())

            Section {
                Grid(horizontalSpacing: 12, verticalSpacing: 12) {
                    GridRow {
                        KPI(label: "Preventivi", value: stats.count.formatted(), color: .blue)
                        KPI(label: "Valore accettati", value: Format.currency(stats.acceptedValue), color: .green)
                    }
                    GridRow {
                        KPI(label: "Tasso di conversione", value: stats.conversion.formatted(.percent.precision(.fractionLength(1))),
                            color: .purple, note: "accettati su inviati")
                        KPI(label: "Valore medio", value: Format.currency(stats.average), color: .orange)
                    }
                    GridRow {
                        KPI(label: "Questo mese", value: stats.thisMonth.formatted(), color: .teal,
                            note: stats.trendText, noteColor: stats.trend >= 0 ? .green : .red)
                        Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
                    }
                }
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())

            Section("Preventivi per mese") {
                Chart(stats.monthly) { row in
                    BarMark(x: .value("Mese", row.month, unit: .month), y: .value("Preventivi", row.count))
                        .foregroundStyle(by: .value("Stato", row.status.label))
                }
                .chartForegroundStyleScale(domain: QuoteStatus.allCases.map(\.label),
                                           range: QuoteStatus.allCases.map(\.color))
                .chartXAxis { AxisMarks(values: .stride(by: .month, count: 2)) { _ in
                    AxisGridLine(); AxisValueLabel(format: .dateTime.month(.abbreviated))
                } }
                .frame(height: 220)
                .padding(.vertical, 6)
            }

            Section("Valore accettato per mese") {
                Chart(stats.acceptedByMonth) { row in
                    AreaMark(x: .value("Mese", row.month, unit: .month), y: .value("Valore", row.value))
                        .foregroundStyle(.green.opacity(0.15))
                    LineMark(x: .value("Mese", row.month, unit: .month), y: .value("Valore", row.value))
                        .foregroundStyle(.green)
                        .symbol(.circle)
                }
                .chartYAxis { AxisMarks { value in
                    AxisGridLine()
                    AxisValueLabel { if let v = value.as(Double.self) { Text(v, format: .number.notation(.compactName)) } }
                } }
                .chartXAxis { AxisMarks(values: .stride(by: .month, count: 2)) { _ in
                    AxisGridLine(); AxisValueLabel(format: .dateTime.month(.abbreviated))
                } }
                .frame(height: 200)
                .padding(.vertical, 6)
            }

            if !stats.byStatus.isEmpty {
                Section("Distribuzione degli stati") {
                    Chart(stats.byStatus, id: \.0) { status, count in
                        SectorMark(angle: .value("Preventivi", count), innerRadius: .ratio(0.6), angularInset: 2)
                            .foregroundStyle(status.color)
                            .cornerRadius(4)
                    }
                    .frame(height: 180)
                    .padding(.vertical, 6)
                    ForEach(stats.byStatus, id: \.0) { status, count in
                        LabeledContent {
                            Text(count.formatted()).monospacedDigit()
                        } label: {
                            Label { Text(status.label) } icon: { Circle().fill(status.color).frame(width: 10) }
                        }
                    }
                }
            }

            if !stats.topClients.isEmpty {
                Section("Migliori clienti (valore accettato)") {
                    ForEach(Array(stats.topClients.enumerated()), id: \.offset) { index, item in
                        LabeledContent {
                            Text(Format.currency(item.1)).monospacedDigit()
                        } label: {
                            Label(item.0, systemImage: "\(index + 1).circle.fill")
                        }
                    }
                }
            }

            if !stats.topUsers.isEmpty {
                Section("Utenti più attivi (preventivi creati)") {
                    ForEach(Array(stats.topUsers.enumerated()), id: \.offset) { index, item in
                        LabeledContent {
                            Text(item.1.formatted()).monospacedDigit()
                        } label: {
                            Label(item.0, systemImage: "\(index + 1).circle.fill")
                        }
                    }
                }
            }
        }
        .navigationTitle("Statistiche")
        .refreshable { await model.home.load() }
    }
}

private struct KPI: View {
    let label: String
    let value: String
    let color: Color
    var note: String?
    var noteColor: Color = .secondary

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.bold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let note {
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(noteColor)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(alignment: .topTrailing) {
            Circle().fill(color).frame(width: 8, height: 8).padding(12)
        }
    }
}

/// Calcoli identici a StatisticheClient.tsx.
struct Stats {
    struct Monthly: Identifiable { let month: Date; let status: QuoteStatus; let count: Int; var id: String { "\(month)\(status)" } }
    struct MonthValue: Identifiable { let month: Date; let value: Double; var id: Date { month } }

    let count: Int
    let acceptedValue: Double
    let conversion: Double
    let average: Double
    let thisMonth: Int
    let trend: Double
    let monthly: [Monthly]
    let acceptedByMonth: [MonthValue]
    let byStatus: [(QuoteStatus, Int)]
    let topClients: [(String, Double)]
    let topUsers: [(String, Int)]

    var trendText: String {
        trend == 0 ? "come il mese scorso" : "\(trend > 0 ? "+" : "")\(trend.formatted(.number.precision(.fractionLength(0))))% sul mese scorso"
    }

    init(quotes: [QuoteSummary], period: StatsView.Period) {
        let calendar = Calendar.current
        let now = Date.now
        let date = { (raw: String) in HeaderEditView.date(raw) ?? .distantPast }
        let filtered = period == .all ? quotes : quotes.filter {
            date($0.createdAt) >= calendar.date(byAdding: .day, value: -period.rawValue, to: now)!
        }

        count = filtered.count
        let accepted = filtered.filter { $0.status == .accepted }
        let sent = filtered.filter { [.sent, .accepted, .rejected].contains($0.status) }
        acceptedValue = accepted.reduce(0) { $0 + $1.total }
        conversion = sent.isEmpty ? 0 : Double(accepted.count) / Double(sent.count)
        average = filtered.isEmpty ? 0 : filtered.reduce(0) { $0 + $1.total } / Double(filtered.count)

        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: now))!
        let lastMonthStart = calendar.date(byAdding: .month, value: -1, to: monthStart)!
        thisMonth = quotes.filter { date($0.createdAt) >= monthStart }.count
        let lastMonth = quotes.filter { (lastMonthStart..<monthStart).contains(date($0.createdAt)) }.count
        trend = lastMonth > 0 ? Double(thisMonth - lastMonth) / Double(lastMonth) * 100 : 0

        let months = (0..<12).reversed().map { calendar.date(byAdding: .month, value: -$0, to: monthStart)! }
        func monthOf(_ d: Date) -> Date { calendar.date(from: calendar.dateComponents([.year, .month], from: d))! }
        monthly = months.flatMap { month in
            QuoteStatus.allCases.map { status in
                Monthly(month: month, status: status,
                        count: quotes.filter { monthOf(date($0.createdAt)) == month && $0.status == status }.count)
            }
        }
        acceptedByMonth = months.map { month in
            MonthValue(month: month, value: quotes.filter { $0.status == .accepted && monthOf(date($0.updatedAt)) == month }
                .reduce(0) { $0 + $1.total })
        }
        byStatus = QuoteStatus.allCases.map { s in (s, filtered.filter { $0.status == s }.count) }.filter { $0.1 > 0 }
        topClients = Array(Dictionary(grouping: accepted.filter { $0.clientName != nil }, by: { $0.clientName! })
            .map { ($0.key, $0.value.reduce(0) { $0 + $1.total }) }
            .sorted { $0.1 > $1.1 }.prefix(5))
        topUsers = Array(Dictionary(grouping: filtered, by: \.authorName)
            .map { ($0.key, $0.value.count) }
            .sorted { $0.1 > $1.1 }.prefix(5))
    }
}
