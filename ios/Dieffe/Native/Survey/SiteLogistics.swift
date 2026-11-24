import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// Logistica di cantiere (1–4), vista al sopralluogo. Stesse etichette del sito
// (src/lib/sites/logistics.ts). Si salva sul preventivo principale con
// PATCH /api/quotes/:id/survey-board { logistics }.
// ─────────────────────────────────────────────────────────────────────────────

enum SiteLogistics: Int, CaseIterable, Identifiable {
    case simple = 1, medium, hard, impossible

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .simple: "Semplice"
        case .medium: "Intermedia"
        case .hard: "Difficile"
        case .impossible: "Accesso impossibile"
        }
    }

    var detail: String {
        switch self {
        case .simple: "Cortile raggiungibile comodamente dal passo carraio: si può montare il montacarico ed entrare con il camion con gru."
        case .medium: "Si arriva al cortile interno con una o più manovre."
        case .hard: "Accesso solo con mezzi di piccole dimensioni."
        case .impossible: "Serve il permesso di occupazione del suolo pubblico."
        }
    }

    var symbol: String {
        switch self {
        case .simple: "truck.box.fill"
        case .medium: "arrow.triangle.turn.up.right.diamond.fill"
        case .hard: "car.side.fill"
        case .impossible: "exclamationmark.octagon.fill"
        }
    }

    var tint: Color {
        switch self {
        case .simple: .green
        case .medium: .yellow
        case .hard: .orange
        case .impossible: .red
        }
    }
}

/// Quattro tacche: quante sono piene dice quanto è difficile l'accesso.
struct LogisticsDots: View {
    let level: SiteLogistics

    var body: some View {
        HStack(spacing: 2) {
            ForEach(1...4, id: \.self) { i in
                Capsule()
                    .fill(i <= level.rawValue ? AnyShapeStyle(level.tint) : AnyShapeStyle(.quaternary))
                    .frame(width: 5, height: 10)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Righe da spuntare dentro una List/Form. Un secondo tocco sulla scelta la toglie.
struct LogisticsPickerRows: View {
    let selection: SiteLogistics?
    var disabled = false
    let onSelect: (SiteLogistics?) -> Void

    var body: some View {
        ForEach(SiteLogistics.allCases) { level in
            let on = selection == level
            Button {
                onSelect(on ? nil : level)
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: on ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(on ? AnyShapeStyle(.tint) : AnyShapeStyle(.tertiary))
                        .contentTransition(.symbolEffect(.replace))
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 8) {
                            Text("\(level.rawValue). \(level.title)").font(.subheadline.weight(.semibold))
                            LogisticsDots(level: level)
                        }
                        Text(level.detail)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(disabled)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(on ? [.isSelected, .isButton] : .isButton)
            .sensoryFeedback(.selection, trigger: on)
        }
    }
}

/// Riga compatta per la scheda cantiere: mostra il livello, lo cambia da un menu.
struct LogisticsSummaryRow: View {
    let level: SiteLogistics?
    let editable: Bool
    let onChange: (SiteLogistics?) -> Void

    var body: some View {
        let label = HStack(spacing: 12) {
            Image(systemName: level?.symbol ?? "truck.box")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background((level?.tint ?? .gray).gradient, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text("Logistica di cantiere").font(.caption).foregroundStyle(.secondary)
                if let level {
                    HStack(spacing: 8) {
                        Text(level.title).font(.subheadline.weight(.semibold))
                        LogisticsDots(level: level)
                    }
                    Text(level.detail).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                } else {
                    Text(editable ? "Da indicare dopo il sopralluogo" : "Non indicata")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
            if editable {
                Image(systemName: "chevron.up.chevron.down").font(.caption).foregroundStyle(.tertiary)
            }
        }
        .contentShape(Rectangle())

        if editable {
            Menu {
                Picker("Logistica di cantiere", selection: Binding(get: { level }, set: { onChange($0) })) {
                    ForEach(SiteLogistics.allCases) { l in
                        Label("\(l.rawValue). \(l.title)", systemImage: l.symbol).tag(SiteLogistics?.some(l))
                    }
                    Text("Non indicata").tag(SiteLogistics?.none)
                }
            } label: { label }
            .buttonStyle(.plain)
        } else {
            label
        }
    }
}
