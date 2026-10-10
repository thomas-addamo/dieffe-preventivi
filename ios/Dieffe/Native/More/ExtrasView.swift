import SwiftUI

/// Lavori extra (come src/app/(app)/lavori-extra/LavoriExtraClient.tsx): per
/// ogni preventivo i suoi extra, con l'importo separato da quello principale.
struct ExtrasView: View {
    @Environment(AppModel.self) private var model
    @State private var search = ""
    @State private var picking = false

    struct Group: Identifiable {
        let main: QuoteSummary
        let extras: [QuoteSummary]
        var id: String { main.id }
        var extrasTotal: Double { extras.reduce(0) { $0 + $1.total } }
    }

    static func groups(_ quotes: [QuoteSummary]) -> [Group] {
        let byParent = Dictionary(grouping: quotes.filter { $0.isExtra && $0.parentQuoteId != nil }) { $0.parentQuoteId! }
        return quotes.filter { !$0.isExtra && byParent[$0.id] != nil }
            .map { Group(main: $0, extras: byParent[$0.id]!.sorted { $0.createdAt < $1.createdAt }) }
    }

    var body: some View {
        let all = Self.groups(model.home.data?.quotes ?? [])
        let needle = search.trimmingCharacters(in: .whitespaces)
        let groups = needle.isEmpty ? all : all.filter { g in
            ([g.main] + g.extras).contains {
                $0.title.localizedStandardContains(needle) || $0.code.localizedStandardContains(needle)
                    || ($0.clientName?.localizedStandardContains(needle) ?? false)
            }
        }

        List {
            if needle.isEmpty, !all.isEmpty {
                Section {
                    LabeledContent("Preventivi con extra", value: all.count.formatted())
                    LabeledContent("Lavori extra", value: all.reduce(0) { $0 + $1.extras.count }.formatted())
                    LabeledContent("Valore extra") {
                        Text(Format.currency(all.reduce(0) { $0 + $1.extrasTotal })).monospacedDigit()
                    }
                } footer: {
                    Text("Ogni lavoro extra è un preventivo a sé, con le stesse intestazioni del principale e un prezzo proprio.")
                }
            }
            ForEach(groups) { group in
                Section {
                    Button { model.openQuote(group.main.id) } label: { QuoteRow(quote: group.main) }
                        .tint(.primary)
                    ForEach(group.extras) { extra in
                        Button { model.openQuote(extra.id) } label: { QuoteRow(quote: extra) }
                            .tint(.primary)
                            .padding(.leading, 14)
                            .overlay(alignment: .leading) {
                                Capsule().fill(Color.orange.opacity(0.5)).frame(width: 3).padding(.vertical, 4)
                            }
                    }
                } header: {
                    HStack {
                        Text(group.main.clientName ?? "Nessun cliente")
                        Spacer()
                        Text("Extra \(Format.currency(group.extrasTotal))")
                            .monospacedDigit()
                    }
                }
            }
        }
        .overlay {
            if groups.isEmpty {
                if needle.isEmpty {
                    ContentUnavailableView {
                        Label("Nessun lavoro extra", systemImage: "doc.badge.plus")
                    } description: {
                        Text("Un lavoro extra raccoglie le lavorazioni aggiuntive di un preventivo, con un prezzo separato.")
                    } actions: {
                        if model.canEdit {
                            Button("Nuovo lavoro extra") { picking = true }.buttonStyle(.glassProminent)
                        }
                    }
                } else {
                    ContentUnavailableView.search(text: search)
                }
            }
        }
        .navigationTitle("Lavori extra")
        .searchable(text: $search, prompt: "Preventivo, codice o cliente")
        .refreshable { await model.home.load() }
        .toolbar {
            if model.canEdit {
                ToolbarItem(placement: .primaryAction) {
                    Button("Nuovo lavoro extra", systemImage: "plus") { picking = true }
                }
            }
        }
        .sheet(isPresented: $picking) {
            ExtraParentPicker()
        }
    }
}

/// Scelta del preventivo a cui aggiungere un lavoro extra.
private struct ExtraParentPicker: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    @State private var creating: String?
    @State private var error: String?

    var body: some View {
        let needle = search.trimmingCharacters(in: .whitespaces)
        let mains = (model.home.data?.quotes ?? []).filter { !$0.isExtra }.filter {
            needle.isEmpty || $0.title.localizedStandardContains(needle) || $0.code.localizedStandardContains(needle)
                || ($0.clientName?.localizedStandardContains(needle) ?? false)
        }
        NavigationStack {
            List {
                if let error {
                    Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red)
                }
                ForEach(mains) { quote in
                    Button { create(for: quote.id) } label: {
                        HStack {
                            QuoteRow(quote: quote)
                            if creating == quote.id { ProgressView() }
                        }
                    }
                    .tint(.primary)
                    .disabled(creating != nil)
                }
            }
            .navigationTitle("Lavoro extra per…")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Cerca il preventivo")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", systemImage: "xmark") { dismiss() }
                }
            }
        }
    }

    private func create(for parentID: String) {
        creating = parentID
        error = nil
        Task {
            defer { creating = nil }
            do {
                let created: CreatedID = try await APIClient.shared.send("POST", "/api/quotes/\(parentID)/extras")
                dismiss()
                model.dataChanged()
                model.openQuote(created.id)
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
