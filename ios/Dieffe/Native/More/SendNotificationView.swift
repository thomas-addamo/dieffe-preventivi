import SwiftUI

/// Invia notifica (solo admin, come src/app/(app)/admin/notifiche): a tutto il
/// team o a un utente. Arriva nel centro notifiche e sul badge dell'icona.
struct SendNotificationView: View {
    @Environment(AppModel.self) private var model
    @State private var type = "feature"
    @State private var title = ""
    @State private var text = ""
    @State private var link = ""
    @State private var target = "all"
    @State private var users: [TeamUser] = []
    @State private var sending = false
    @State private var error: String?
    @State private var sentTo: Int?

    static let types: [(value: String, label: String, detail: String, symbol: String, color: Color)] = [
        ("feature", "Nuova funzionalità", "Annuncia una nuova funzionalità con grafica dedicata.", "sparkles", .purple),
        ("announcement", "Comunicazione", "Comunicazione o avviso generale a tutto il team.", "megaphone.fill", .blue),
        ("maintenance", "Manutenzione", "Avvisa di una manutenzione o di un'interruzione programmata.", "wrench.and.screwdriver.fill", .orange),
        ("alert", "Avviso importante", "Avviso urgente che richiede attenzione immediata.", "exclamationmark.triangle.fill", .red),
    ]

    private var linkError: String? {
        let l = link.trimmingCharacters(in: .whitespaces)
        return l.isEmpty || l.hasPrefix("/") ? nil : "Il link deve iniziare con / (es. /dashboard)"
    }

    private var canSend: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && title.count <= 120 && text.count <= 500 && linkError == nil && !sending
    }

    var body: some View {
        Form {
            Section("Tipo") {
                ForEach(Self.types, id: \.value) { t in
                    Button { type = t.value } label: {
                        HStack(spacing: 12) {
                            Image(systemName: t.symbol)
                                .foregroundStyle(.white)
                                .frame(width: 32, height: 32)
                                .background(t.color.gradient, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(t.label).foregroundStyle(Color.primary)
                                Text(t.detail).font(.caption).foregroundStyle(Color.secondary)
                            }
                            Spacer()
                            if type == t.value {
                                Image(systemName: "checkmark").fontWeight(.semibold).foregroundStyle(Color.accentColor)
                            }
                        }
                    }
                }
            }
            Section {
                TextField("Titolo", text: $title, prompt: Text("Titolo (obbligatorio)"))
                TextField("Messaggio", text: $text, prompt: Text("Messaggio (facoltativo)"), axis: .vertical)
                    .lineLimit(3...8)
                TextField("Link", text: $link, prompt: Text("Link interno, es. /listino (facoltativo)"))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.body.monospaced())
                if let linkError {
                    Label(linkError, systemImage: "exclamationmark.circle").font(.footnote).foregroundStyle(.red)
                }
            } header: {
                Text("Contenuto")
            } footer: {
                Text("\(title.count)/120 · \(text.count)/500")
            }
            Section("Destinatari") {
                Picker("A chi", selection: $target) {
                    Text("Tutto il team").tag("all")
                    ForEach(users) { Text("\($0.name) (\($0.email))").tag($0.id) }
                }
            }
            if let error {
                Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
            }
            Section {
                Button {
                    send()
                } label: {
                    if sending { ProgressView() } else { Label("Invia notifica", systemImage: "paperplane.fill") }
                }
                .disabled(!canSend)
            }
        }
        .navigationTitle("Invia notifica")
        .task {
            let all: [TeamUser] = (try? await APIClient.shared.get("/api/users")) ?? []
            users = all.filter { !$0.disabled }.sorted { $0.name.localizedCompare($1.name) == .orderedAscending }
        }
        .alert("Notifica inviata", isPresented: Binding(get: { sentTo != nil }, set: { if !$0 { sentTo = nil } })) {
            Button("OK") {}
        } message: {
            Text(sentTo == 1 ? "Inviata a 1 utente." : "Inviata a \(sentTo ?? 0) utenti.")
        }
    }

    private func send() {
        sending = true
        error = nil
        Task {
            defer { sending = false }
            struct Response: Decodable { let recipients: Int? }
            do {
                let r: Response = try await APIClient.shared.send("POST", "/api/admin/notifications", json: [
                    "type": type, "title": title.trimmingCharacters(in: .whitespaces),
                    "body": text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : text,
                    "link": link.trimmingCharacters(in: .whitespaces).isEmpty ? nil : link.trimmingCharacters(in: .whitespaces),
                    "target": target,
                ])
                sentTo = r.recipients ?? 1
                title = ""
                text = ""
                link = ""
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
