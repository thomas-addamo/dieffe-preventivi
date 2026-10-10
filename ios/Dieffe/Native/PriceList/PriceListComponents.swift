import SwiftUI

struct PriceRow: View {
    let item: PriceListItem
    var showFlags = true

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 5) {
                    if let code = item.code {
                        Text(code)
                            .font(.caption2.monospaced().weight(.semibold))
                            .foregroundStyle(Color.accentColor)
                    }
                    if showFlags && item.pinned {
                        Image(systemName: "pin.fill").font(.caption2).foregroundStyle(.orange)
                    }
                    if showFlags && !item.isActive {
                        Text("Disattivata")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 5)
                            .background(Color.gray.opacity(0.15), in: Capsule())
                            .foregroundStyle(.secondary)
                    }
                }
                Text(item.description)
                    .font(.subheadline)
                    .foregroundStyle(item.isActive ? Color.primary : Color.secondary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 2) {
                Text(Format.currency(item.unitPrice))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                Text("/ \(item.unitOfMeasure)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 1)
    }
}

enum PriceFilter: String, CaseIterable, Identifiable {
    case active, all, inactive, pinned, unused
    var id: String { rawValue }

    var label: String {
        switch self {
        case .active: "Attive"
        case .all: "Tutte"
        case .inactive: "Disattivate"
        case .pinned: "Fissate"
        case .unused: "Mai usate"
        }
    }

    var symbol: String {
        switch self {
        case .active: "checkmark.circle"
        case .all: "tray.full"
        case .inactive: "eye.slash"
        case .pinned: "pin"
        case .unused: "zzz"
        }
    }

    func matches(_ item: PriceListItem) -> Bool {
        switch self {
        case .active: item.isActive
        case .all: true
        case .inactive: !item.isActive
        case .pinned: item.pinned
        case .unused: item.lastUsedAt == nil
        }
    }
}

/// Catalogo filtrato e raggruppato: categoria › sottocategoria.
struct PriceTree {
    struct Group { let name: String; let items: [PriceListItem] }
    struct Category { let name: String; let groups: [Group]; let count: Int }

    let categories: [Category]

    init(items: [PriceListItem], search: String, filter: PriceFilter, category: String?) {
        let needle = search.trimmingCharacters(in: .whitespaces)
        let visible = items.filter { item in
            guard filter.matches(item) else { return false }
            if let category, item.categoryName != category { return false }
            guard !needle.isEmpty else { return true }
            return item.description.localizedStandardContains(needle)
                || (item.code?.localizedStandardContains(needle) ?? false)
                || (item.subcategory?.localizedStandardContains(needle) ?? false)
        }
        categories = Dictionary(grouping: visible, by: \.categoryName)
            .map { name, list in
                let groups = Dictionary(grouping: list) { $0.subcategory ?? "" }
                    .map { Group(name: $0.key, items: $0.value) }
                    .sorted { ($0.name.isEmpty ? "\u{FFFF}" : $0.name).localizedCompare($1.name.isEmpty ? "\u{FFFF}" : $1.name) == .orderedAscending }
                return Category(name: name, groups: groups, count: list.count)
            }
            .sorted { PriceCatalog.order($0.name) < PriceCatalog.order($1.name) }
    }
}

/// Nuova voce o modifica di una voce del listino.
struct PriceListItemForm: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let editing: PriceListItem?
    @State private var draft: PriceListDraft
    @State private var saving = false
    @State private var error: String?

    init(editing: PriceListItem?, category: String?) {
        self.editing = editing
        _draft = State(initialValue: editing.map(PriceListDraft.init) ?? PriceListDraft(category: category))
    }

    private var subcategories: [String] {
        Set((model.priceList.items ?? []).filter { $0.categoryName == draft.category }.compactMap(\.subcategory))
            .sorted { $0.localizedCompare($1) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Descrizione") {
                    TextField("Descrizione della lavorazione", text: $draft.description, axis: .vertical)
                        .lineLimit(2...8)
                }
                Section("Prezzo") {
                    LabeledContent("Prezzo unitario") {
                        TextField("0,00", value: $draft.unitPrice,
                                  format: .number.precision(.fractionLength(2)).locale(Locale(identifier: "it_IT")))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                    Picker("Unità di misura", selection: $draft.unitOfMeasure) {
                        ForEach(Set(QuoteOptions.units + [draft.unitOfMeasure]).sorted(), id: \.self) { Text($0).tag($0) }
                    }
                }
                Section("Catalogo") {
                    Picker("Categoria", selection: $draft.category) {
                        ForEach(PriceCatalog.categories, id: \.name) { Label($0.name, systemImage: $0.symbol).tag($0.name) }
                    }
                    TextField("Sottocategoria", text: $draft.subcategory, prompt: Text("Es. Gres porcellanato (facoltativa)"))
                    if !subcategories.isEmpty {
                        ScrollView(.horizontal) {
                            HStack {
                                ForEach(subcategories, id: \.self) { sub in
                                    Button(sub) { draft.subcategory = sub }
                                        .buttonStyle(.bordered)
                                        .controlSize(.small)
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                    }
                }
                Section {
                    Toggle("Attiva", isOn: $draft.isActive)
                    Toggle("Fissata", isOn: $draft.pinned)
                } footer: {
                    Text("Le voci fissate non vengono unite né eliminate dal riordino automatico del listino.")
                }
                Section("Note") {
                    TextField("Note", text: $draft.notes, prompt: Text("Note (facoltative)"), axis: .vertical)
                }
                if let error {
                    Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
                }
            }
            .navigationTitle(editing == nil ? "Nuova voce" : "Modifica voce")
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
        }
    }

    private func save() {
        saving = true
        error = nil
        Task {
            defer { saving = false }
            do {
                try await model.priceList.save(draft, editing: editing?.id)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

/// Scelta di una voce del listino da aggiungere al preventivo.
struct PriceListPicker: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let onPick: (QuoteItem) -> Void
    @State private var search = ""
    @State private var category: String?

    var body: some View {
        NavigationStack {
            Group {
                if let items = model.priceList.items {
                    let tree = PriceTree(items: items, search: search, filter: .active, category: category)
                    List {
                        ForEach(tree.categories, id: \.name) { cat in
                            Section {
                                ForEach(cat.groups.flatMap(\.items)) { item in
                                    Button {
                                        onPick(item.asQuoteItem)
                                        dismiss()
                                    } label: {
                                        PriceRow(item: item, showFlags: false)
                                    }
                                    .tint(.primary)
                                }
                            } header: {
                                Label(cat.name, systemImage: PriceCatalog.symbol(for: cat.name))
                            }
                        }
                    }
                    .overlay {
                        if tree.categories.isEmpty { ContentUnavailableView.search(text: search) }
                    }
                } else {
                    LoadingOrError(error: model.priceList.error) { await model.priceList.load() }
                }
            }
            .navigationTitle("Dal listino")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Cerca nel listino")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Picker("Categoria", selection: $category) {
                            Text("Tutte le categorie").tag(String?.none)
                            ForEach(PriceCatalog.categories, id: \.name) { Text($0.name).tag(Optional($0.name)) }
                        }
                    } label: {
                        Label("Categoria", systemImage: category == nil
                              ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                    }
                }
            }
        }
        .task { await model.priceList.loadIfNeeded() }
    }
}
