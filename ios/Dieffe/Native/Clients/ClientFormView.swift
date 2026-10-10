import SwiftUI

/// Nuovo cliente o modifica di uno esistente.
struct ClientFormView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let editing: ClientRecord?
    let onSaved: (ClientRecord) -> Void

    @State private var draft = ClientDraft()
    @State private var saving = false
    @State private var error: String?
    @FocusState private var focus: Field?

    private enum Field { case name, phone, email, vat, address, notes }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nome o ragione sociale", text: $draft.name, prompt: Text("Mario Rossi Srl"))
                        .textContentType(.organizationName)
                        .focused($focus, equals: .name)
                        .submitLabel(.next)
                        .onSubmit { focus = .phone }
                } header: {
                    Text("Nome o ragione sociale")
                }

                Section("Contatti") {
                    TextField("Telefono", text: $draft.phone, prompt: Text("Telefono"))
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .focused($focus, equals: .phone)
                    TextField("Email", text: $draft.email, prompt: Text("Email"))
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focus = .vat }
                    if let emailError = draft.emailError, focus != .email {
                        Label(emailError, systemImage: "exclamationmark.circle.fill")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }

                Section("Dati fiscali e indirizzo") {
                    TextField("P.IVA o codice fiscale", text: $draft.vatNumber, prompt: Text("P.IVA o codice fiscale"))
                        .font(.body.monospaced())
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .vat)
                        .submitLabel(.next)
                        .onSubmit { focus = .address }
                    TextField("Indirizzo", text: $draft.address, prompt: Text("Via Roma 1, 10100 Torino"), axis: .vertical)
                        .textContentType(.fullStreetAddress)
                        .focused($focus, equals: .address)
                }

                Section("Note") {
                    TextField("Note interne", text: $draft.notes, prompt: Text("Note interne…"), axis: .vertical)
                        .lineLimit(3...8)
                        .focused($focus, equals: .notes)
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(editing == nil ? "Nuovo cliente" : "Modifica cliente")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("Salva", systemImage: "checkmark") { save() }
                            .disabled(!draft.isValid)
                    }
                }
            }
            .interactiveDismissDisabled(saving)
        }
        .onAppear {
            if let editing { draft = ClientDraft(editing) } else { focus = .name }
        }
    }

    private func save() {
        saving = true
        error = nil
        Task {
            defer { saving = false }
            do {
                let saved = try await model.clients.save(draft, editing: editing?.id)
                dismiss()
                onSaved(saved)
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
