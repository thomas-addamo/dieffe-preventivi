import SwiftUI

/// Cestino (come src/app/(app)/cestino/page.tsx): i preventivi eliminati
/// restano 30 giorni. Si ripristinano (tornano in Bozza) o, se sei
/// amministratore, si eliminano per sempre.
struct TrashView: View {
    @Environment(AppModel.self) private var model
    @State private var items: [TrashedQuote]?
    @State private var error: String?
    @State private var pendingDelete: TrashedQuote?
    @State private var working: String?

    private var isAdmin: Bool { model.currentUser?.role == "admin" }

    var body: some View {
        Group {
            if let items {
                List {
                    Section {
                        ForEach(items) { item in
                            row(item)
                                .swipeActions(edge: .leading) {
                                    Button("Ripristina", systemImage: "arrow.uturn.backward") { restore(item) }
                                        .tint(.green)
                                }
                                .swipeActions(edge: .trailing) {
                                    if isAdmin {
                                        Button("Elimina", systemImage: "trash.slash") { pendingDelete = item }
                                            .tint(.red)
                                    }
                                }
                                .contextMenu {
                                    Button("Ripristina", systemImage: "arrow.uturn.backward") { restore(item) }
                                    if isAdmin {
                                        Button("Elimina definitivamente", systemImage: "trash.slash", role: .destructive) {
                                            pendingDelete = item
                                        }
                                    }
                                }
                        }
                    } footer: {
                        if !items.isEmpty {
                            Text("Scorri a destra per ripristinare\(isAdmin ? ", a sinistra per eliminare per sempre" : ""). Dopo 30 giorni i preventivi vengono eliminati in automatico.")
                        }
                    }
                }
                .overlay {
                    if items.isEmpty {
                        ContentUnavailableView("Il cestino è vuoto", systemImage: "trash",
                                               description: Text("I preventivi eliminati restano qui per 30 giorni."))
                    }
                }
            } else {
                LoadingOrError(error: error) { await load() }
            }
        }
        .navigationTitle("Cestino")
        .refreshable { await load() }
        .task { await load() }
        .confirmationDialog(
            "Eliminare per sempre \(pendingDelete?.code ?? "")?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { item in
            Button("Elimina definitivamente", role: .destructive) { deleteForever(item) }
        } message: { _ in
            Text("Il preventivo, le sue voci e le foto verranno eliminati. Non si può annullare.")
        }
    }

    private func row(_ item: TrashedQuote) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.code)
                    .font(.caption.monospaced().weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(item.title)
                    .font(.body.weight(.semibold))
                    .lineLimit(2)
                Text([item.clientName, item.deletedAt.map { "eliminato il \(Format.date($0))" }]
                    .compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            if working == item.id {
                ProgressView()
            } else {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(item.daysRemaining)")
                        .font(.title3.weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(item.daysRemaining <= 7 ? .red : .secondary)
                    Text(item.daysRemaining == 1 ? "giorno" : "giorni")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func load() async {
        do {
            items = try await APIClient.shared.get("/api/quotes/trash")
            error = nil
        } catch APIError.unauthorized {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error.localizedDescription
        }
    }

    private func restore(_ item: TrashedQuote) {
        run(item) {
            try await APIClient.shared.send("POST", "/api/quotes/\(item.id)/restore", as: Empty.self)
        }
    }

    private func deleteForever(_ item: TrashedQuote) {
        run(item) { try await APIClient.shared.delete("/api/quotes/\(item.id)/permanent") }
    }

    private func run(_ item: TrashedQuote, _ work: @escaping () async throws -> Void) {
        working = item.id
        Task {
            defer { working = nil }
            do {
                try await work()
                withAnimation { items?.removeAll { $0.id == item.id } }
                model.dataChanged()
            } catch {
                model.lastError = error.localizedDescription
            }
        }
    }
}
