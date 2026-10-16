import SwiftUI
import UIKit
import WebKit

/// Invio del preventivo al cliente per email dalla casella ufficiale
/// (POST /api/quotes/<id>/email): testo pronto e modificabile, PDF allegato,
/// link di accesso, codice comunicato a voce o allegato, note controllate
/// dall'IA, più destinatari in copia (CC) o copia nascosta (CCN).
struct SendEmailView: View {
    @Environment(\.dismiss) private var dismiss
    let editor: QuoteEditorModel

    @State private var draft: EmailDraft?
    @State private var loadError: String?
    @State private var to: [String] = []
    @State private var copies: [String] = []
    @State private var copyMode = "cc"
    @State private var newAddress = ""
    @State private var newCopy = ""
    @State private var subject = ""
    @State private var message = ""
    @State private var notes = ""
    @State private var pinMode = "personal"
    @State private var newPin = false
    @State private var linkDays = 30

    @State private var checking = false
    @State private var proof: Proofread?
    @State private var previewHTML: String?
    @State private var previewing = false
    @State private var sending = false
    @State private var sent: Sent?
    @State private var errorMessage: String?

    private var api: APIClient { .shared }
    private var quoteID: String { editor.quote?.id ?? "" }

    var body: some View {
        NavigationStack {
            Group {
                if let sent {
                    sentView(sent)
                } else if let draft {
                    form(draft)
                } else if let loadError {
                    ContentUnavailableView("Impossibile preparare la mail", systemImage: "envelope.badge",
                                           description: Text(loadError))
                } else {
                    ProgressView().controlSize(.large)
                }
            }
            .navigationTitle(sent == nil ? "Invia per email" : "Mail inviata")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar }
            .navigationDestination(item: Binding(get: { previewHTML.map(HTMLBox.init) },
                                                 set: { previewHTML = $0?.html })) { box in
                EmailPreview(html: box.html)
                    .navigationTitle("Anteprima")
                    .navigationBarTitleDisplayMode(.inline)
                    .ignoresSafeArea(edges: .bottom)
            }
            .alert("Attenzione", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
        .interactiveDismissDisabled(sending)
        .task { await load() }
    }

    // MARK: Modulo

    @ViewBuilder
    private func form(_ draft: EmailDraft) -> some View {
        Form {
            if !draft.configured {
                Section {
                    Label("L'invio non è ancora attivo: manca la password per le app di Gmail. Puoi preparare la mail e vedere l'anteprima.",
                          systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            }

            Section {
                ForEach(to, id: \.self) { address in
                    recipientRow(address, draft: draft)
                }
                .onDelete { to.remove(atOffsets: $0) }
                addressField("Aggiungi destinatario", text: $newAddress, list: $to, other: copies, draft: draft)
            } header: {
                Text("A")
            } footer: {
                Text("Da: \(draft.from.name) <\(draft.from.address)>")
            }

            Section {
                Picker("Tipo di copia", selection: $copyMode) {
                    Text("CC").tag("cc")
                    Text("CCN").tag("bcc")
                }
                .pickerStyle(.segmented)
                ForEach(copies, id: \.self) { address in
                    recipientRow(address, draft: draft)
                }
                .onDelete { copies.remove(atOffsets: $0) }
                addressField("Aggiungi in copia", text: $newCopy, list: $copies, other: to, draft: draft)
            } header: {
                Text("Copia")
            } footer: {
                Text(copyMode == "cc" ? "Tutti vedono chi ha ricevuto la mail." : "Copia nascosta: ognuno vede solo sé stesso.")
            }

            Section("Oggetto") {
                TextField("Oggetto", text: $subject, axis: .vertical)
            }

            Section {
                TextField("Messaggio", text: $message, axis: .vertical)
                    .lineLimit(4...12)
            } header: {
                Text("Messaggio")
            } footer: {
                Text("Seguono in automatico: riferimenti del preventivo, link per aprirlo online, codice di accesso, le tue note e la firma.")
            }

            if draft.closed {
                Section {
                    Text("Il preventivo è già \(draft.status == "accepted" ? "accettato" : "rifiutato"): verrà inviato solo il PDF, senza link.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } else {
                Section {
                    Picker("Codice di accesso", selection: $pinMode) {
                        Label("Lo comunico io", systemImage: "person.badge.shield.checkmark").tag("personal")
                        Label("Allegalo alla mail", systemImage: "key").tag("attach")
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                    if draft.link.active {
                        if pinMode == "personal" {
                            Toggle("Genera un nuovo codice", isOn: $newPin)
                        }
                    } else {
                        Picker("Link valido per", selection: $linkDays) {
                            ForEach(Array(Set([7, 15, 30, 60, 90, draft.link.days])).sorted(), id: \.self) {
                                Text("\($0) giorni").tag($0)
                            }
                        }
                    }
                } header: {
                    Text("Codice di accesso")
                } footer: {
                    if draft.link.active && (pinMode == "attach" || newPin) {
                        Label("Verrà generato un nuovo codice: quello attuale smetterà di funzionare.",
                              systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                    } else if !draft.link.active && pinMode == "personal" {
                        Text("Verrà creato il link e ti mostrerò il codice da comunicare al cliente.")
                    }
                }
            }

            Section {
                TextField("Es. tempi di inizio lavori, materiali, disponibilità per un sopralluogo…",
                          text: $notes, axis: .vertical)
                    .lineLimit(3...10)
                    .onChange(of: notes) { proof = nil }
                Button {
                    Task { await checkNotes() }
                } label: {
                    if checking {
                        HStack { ProgressView(); Text("Controllo in corso…") }
                    } else {
                        Label("Controlla con IA", systemImage: "sparkles")
                    }
                }
                .disabled(checking || notes.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
            } header: {
                Text("Note aggiuntive")
            } footer: {
                Text("L'IA corregge solo ortografia e grammatica, senza cambiare il tono.")
            }

            if let proof {
                Section("\(proof.changes.count) \(proof.changes.count == 1 ? "correzione suggerita" : "correzioni suggerite")") {
                    ForEach(Array(proof.changes.enumerated()), id: \.offset) { _, change in
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(change.from).strikethrough().foregroundStyle(.red)
                            Image(systemName: "arrow.right").font(.caption).foregroundStyle(.secondary)
                            Text(change.to).fontWeight(.medium).foregroundStyle(.green)
                        }
                    }
                    Button("Applica correzioni", systemImage: "checkmark") {
                        notes = proof.corrected
                        self.proof = nil
                    }
                    Button("Ignora", role: .cancel) { self.proof = nil }
                }
            }

            Section {
                Button {
                    Task { await preview() }
                } label: {
                    if previewing {
                        HStack { ProgressView(); Text("Preparazione…") }
                    } else {
                        Label("Anteprima della mail", systemImage: "eye")
                    }
                }
                .disabled(previewing || !isValid)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Fine") {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                }
            }
        }
    }

    private func recipientRow(_ address: String, draft: EmailDraft) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if let name = draft.contacts.first(where: { $0.email?.lowercased() == address })?.name {
                Text(name)
                Text(address).font(.caption).foregroundStyle(.secondary)
            } else {
                Text(address)
            }
        }
    }

    @ViewBuilder
    private func addressField(_ title: String, text: Binding<String>, list: Binding<[String]>,
                              other: [String], draft: EmailDraft) -> some View {
        TextField(title, text: text)
            .keyboardType(.emailAddress)
            .textContentType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .submitLabel(.done)
            .onSubmit { add(text, to: list) }
        let query = text.wrappedValue.trimmingCharacters(in: .whitespaces).lowercased()
        if !query.isEmpty {
            ForEach(draft.contacts.filter {
                guard let email = $0.email?.lowercased(), !list.wrappedValue.contains(email),
                      !other.contains(email) else { return false }
                return $0.name.lowercased().contains(query) || email.contains(query)
            }.prefix(5)) { contact in
                Button {
                    list.wrappedValue.append(contact.email!.lowercased())
                    text.wrappedValue = ""
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(contact.name).foregroundStyle(.primary)
                        Text(contact.email ?? "").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private func add(_ text: Binding<String>, to list: Binding<[String]>) {
        let parts = text.wrappedValue
            .split(whereSeparator: { " ,;\n".contains($0) })
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
        let bad = parts.filter { !Self.isEmail($0) }
        for address in parts where Self.isEmail(address) && !list.wrappedValue.contains(address) {
            list.wrappedValue.append(address)
        }
        text.wrappedValue = bad.joined(separator: " ")
        if let first = bad.first { errorMessage = "Indirizzo non valido: \(first)" }
    }

    private static func isEmail(_ s: String) -> Bool {
        s.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
    }

    private var isValid: Bool {
        !subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: Inviata

    private func sentView(_ sent: Sent) -> some View {
        Form {
            Section {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Preventivo inviato").font(.headline)
                        Text("\(sent.recipients) \(sent.recipients == 1 ? "destinatario" : "destinatari") · la trovi anche in “Inviati” su Gmail")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).font(.title2)
                }
            }
            if let pin = sent.pin {
                Section {
                    HStack {
                        Text(Self.formatPin(pin))
                            .font(.title.monospaced().weight(.bold))
                            .kerning(4)
                        Spacer()
                        Button("Copia", systemImage: "doc.on.doc") { UIPasteboard.general.string = pin }
                            .labelStyle(.iconOnly)
                    }
                } header: {
                    Text("Codice da comunicare al cliente")
                } footer: {
                    Text("Per sicurezza viene mostrato solo ora: annotalo prima di chiudere.")
                }
            }
        }
    }

    private static func formatPin(_ pin: String) -> String {
        pin.count == 6 ? "\(pin.prefix(3)) \(pin.suffix(3))" : pin
    }

    // MARK: Barra

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        if sent != nil {
            ToolbarItem(placement: .confirmationAction) {
                Button("Fine", systemImage: "checkmark") { dismiss() }
            }
        } else {
            ToolbarItem(placement: .cancellationAction) {
                Button("Annulla", systemImage: "xmark") { dismiss() }.disabled(sending)
            }
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    Task { await send() }
                } label: {
                    if sending { ProgressView() } else { Label("Invia", systemImage: "paperplane.fill") }
                }
                .buttonStyle(.glassProminent)
                .disabled(sending || draft?.configured != true || to.isEmpty || !isValid)
            }
        }
    }

    // MARK: Rete

    private func body(previewing: Bool = false) -> [String: Any?] {
        [
            "to": to.isEmpty && previewing ? ["anteprima@example.com"] : to,
            "copies": copies,
            "copyMode": copyMode,
            "subject": subject,
            "message": message,
            "notes": notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes,
            "pinMode": pinMode,
            "newPin": pinMode == "personal" && newPin,
            "linkDays": linkDays,
        ]
    }

    private func load() async {
        guard draft == nil else { return }
        do {
            let d: EmailDraft = try await api.get("/api/quotes/\(quoteID)/email")
            draft = d
            to = d.to.map { $0.email.lowercased() }
            subject = d.subject
            message = d.message
            linkDays = d.link.days
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func checkNotes() async {
        checking = true
        defer { checking = false }
        do {
            let result: Proofread = try await api.send("POST", "/api/ai/proofread", json: ["text": notes])
            if result.changes.isEmpty { errorMessage = "Nessun errore trovato." } else { proof = result }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func preview() async {
        previewing = true
        defer { previewing = false }
        do {
            let result: PreviewResult = try await api.send("POST", "/api/quotes/\(quoteID)/email?preview=1",
                                                           json: body(previewing: true))
            previewHTML = result.html
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func send() async {
        sending = true
        defer { sending = false }
        do {
            let result: SendResult = try await api.send("POST", "/api/quotes/\(quoteID)/email", json: body())
            editor.applyEmailSent(status: QuoteStatus(rawValue: result.status) ?? .sent,
                                  token: result.link?.token, expiresAt: result.link?.expiresAt)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            sent = Sent(recipients: result.recipients, pin: result.pin)
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: Modelli

private struct EmailDraft: Decodable {
    struct From: Decodable { let name: String; let address: String }
    struct Recipient: Decodable { let name: String; let email: String }
    struct Contact: Decodable, Identifiable { let id: String; let name: String; let email: String? }
    struct Link: Decodable { let active: Bool; let expiresAt: String?; let days: Int }
    let configured: Bool
    let from: From
    let subject: String
    let message: String
    let to: [Recipient]
    let contacts: [Contact]
    let status: String
    let closed: Bool
    let link: Link
}

private struct Proofread: Decodable {
    struct Change: Decodable { let from: String; let to: String }
    let corrected: String
    let changes: [Change]
}

private struct PreviewResult: Decodable { let html: String }

private struct SendResult: Decodable {
    struct NewLink: Decodable { let token: String; let expiresAt: String? }
    let recipients: Int
    let status: String
    let pin: String?
    let link: NewLink?
}

private struct Sent { let recipients: Int; let pin: String? }

private struct HTMLBox: Hashable { let html: String }

/// Anteprima della mail com'è (HTML del server), senza script né rete esterna
/// oltre alle immagini.
private struct EmailPreview: UIViewRepresentable {
    let html: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = false
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .white
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        let viewport = #"<meta name="viewport" content="width=device-width, initial-scale=1">"#
        view.loadHTMLString(viewport + html, baseURL: nil)
    }
}
