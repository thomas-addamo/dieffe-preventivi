import SwiftUI
import UIKit

/// Link pubblico per il cliente (pagina /p/<token> con PIN): crea, condividi, revoca.
struct PublicLinkView: View {
    @Environment(\.dismiss) private var dismiss
    let editor: QuoteEditorModel
    @State private var days = 30
    @State private var working = false
    @State private var pin: String?
    @State private var confirmRevoke = false

    private var quote: QuoteDetail? { editor.quote }
    private var url: URL? { quote?.publicToken.map { AppConfig.url(for: "/p/\($0)") } }

    var body: some View {
        NavigationStack {
            Form {
                if let quote, quote.publicLinkActive, let url {
                    Section {
                        Text(url.absoluteString)
                            .font(.footnote.monospaced())
                            .textSelection(.enabled)
                        if let expiry = quote.publicLinkExpiry {
                            LabeledContent("Scade il", value: expiry.formatted(date: .long, time: .shortened))
                        }
                    } header: {
                        Text("Link attivo")
                    } footer: {
                        Text("Il cliente apre il preventivo dal link, lo consulta e può firmarlo per accettazione.")
                    }

                    if let pin {
                        Section {
                            HStack {
                                Text(pin)
                                    .font(.title.monospaced().weight(.bold))
                                    .kerning(6)
                                Spacer()
                                Button("Copia", systemImage: "doc.on.doc") { UIPasteboard.general.string = pin }
                                    .labelStyle(.iconOnly)
                            }
                        } header: {
                            Text("PIN per il cliente")
                        } footer: {
                            Text("Annotalo ora: per sicurezza non si potrà più rivedere. Se lo perdi, genera un nuovo link.")
                        }
                    }

                    Section {
                        ShareLink(item: url, message: Text(shareMessage(quote))) {
                            Label("Condividi link", systemImage: "square.and.arrow.up")
                        }
                        Button("Copia link", systemImage: "link") { UIPasteboard.general.url = url }
                        if editor.canEdit {
                            Button("Revoca link", systemImage: "xmark.circle", role: .destructive) { confirmRevoke = true }
                        }
                    }
                } else {
                    Section {
                        Picker("Valido per", selection: $days) {
                            ForEach([7, 15, 30, 60, 90], id: \.self) { Text("\($0) giorni").tag($0) }
                        }
                        Button {
                            create()
                        } label: {
                            if working { ProgressView() } else { Label("Crea link per il cliente", systemImage: "link.badge.plus") }
                        }
                        .disabled(working || !editor.canEdit)
                    } footer: {
                        Text("Il link è protetto da un PIN di 6 cifre, mostrato una sola volta.")
                    }
                }
            }
            .navigationTitle("Link per il cliente")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", systemImage: "checkmark") { dismiss() }
                }
            }
            .confirmationDialog("Revocare il link?", isPresented: $confirmRevoke, titleVisibility: .visible) {
                Button("Revoca", role: .destructive) {
                    Task { await editor.revokePublicLink(); pin = nil }
                }
            } message: {
                Text("Il cliente non potrà più aprire il preventivo.")
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func create() {
        working = true
        Task {
            defer { working = false }
            if let link = await editor.createPublicLink(days: days) { pin = link.pin }
        }
    }

    private func shareMessage(_ quote: QuoteDetail) -> String {
        "Preventivo \(quote.code) — \(quote.title)"
    }
}
