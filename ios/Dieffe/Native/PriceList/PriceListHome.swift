import SwiftUI

/// Destinazioni della navigazione del Listino.
enum PriceRoute: Hashable {
    case category(String)
    case filter(PriceFilter)
    case item(String)
}

/// Listino nativo, sezione a sé della tab bar: riepilogo, categorie del
/// catalogo, ricerca in tutto il listino. Da una categoria si passa alle
/// sottocategorie e alle voci, da una voce alla sua scheda.
struct PriceListHome: View {
    @Environment(AppModel.self) private var model
    @State private var search = ""
    @State private var creating = false

    private var store: PriceListStore { model.priceList }

    var body: some View {
        @Bindable var model = model

        NavigationStack(path: $model.priceListPath) {
            Group {
                if let items = store.items {
                    if search.trimmingCharacters(in: .whitespaces).isEmpty {
                        overview(items)
                    } else {
                        PriceItemsList(tree: PriceTree(items: items, search: search, filter: .all, category: nil),
                                       showCategoryHeaders: true)
                            .overlay {
                                if PriceTree(items: items, search: search, filter: .all, category: nil).categories.isEmpty {
                                    ContentUnavailableView.search(text: search)
                                }
                            }
                    }
                } else {
                    LoadingOrError(error: store.error) { await store.load() }
                }
            }
            .navigationTitle("Listino")
            .searchable(text: $search, prompt: "Cerca in tutto il listino")
            .refreshable { await store.load() }
            .toolbar {
                if model.canEdit {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Nuova voce", systemImage: "plus") { creating = true }
                    }
                }
            }
            .navigationDestination(for: PriceRoute.self) { route in
                switch route {
                case .category(let name): PriceCategoryView(category: name)
                case .filter(let filter): PriceFilteredView(filter: filter)
                case .item(let id): PriceItemDetail(itemID: id)
                }
            }
        }
        .task { await store.loadIfNeeded() }
        .sheet(isPresented: $creating) {
            PriceListItemForm(editing: nil, category: nil)
        }
    }

    private func overview(_ items: [PriceListItem]) -> some View {
        let counts = Dictionary(grouping: items.filter(\.isActive), by: \.categoryName).mapValues(\.count)
        return List {
            Section {
                Grid(horizontalSpacing: 12, verticalSpacing: 12) {
                    GridRow {
                        SummaryTile(value: items.filter(\.isActive).count, label: "Voci attive",
                                    symbol: "checkmark.circle.fill", color: .green, route: .filter(.active))
                        SummaryTile(value: items.filter(\.pinned).count, label: "Fissate",
                                    symbol: "pin.fill", color: .orange, route: .filter(.pinned))
                    }
                    GridRow {
                        SummaryTile(value: items.filter { $0.lastUsedAt == nil }.count, label: "Mai usate",
                                    symbol: "zzz", color: .purple, route: .filter(.unused))
                        SummaryTile(value: items.filter { !$0.isActive }.count, label: "Disattivate",
                                    symbol: "eye.slash.fill", color: .gray, route: .filter(.inactive))
                    }
                }
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)

            Section {
                ForEach(Array(PriceCatalog.categories.enumerated()), id: \.element.name) { index, category in
                    NavigationLink(value: PriceRoute.category(category.name)) {
                        HStack(spacing: 12) {
                            Image(systemName: category.symbol)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(width: 32, height: 32)
                                .background(PriceCatalog.color(index).gradient,
                                            in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(category.name)
                                Text(category.prefix)
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text((counts[category.name] ?? 0).formatted())
                                .font(.subheadline)
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                        }
                    }
                    .disabled(counts[category.name] == nil)
                }
            } header: {
                Text("Categorie")
            } footer: {
                Text("Le voci sono ordinate come in un computo metrico, dalle demolizioni alle finiture. I codici (es. PAV.02.05) li assegna il listino.")
            }
        }
    }
}

private struct SummaryTile: View {
    @Environment(AppModel.self) private var model
    let value: Int
    let label: String
    let symbol: String
    let color: Color
    let route: PriceRoute

    var body: some View {
        Button {
            model.priceListPath.append(route)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: symbol)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(color)
                    .frame(width: 30, height: 30)
                    .background(color.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                Text(value, format: .number)
                    .font(.title2.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Color.primary)
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// Voci raggruppate (categoria ›) sottocategoria; tocco → scheda della voce.
struct PriceItemsList: View {
    @Environment(AppModel.self) private var model
    let tree: PriceTree
    var showCategoryHeaders = false

    var body: some View {
        List {
            ForEach(tree.categories, id: \.name) { cat in
                if showCategoryHeaders {
                    Section {
                        ForEach(cat.groups.flatMap(\.items)) { row($0) }
                    } header: {
                        Label(cat.name, systemImage: PriceCatalog.symbol(for: cat.name))
                    }
                } else {
                    ForEach(cat.groups, id: \.name) { group in
                        Section {
                            ForEach(group.items) { row($0) }
                        } header: {
                            HStack {
                                Text(group.name.isEmpty ? "Altre voci" : group.name)
                                Spacer()
                                Text(group.items.count.formatted()).monospacedDigit()
                            }
                        }
                    }
                }
            }
        }
    }

    private func row(_ item: PriceListItem) -> some View {
        NavigationLink(value: PriceRoute.item(item.id)) {
            PriceRow(item: item)
        }
        .swipeActions(edge: .leading) {
            if model.canEdit {
                Button(item.pinned ? "Sblocca" : "Fissa", systemImage: item.pinned ? "pin.slash" : "pin") {
                    Task { try? await model.priceList.setFlags(item, pinned: !item.pinned) }
                }
                .tint(.orange)
            }
        }
        .swipeActions(edge: .trailing) {
            if model.canEdit {
                Button(item.isActive ? "Disattiva" : "Attiva", systemImage: item.isActive ? "eye.slash" : "eye") {
                    Task { try? await model.priceList.setFlags(item, active: !item.isActive) }
                }
                .tint(.gray)
            }
        }
    }
}

/// Una categoria: le sue sottocategorie con le voci.
struct PriceCategoryView: View {
    @Environment(AppModel.self) private var model
    let category: String
    @State private var filter: PriceFilter = .active
    @State private var search = ""
    @State private var creating = false

    var body: some View {
        let tree = PriceTree(items: model.priceList.items ?? [], search: search, filter: filter, category: category)
        PriceItemsList(tree: tree)
            .overlay {
                if tree.categories.isEmpty {
                    if search.isEmpty {
                        ContentUnavailableView("Nessuna voce", systemImage: "list.bullet.rectangle",
                                               description: Text("Nessuna voce \(filter.label.lowercased()) in questa categoria."))
                    } else {
                        ContentUnavailableView.search(text: search)
                    }
                }
            }
            .navigationTitle(category)
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, prompt: "Cerca in \(category)")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Picker("Mostra", selection: $filter) {
                            ForEach(PriceFilter.allCases) { Label($0.label, systemImage: $0.symbol).tag($0) }
                        }
                    } label: {
                        Label("Mostra", systemImage: filter == .active
                              ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                    }
                }
                if model.canEdit {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Nuova voce", systemImage: "plus") { creating = true }
                    }
                }
            }
            .sheet(isPresented: $creating) {
                PriceListItemForm(editing: nil, category: category)
            }
    }
}

