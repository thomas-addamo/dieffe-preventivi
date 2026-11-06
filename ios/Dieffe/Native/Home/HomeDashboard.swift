import Charts
import SwiftUI

// Componenti della Home: sfondo, riquadro del mese, riquadri rapidi,
// "Da seguire", aperti di recente e filtri per stato.

// MARK: - Sfondo

/// Sfumatura con i colori del marchio dietro la parte alta della Home; più
/// chiara di giorno, più profonda con il tema scuro. Sfuma nel fondo di sistema.
struct HomeBackground: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let dark = scheme == .dark
        MeshGradient(
            width: 3, height: 3,
            points: [[0, 0], [0.5, 0], [1, 0],
                     [0, 0.5], [0.55, 0.45], [1, 0.5],
                     [0, 1], [0.5, 1], [1, 1]],
            colors: dark
                ? [.init(hex: 0x1E3A8A), .init(hex: 0x312E81), .init(hex: 0x4C1D95),
                   .init(hex: 0x1E40AF), .init(hex: 0x3730A3), .init(hex: 0x5B21B6),
                   .black, .black, .black]
                : [.init(hex: 0xBFDBFE), .init(hex: 0xC7D2FE), .init(hex: 0xDDD6FE),
                   .init(hex: 0xDBEAFE), .init(hex: 0xE0E7FF), .init(hex: 0xEDE9FE),
                   Color(.systemGroupedBackground), Color(.systemGroupedBackground), Color(.systemGroupedBackground)]
        )
        .frame(height: 520)
        .mask(LinearGradient(colors: [.black, .black, .clear], startPoint: .top, endPoint: .bottom))
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Color(.systemGroupedBackground))
        .ignoresSafeArea()
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255)
    }
}

// MARK: - Riquadro del mese

/// Il valore accettato nel mese, il tasso di accettazione e l'andamento degli
/// ultimi 6 mesi, su un fondo blu-viola del marchio.
struct MonthHeroCard: View {
    let insights: HomeInsights

    private static let monthName: Date.FormatStyle = .dateTime.month(.wide).locale(Locale(identifier: "it_IT"))
    private static let monthShort: Date.FormatStyle = .dateTime.month(.narrow).locale(Locale(identifier: "it_IT"))

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline) {
                Label("Accettati a \(Date.now.formatted(Self.monthName))", systemImage: "checkmark.seal.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                if let rate = insights.acceptanceRate {
                    Text("\(Int((rate * 100).rounded()))% accettati")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(.white.opacity(0.18), in: Capsule())
                        .foregroundStyle(.white)
                        .accessibilityLabel("Tasso di accettazione degli ultimi 12 mesi: \(Int((rate * 100).rounded())) per cento")
                }
            }

            HStack(alignment: .bottom, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(Format.currency(insights.acceptedValueThisMonth))
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                        .contentTransition(.numericText())
                    Text(insights.acceptedThisMonth == 0
                         ? "Ancora nessuno questo mese"
                         : Format.count(insights.acceptedThisMonth, "preventivo accettato", "preventivi accettati"))
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.8))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .foregroundStyle(.white)
                Spacer(minLength: 8)
                Chart(insights.months) { month in
                    BarMark(x: .value("Mese", month.start, unit: .month),
                            y: .value("Accettato", month.accepted))
                        .foregroundStyle(month.start == insights.months.last?.start ? .white : .white.opacity(0.45))
                        .clipShape(Capsule())
                }
                .chartXAxis {
                    AxisMarks(values: .stride(by: .month)) { value in
                        AxisValueLabel {
                            if let date = value.as(Date.self) {
                                Text(date.formatted(Self.monthShort).uppercased())
                                    .font(.system(size: 9, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.7))
                            }
                        }
                    }
                }
                .chartYAxis(.hidden)
                .frame(width: 128, height: 74)
                .accessibilityLabel("Valore accettato negli ultimi 6 mesi")
            }
        }
        .padding(18)
        .background {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [.init(hex: 0x1E40AF), .init(hex: 0x3730A3), .init(hex: 0x6D28D9)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(alignment: .topTrailing) {
                    Circle().fill(.white.opacity(0.10)).frame(width: 180).offset(x: 60, y: -90).blur(radius: 2)
                }
                .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(.white.opacity(0.14)))
        }
    }
}

