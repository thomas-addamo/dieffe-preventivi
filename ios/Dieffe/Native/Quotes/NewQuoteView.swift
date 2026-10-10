import SwiftUI

/// Nuovo preventivo: titolo, cliente, indirizzo del cantiere. Il resto si
/// compila nell'editor, che si apre appena il preventivo è creato.
struct NewQuoteView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var client: ClientRef?
    @State private var address = ""
    @State private var saving = false
    @State private var error: String?
    @FocusState private var titleFocused: Bool

    private var trimmedTitle: String { title.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Titolo", text: $title, prompt: Text("Es. Ristrutturazione appartamento"), axis: .vertical)
                        .focused($titleFocused)
                        .submitLabel(.next)
                } header: {
                    Text("Titolo")
                } footer: {
                    Text("Bastano titolo e cliente: sezioni, voci e prezzi si compilano nell'editor.")
                }

                Section("Cliente") {
                    NavigationLink {
                        ClientPickerView(selection: $client)
                    } label: {
                        if let client {
                            Label {
                                Text(client.name)
                            } icon: {
                                InitialsAvatar(name: client.name, size: 28)
                            }
                        } else {
                            Label("Scegli un cliente", systemImage: "person.crop.circle.badge.plus")
                                .foregroundStyle(Color.accentColor)
                        }
                    }
                    if client != nil {
                        Button("Nessun cliente", systemImage: "xmark.circle", role: .destructive) { client = nil }
                    }
                }

                Section("Cantiere") {
                    TextField("Indirizzo del cantiere", text: $address, prompt: Text("Via Roma 1, Torino"))
                        .textContentType(.fullStreetAddress)
                }

                Section {
                    Button {
                        dismiss()
                        Task {
                            try? await Task.sleep(for: .milliseconds(450))
                            model.showImport = true
                        }
                    } label: {
                        Label("Importa da un file (PDF, Word, Excel)", systemImage: "doc.viewfinder")
                    }
                } footer: {
                    Text("Hai già il preventivo in un documento? L'AI ne ricava sezioni, voci e cliente.")
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Nuovo preventivo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("Crea", systemImage: "checkmark") { create() }
                            .disabled(trimmedTitle.isEmpty)
                    }
                }
            }
            .interactiveDismissDisabled(saving || !trimmedTitle.isEmpty)
        }
        .onAppear {
            client = model.newQuoteClient
            titleFocused = true
        }
    }

    private func create() {
        saving = true
        error = nil
        let address = address.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            defer { saving = false }
            do {
                let created: CreatedID = try await APIClient.shared.send("POST", "/api/quotes", json: [
                    "title": trimmedTitle,
                    "clientId": client?.id,
                    "projectAddress": address.isEmpty ? nil : address,
                ])
                model.quoteToOpen = created.id
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

/// Elenco clienti con ricerca, da cui scegliere (o creare) il cliente.
struct ClientPickerView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Binding var selection: ClientRef?
    @State private var search = ""
    @State private var showNewClient = false

    private var clients: [ClientRef] {
        let all = (model.home.data?.clients ?? []).sorted { $0.name.localizedCompare($1.name) == .orderedAscending }
        let needle = search.trimmingCharacters(in: .whitespaces)
        return needle.isEmpty ? all : all.filter { $0.name.localizedStandardContains(needle) }
    }

    var body: some View {
        List {
            Section {
                Button {
                    showNewClient = true
                } label: {
                    Label("Nuovo cliente", systemImage: "person.badge.plus")
                }
            }
            Section {
                ForEach(clients) { client in
                    Button {
                        selection = client
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            InitialsAvatar(name: client.name, size: 32)
                            Text(client.name)
                                .foregroundStyle(Color.primary)
                            Spacer()
                            if selection?.id == client.id {
                                Image(systemName: "checkmark")
                                    .fontWeight(.semibold)
                                    .foregroundStyle(Color.accentColor)
                            }
                        }
                    }
                }
            }
        }
        .overlay {
            if clients.isEmpty && !search.isEmpty { ContentUnavailableView.search(text: search) }
        }
        .navigationTitle("Cliente")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Cerca cliente")
        .sheet(isPresented: $showNewClient) {
            ClientFormView(editing: nil) { saved in
                selection = ClientRef(id: saved.id, name: saved.name)
                model.dataChanged()
                dismiss()
            }
        }
        .task {
            if model.home.data == nil { await model.home.load() }
        }
    }
}
