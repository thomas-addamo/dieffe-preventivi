import SwiftUI

/// Voce del changelog del sito (src/lib/changelog.ts) da GET /api/app/whats-new.
struct WhatsNewEntry: Decodable, Identifiable, Equatable {
    let version: String
    let date: String
    let headline: String
    let highlights: [Highlight]

    var id: String { version }

    struct Highlight: Decodable, Equatable, Identifiable {
        let icon: String
        let title: String
        let description: String

        var id: String { title }

        /// Le icone del sito (lucide) come SF Symbols.
        var symbol: String {
            switch icon {
            case "format": "textformat"
            case "pdf": "doc.richtext"
            case "layout": "rectangle.split.3x1"
            case "settings": "gearshape.2"
            case "shield": "checkmark.shield"
            case "zap": "bolt"
            case "desktop": "desktopcomputer"
            case "keyboard": "keyboard"
            default: "sparkles"
            }
        }
    }
}

/// Quando mostrare le "Novità": solo per gli aggiornamenti importanti (decide
/// il sito, `important` nel changelog) e una volta sola. Al primo avvio non si
/// mostra niente: si parte dalla versione installata.
enum WhatsNew {
    private static let seenKey = "whatsNewSeenVersion"

    static var seenVersion: String? {
        get { UserDefaults.standard.string(forKey: seenKey) }
        set { UserDefaults.standard.set(newValue, forKey: seenKey) }
    }

    /// La voce da mostrare dopo un aggiornamento dell'app, se ce n'è una.
    static func pending(current: String = AppConfig.version) async -> WhatsNewEntry? {
        #if DEBUG
        // -DieffeWhatsNew 3.18.0: mostra quella voce (solo per le prove).
        if let preview = UserDefaults.standard.string(forKey: "DieffeWhatsNew") {
            return await fetch("/api/app/whats-new?preview=\(preview)")
        }
        #endif
        guard let seen = seenVersion else {
            seenVersion = current
            return nil
        }
        guard seen != current else { return nil }
        let query = "version=\(current)&seen=\(seen)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        guard let entry = await fetch("/api/app/whats-new?\(query)") else {
            // Nessuna novità importante: questa versione è già "vista".
            seenVersion = current
            return nil
        }
        return entry
    }

    static func markSeen(current: String = AppConfig.version) {
        seenVersion = current
    }

    private struct Response: Decodable { let entry: WhatsNewEntry? }

    static func fetch(_ path: String) async -> WhatsNewEntry? {
        (try? await APIClient.shared.get(path) as Response)?.entry
    }
}

/// Schermata "Novità" come quelle delle app Apple: titolo grande, elenco con
/// icone e il tasto Continua in fondo.
struct WhatsNewView: View {
    let entry: WhatsNewEntry
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 36) {
                    VStack(spacing: 10) {
                        Text("Novità di\nDieffe Preventivi")
                            .font(.largeTitle.bold())
                            .multilineTextAlignment(.center)
                        Text("Versione \(entry.version) · \(entry.headline)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 56)

                    VStack(alignment: .leading, spacing: 26) {
                        ForEach(entry.highlights) { item in
                            HStack(alignment: .top, spacing: 18) {
                                Image(systemName: item.symbol)
                                    .font(.system(size: 30, weight: .regular))
                                    .foregroundStyle(Color.accentColor)
                                    .symbolRenderingMode(.hierarchical)
                                    .frame(width: 44)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.title).font(.headline)
                                    Text(item.description)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }

            Button {
                dismiss()
            } label: {
                Text("Continua")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .padding(.horizontal, 32)
            .padding(.bottom, 20)
            .frame(maxWidth: 520)
        }
    }
}
