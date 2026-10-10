import SwiftUI

struct StatusBadge: View {
    let status: QuoteStatus

    var body: some View {
        Text(status.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .foregroundStyle(status.color)
            .background(status.color.opacity(0.14), in: Capsule())
    }
}

/// Riga di un preventivo: codice, titolo, stato, cliente, imponibile, data.
struct QuoteRow: View {
    let quote: QuoteSummary
    var extras: (count: Int, expanded: Bool, toggle: () -> Void)?

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: quote.isExtra ? "doc.badge.plus" : "doc.text")
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(quote.isExtra ? Color.orange : quote.status.color)
                .frame(width: 40, height: 40)
                .background((quote.isExtra ? Color.orange : quote.status.color).opacity(0.13),
                            in: RoundedRectangle(cornerRadius: 11, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 5) {
                    Text(quote.code)
                        .font(.caption.monospaced().weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                    if quote.isExtra {
                        Text("Extra")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 5)
                            .foregroundStyle(.orange)
                            .background(Color.orange.opacity(0.14), in: Capsule())
                    }
                    if quote.publicLinkActive {
                        Image(systemName: "link")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.blue)
                            .accessibilityLabel("Link pubblico attivo")
                    }
                }
                Text(quote.title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                HStack(spacing: 6) {
                    StatusBadge(status: quote.status)
                    Text(quote.clientName ?? quote.authorName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 4)

            VStack(alignment: .trailing, spacing: 4) {
                Text(Format.currency(quote.total))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(.primary)
                Text(Format.date(quote.createdAt))
                    .font(.caption2)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                if let extras {
                    Button(action: extras.toggle) {
                        HStack(spacing: 2) {
                            Text("+\(extras.count) extra")
                            Image(systemName: "chevron.down")
                                .rotationEffect(.degrees(extras.expanded ? 180 : 0))
                        }
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .foregroundStyle(.orange)
                        .background(Color.orange.opacity(0.14), in: Capsule())
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel(extras.expanded ? "Nascondi lavori extra" : "Mostra lavori extra")
                }
            }
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }
}

struct InitialsAvatar: View {
    let name: String
    var size: CGFloat = 40

    private var initials: String {
        let value = name.split(separator: " ").prefix(2)
            .compactMap { $0.first.map { String($0).uppercased() } }.joined()
        return value.isEmpty ? "?" : value
    }

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
            .foregroundStyle(Color.accentColor)
            .frame(width: size, height: size)
            .background(Color.accentColor.opacity(0.13), in: Circle())
    }
}

/// Stato "nessun dato ancora" comune a Home e Clienti.
struct LoadingOrError: View {
    let error: String?
    let retry: () async -> Void

    var body: some View {
        if let error {
            ContentUnavailableView {
                Label("Impossibile caricare", systemImage: "wifi.exclamationmark")
            } description: {
                Text(error)
            } actions: {
                Button("Riprova") { Task { await retry() } }
                    .buttonStyle(.glassProminent)
            }
        } else {
            ProgressView()
                .controlSize(.large)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
