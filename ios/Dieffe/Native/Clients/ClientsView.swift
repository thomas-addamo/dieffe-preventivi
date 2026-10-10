import SwiftUI

/// Elenco clienti nativo (come src/app/(app)/clienti/ClientiClient.tsx).
struct ClientsView: View {
    @Environment(AppModel.self) private var model
    @State private var search = ""
    @State private var sort: ClientSort = .recent
    @State private var showNew = false
    @State private var pendingDelete: ClientRecord?

    private var store: ClientsStore { model.clients }

    var body: some View {
        @Bindable var model = model

        NavigationStack(path: $model.clientsPath) {
            Group {
                if let clients = store.clients {
                    list(clients)
                } else {
                    LoadingOrError(error: store.error) { await store.load() }
                }
            }
            .navigationTitle("Clienti")
            .navigationDestination(for: String.self) { id in
                ClientDetailView(clientID: id)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Ordina per", selection: $sort) {
                            ForEach(ClientSort.allCases) { Text($0.label).tag($0) }
                        }
                    } label: {
                        Label("Ordina", systemImage: "arrow.up.arrow.down")
                    }
                }
                if model.canEdit {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Nuovo cliente", systemImage: "plus") { showNew = true }
                    }
                }
            }
            .searchable(text: $search, prompt: "Nome, email, telefono, P.IVA")
            .refreshable { await store.load() }
        }
        .task(id: model.dataVersion) { await store.load() }
        .sheet(isPresented: $showNew) {
            ClientFormView(editing: nil) { saved in
                model.dataChanged()
                model.clientsPath.append(saved.id)
            }
        }
        .confirmationDialog(
            "Eliminare \(pendingDelete?.name ?? "")?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { client in
            Button("Elimina cliente", role: .destructive) { delete(client) }
        } message: { client in
            Text(ClientDetailView.deleteWarning(client))
        }
    }

    private func list(_ clients: [ClientRecord]) -> some View {
        let rows = filtered(clients)
        return List {
            Section {
                ForEach(rows) { client in
                    NavigationLink(value: client.id) {
                        ClientRow(client: client)
                    }
                    .swipeActions(edge: .trailing) {
                        if model.canEdit {
                            Button("Elimina", systemImage: "trash") { pendingDelete = client }
                                .tint(.red)
                        }
                    }
                }
            } header: {
                Text(Format.count(rows.count, "cliente", "clienti"))
            }
        }
        .overlay {
            if rows.isEmpty {
                if search.isEmpty {
                    ContentUnavailableView {
                        Label("Nessun cliente", systemImage: "person.2")
                    } description: {
                        Text("Aggiungi il primo cliente con il tasto ＋.")
                    }
                } else {
                    ContentUnavailableView.search(text: search)
                }
            }
        }
    }

    private func filtered(_ clients: [ClientRecord]) -> [ClientRecord] {
        let needle = search.trimmingCharacters(in: .whitespaces)
        let base = needle.isEmpty ? clients : clients.filter { c in
            [c.name, c.email, c.phone, c.vatNumber, c.address].contains { $0?.localizedStandardContains(needle) ?? false }
                || c.quotes.contains { $0.code.localizedStandardContains(needle) || $0.title.localizedStandardContains(needle) }
        }
        return base.sorted(by: sort.areInOrder)
    }

    private func delete(_ client: ClientRecord) {
        Task {
            do {
                try await store.delete(client)
                model.dataChanged()
            } catch {
                model.lastError = error.localizedDescription
            }
        }
    }
}

private struct ClientRow: View {
    let client: ClientRecord

    var body: some View {
        HStack(spacing: 12) {
            InitialsAvatar(name: client.name)
            VStack(alignment: .leading, spacing: 2) {
                Text(client.name)
                    .font(.body.weight(.semibold))
                    .lineLimit(1)
                if let detail = client.email ?? client.phone ?? client.address {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 2) {
                Text(Format.count(client.quotes.count, "preventivo", "preventivi"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if client.acceptedValue > 0 {
                    Text(Format.currency(client.acceptedValue))
                        .font(.caption.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(.green)
                }
            }
        }
    }
}

enum ClientSort: String, CaseIterable, Identifiable {
    case recent, name, quotes, value

    var id: String { rawValue }

    var label: String {
        switch self {
        case .recent: "Aggiunti di recente"
        case .name: "Nome (A→Z)"
        case .quotes: "Più preventivi"
        case .value: "Valore accettato"
        }
    }

    func areInOrder(_ a: ClientRecord, _ b: ClientRecord) -> Bool {
        switch self {
        case .recent: a.createdAt > b.createdAt
        case .name: a.name.localizedCompare(b.name) == .orderedAscending
        case .quotes: a.quotes.count > b.quotes.count
        case .value: a.acceptedValue > b.acceptedValue
        }
    }
}