/// Elenco da un riquadro del riepilogo (attive, fissate, mai usate…).
struct PriceFilteredView: View {
    @Environment(AppModel.self) private var model
    let filter: PriceFilter

    var body: some View {
        PriceItemsList(tree: PriceTree(items: model.priceList.items ?? [], search: "", filter: filter, category: nil),
                       showCategoryHeaders: true)
            .navigationTitle(filter.label)
            .navigationBarTitleDisplayMode(.inline)
    }
}

/// Scheda di una voce del listino.
struct PriceItemDetail: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let itemID: String
    @State private var editing = false
    @State private var confirmDelete = false

    private var item: PriceListItem? { model.priceList.items?.first { $0.id == itemID } }

    var body: some View {
        if let item {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 6) {
                            if let code = item.code {
                                Text(code)
                                    .font(.caption.monospaced().weight(.semibold))
                                    .foregroundStyle(Color.accentColor)
                            }
                            if item.pinned { Label("Fissata", systemImage: "pin.fill").font(.caption).foregroundStyle(.orange) }
                            if !item.isActive { Label("Disattivata", systemImage: "eye.slash").font(.caption).foregroundStyle(.secondary) }
                        }
                        Text(item.description)
                            .font(.title3.weight(.semibold))
                            .textSelection(.enabled)
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(Format.currency(item.unitPrice))
                                .font(.largeTitle.weight(.bold))
                                .monospacedDigit()
                            Text("/ \(item.unitOfMeasure)")
                                .font(.title3)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 6)
                }

                Section("Catalogo") {
                    LabeledContent("Categoria", value: item.categoryName)
                    if let sub = item.subcategory { LabeledContent("Sottocategoria", value: sub) }
                    LabeledContent("Origine", value: sourceLabel(item.source))
                }

                Section("Utilizzo") {
                    LabeledContent("Usata nei preventivi", value: Format.count(item.usageCount, "volta", "volte"))
                    LabeledContent("Ultimo utilizzo", value: item.lastUsedAt.map(Format.date) ?? "Mai")
                }

                if let notes = item.notes {
                    Section("Note") { Text(notes).textSelection(.enabled) }
                }

                if model.canEdit {
                    Section {
                        Toggle("Attiva", isOn: Binding(
                            get: { item.isActive },
                            set: { value in Task { try? await model.priceList.setFlags(item, active: value) } }
                        ))
                        Toggle("Fissata", isOn: Binding(
                            get: { item.pinned },
                            set: { value in Task { try? await model.priceList.setFlags(item, pinned: value) } }
                        ))
                    } footer: {
                        Text("Le voci disattivate non compaiono quando aggiungi voci a un preventivo. Quelle fissate non vengono unite né eliminate dal riordino automatico.")
                    }
                    Section {
                        Button("Elimina voce", systemImage: "trash", role: .destructive) { confirmDelete = true }
                    }
                }
            }
            .navigationTitle(item.code ?? "Voce")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if model.canEdit {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Modifica") { editing = true }
                    }
                }
            }
            .sheet(isPresented: $editing) {
                PriceListItemForm(editing: item, category: nil)
            }
            .confirmationDialog("Eliminare la voce dal listino?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Elimina voce", role: .destructive) {
                    Task {
                        do {
                            try await model.priceList.delete(item)
                            dismiss()
                        } catch {
                            model.lastError = error.localizedDescription
                        }
                    }
                }
            } message: {
                Text("I preventivi già fatti non cambiano.")
            }
        } else {
            ContentUnavailableView("Voce non trovata", systemImage: "questionmark.square.dashed")
        }
    }

    private func sourceLabel(_ source: String?) -> String {
        switch source {
        case "learned": "Appresa dai preventivi"
        case "import": "Importata da file"
        default: "Inserita a mano"
        }
    }
}

extension PriceCatalog {
    private static let palette: [Color] = [.orange, .red, .brown, .gray, .indigo, .teal, .blue, .green,
                                           .cyan, .purple, .pink, .mint, .yellow, .blue, .cyan, .yellow,
                                           .red, .brown, .green, .gray, .orange, .secondary]

    static func color(_ index: Int) -> Color { palette[index % palette.count] }
}