// MARK: - Riquadri rapidi

struct KPITile: View {
    let symbol: String
    let colors: [Color]
    let value: String
    let label: String
    var detail: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: symbol)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing),
                                in: Circle())
                VStack(alignment: .leading, spacing: 1) {
                    Text(value)
                        .font(.title3.weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(.primary)
                        .contentTransition(.numericText())
                    Text(label)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                    Text(detail ?? " ")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(colors.last ?? .secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Da seguire

struct FollowUpRow: View {
    let item: HomeInsights.FollowUp
    let open: () -> Void

    private var isDraft: Bool { item.quote.status == .draft }

    var body: some View {
        Button(action: open) {
            HStack(spacing: 12) {
                Image(systemName: isDraft ? "pencil.and.list.clipboard" : "hourglass")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(isDraft ? Color.gray : Color.orange)
                    .frame(width: 36, height: 36)
                    .background((isDraft ? Color.gray : Color.orange).opacity(0.14), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.quote.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(item.quote.clientName ?? "Nessun cliente")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                VStack(alignment: .trailing, spacing: 3) {
                    Text(CompactMoney.format(item.quote.total))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(.primary)
                    Text("\(item.days) gg")
                        .font(.caption2.weight(.bold))
                        .monospacedDigit()
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .foregroundStyle(isDraft ? Color.gray : Color.orange)
                        .background((isDraft ? Color.gray : Color.orange).opacity(0.14), in: Capsule())
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(CompactMoney.format(item.quote.total)), \(isDraft ? "bozza ferma" : "in attesa") da \(item.days) giorni")
            }
        }
        .tint(.primary)
    }
}

// MARK: - Aperti di recente

struct RecentQuoteCard: View {
    let quote: QuoteSummary
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: quote.status.symbol)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(quote.status.color)
                    Text(quote.code)
                        .font(.caption2.monospaced().weight(.semibold))
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 2)
                }
                Text(quote.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2, reservesSpace: true)
                    .multilineTextAlignment(.leading)
                HStack {
                    Text(quote.clientName ?? "Nessun cliente")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(CompactMoney.format(quote.total))
                        .font(.caption.weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(.primary)
                }
            }
            .frame(width: 200, alignment: .leading)
            .padding(14)
            .background {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
                    .overlay(alignment: .top) {
                        LinearGradient(colors: [quote.status.color.opacity(0.18), .clear], startPoint: .top, endPoint: .bottom)
                            .frame(height: 44)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Filtri per stato

struct StatusChips: View {
    @Binding var selection: QuoteStatus?
    let counts: [QuoteStatus: Int]

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                chip(nil, "Tutti", nil)
                ForEach(QuoteStatus.allCases) { status in
                    if let count = counts[status], count > 0 {
                        chip(status, status.pluralLabel, count)
                    }
                }
            }
            .padding(.horizontal, 20)
        }
        .scrollIndicators(.hidden)
    }

    private func chip(_ status: QuoteStatus?, _ title: String, _ count: Int?) -> some View {
        let selected = selection == status
        let color = status?.color ?? Color.accentColor
        return Button {
            withAnimation(.snappy) { selection = status }
        } label: {
            HStack(spacing: 5) {
                Text(title)
                if let count {
                    Text("\(count)").monospacedDigit().opacity(0.7)
                }
            }
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 13)
            .padding(.vertical, 7)
            .foregroundStyle(selected ? .white : color)
            .background(selected ? AnyShapeStyle(color) : AnyShapeStyle(color.opacity(0.12)), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
