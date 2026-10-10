import SwiftUI

/// Home nativa: saluto, statistiche, aperti di recente e archivio preventivi
/// (come la dashboard del sito, src/app/(app)/dashboard/DashboardClient.tsx).
struct HomeView: View {
    @Environment(AppModel.self) private var model

    @State private var search = ""
    @State private var statusFilter: QuoteStatus?
    @State private var clientFilter: String?
    @State private var sort: QuoteSort = .recent
    @State private var expanded: Set<String> = []
    @State private var pendingTrash: QuoteSummary?
    @State private var confirmLogout = false

    private var store: HomeStore { model.home }

    var body: some View {
        NavigationStack {
            Group {
                if let data = store.data {
                    list(data)
                } else {
                    LoadingOrError(error: store.error) { await store.load() }
                }
            }
            .navigationTitle("Preventivi")
            .navigationSubtitle(greeting)
            .toolbar { toolbar }
            .searchable(text: $search, prompt: "Titolo, codice o cliente")
            .refreshable { await store.load() }
        }
        .confirmationDialog(
            "Spostare \(pendingTrash?.code ?? "") nel cestino?",
            isPresented: Binding(get: { pendingTrash != nil }, set: { if !$0 { pendingTrash = nil } }),
            titleVisibility: .visible,
            presenting: pendingTrash
        ) { quote in
            Button("Sposta nel cestino", role: .destructive) { trash(quote) }
        } message: { _ in
            Text("Si può recuperare da Altro › Cestino.")
        }
        .confirmationDialog("Vuoi uscire?", isPresented: $confirmLogout, titleVisibility: .visible) {
            Button("Esci", role: .destructive) { Task { await model.logout() } }
        } message: {
            Text("Per rientrare servono email e password.")
        }
    }

    // MARK: Elenco

    private func list(_ data: HomeData) -> some View {
        let groups = QuoteGroup.make(data.quotes, search: search, status: statusFilter,
                                     client: clientFilter, sort: sort)
        let filtering = !search.isEmpty || statusFilter != nil || clientFilter != nil

        return List {
            if !filtering {
                Section {
                    StatsGrid(stats: data.stats)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)

                let recent = model.recents.ids.compactMap { id in data.quotes.first { $0.id == id } }.prefix(6)
                if !recent.isEmpty {
                    Section("Aperti di recente") {
                        ScrollView(.horizontal) {
                            HStack(spacing: 10) {
                                ForEach(Array(recent)) { quote in
                                    RecentCard(quote: quote) { model.openQuote(quote.id) }
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }

            Section {
                ForEach(groups) { group in
                    row(group.quote, extras: group.extras.isEmpty ? nil : group.extras)
                    if expanded.contains(group.id) {
                        ForEach(group.extras) { extra in
                            row(extra, extras: nil)
                                .padding(.leading, 18)
                                .overlay(alignment: .leading) {
                                    Capsule().fill(Color.orange.opacity(0.5)).frame(width: 3).padding(.vertical, 4)
                                }
                        }
                    }
                }
            } header: {
                HStack {
                    Text("Archivio preventivi")
                    Spacer()
                    Text(Format.count(groups.count, "preventivo", "preventivi"))
                        .textCase(nil)
                        .monospacedDigit()
                }
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if groups.isEmpty {
                if filtering {
                    ContentUnavailableView.search(text: search)
                } else {
                    ContentUnavailableView {
                        Label("Nessun preventivo", systemImage: "doc.text")
                    } description: {
                        Text("Crea il tuo primo preventivo con il tasto ＋.")
                    }
                }
            }
        }
        .animation(.default, value: expanded)
    }

    private func row(_ quote: QuoteSummary, extras: [QuoteSummary]?) -> some View {
        Button {
            model.openQuote(quote.id)
        } label: {
            QuoteRow(quote: quote, extras: extras.map { list in
                (list.count, expanded.contains(quote.id), {
                    if expanded.contains(quote.id) { expanded.remove(quote.id) } else { expanded.insert(quote.id) }
                })
            })
        }
        .tint(.primary)
        .swipeActions(edge: .trailing) {
            if model.canEdit {
                Button("Cestino", systemImage: "trash") { pendingTrash = quote }
                    .tint(.red)
            }
        }
        .contextMenu {
            Button("Apri", systemImage: "arrow.up.right.square") { model.openQuote(quote.id) }
            if model.canEdit {
                Button("Sposta nel cestino", systemImage: "trash", role: .destructive) { pendingTrash = quote }
            }
        }
    }

    // MARK: Barra

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            ProfileMenu(confirmLogout: $confirmLogout)
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                model.showNotifications = true
            } label: {
                Label("Notifiche", systemImage: model.unreadNotifications > 0 ? "bell.badge.fill" : "bell")
            }
            .badge(model.unreadNotifications)
            .accessibilityValue(model.unreadNotifications > 0 ? "\(model.unreadNotifications) da leggere" : "")
        }
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Picker("Stato", selection: $statusFilter) {
                    Text("Tutti gli stati").tag(QuoteStatus?.none)
                    ForEach(QuoteStatus.allCases) { status in
                        Label(status.label, systemImage: status.symbol).tag(Optional(status))
                    }
                }
                .pickerStyle(.menu)
                Picker("Cliente", selection: $clientFilter) {
                    Text("Tutti i clienti").tag(String?.none)
                    ForEach(clientNames, id: \.self) { Text($0).tag(Optional($0)) }
                }
                .pickerStyle(.menu)
                Picker("Ordina per", selection: $sort) {
                    ForEach(QuoteSort.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.menu)
                if statusFilter != nil || clientFilter != nil {
                    Divider()
                    Button("Rimuovi filtri", systemImage: "xmark.circle") {
                        statusFilter = nil
                        clientFilter = nil
                    }
                }
            } label: {
                Label("Filtri", systemImage: statusFilter != nil || clientFilter != nil
                      ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
            }
        }
        if model.canEdit {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Nuovo preventivo", systemImage: "doc.badge.plus") { model.newQuote() }
                    Button("Importa da file", systemImage: "doc.viewfinder") { model.showImport = true }
                } label: {
                    Label("Nuovo", systemImage: "plus")
                } primaryAction: {
                    model.newQuote()
                }
            }
        }
    }

    // MARK: Supporto

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let salute = hour < 13 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera"
        guard let name = model.currentUser?.firstName else { return "Dieffe" }
        return "\(salute), \(name)"
    }

    private var clientNames: [String] {
        Set(store.data?.quotes.compactMap(\.clientName) ?? []).sorted { $0.localizedCompare($1) == .orderedAscending }
    }

    private func trash(_ quote: QuoteSummary) {
        Task {
            do {
                try await store.trash(quote)
                model.dataChanged()
            } catch {
                model.lastError = error.localizedDescription
            }
        }
    }
}

// MARK: - Profilo

/// Tasto profilo in alto a sinistra: profilo, impostazioni, listino, esci.
private struct ProfileMenu: View {
    @Environment(AppModel.self) private var model
    @Binding var confirmLogout: Bool

    var body: some View {
        Menu {
            if let user = model.currentUser {
                Section(user.name) {
                    Button("Profilo", systemImage: "person.crop.circle") { model.showProfile = true }
                }
            }
            Section {
                Button("Listino prezzi", systemImage: "list.bullet.rectangle") { model.select(.listino) }
                Button("Impostazioni app", systemImage: "gearshape") { model.showSettings = true }
                if model.currentUser?.role == "admin" {
                    Button("Impostazioni azienda", systemImage: "building.2") {
                        model.open(.company)
                    }
                }
            }
            Section {
                Button("Esci", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                    confirmLogout = true
                }
            }
        } label: {
            InitialsAvatar(name: model.currentUser?.name ?? "", size: 32)
        }
        .accessibilityLabel("Profilo")
    }
}

// MARK: - Statistiche

private struct StatsGrid: View {
    let stats: HomeData.Stats

    var body: some View {
        Grid(horizontalSpacing: 12, verticalSpacing: 12) {
            GridRow {
                StatTile(symbol: "doc.text", label: "Preventivi totali", value: stats.total, color: .blue)
                StatTile(symbol: "chart.line.uptrend.xyaxis", label: "Accettati questo mese",
                         value: stats.acceptedThisMonth, color: .green)
            }
            GridRow {
                StatTile(symbol: "clock", label: "In attesa di risposta", value: stats.pending, color: .orange)
                StatTile(symbol: "person.2", label: "Clienti", value: stats.clients, color: .purple)
            }
        }
    }
}

private struct StatTile: View {
    let symbol: String
    let label: String
    let value: Int
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 32, height: 32)
                .background(color.opacity(0.14), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(value, format: .number)
                    .font(.title2.weight(.bold))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

private struct RecentCard: View {
    let quote: QuoteSummary
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(quote.code)
                        .font(.caption2.monospaced().weight(.semibold))
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 4)
                    StatusBadge(status: quote.status)
                }
                Text(quote.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2, reservesSpace: true)
                    .multilineTextAlignment(.leading)
                Text(quote.clientName ?? "Nessun cliente")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(width: 190, alignment: .leading)
            .padding(14)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Raggruppamento e ordinamento

enum QuoteSort: String, CaseIterable, Identifiable {
    case recent, updated, oldest, value, code, client

    var id: String { rawValue }

    var label: String {
        switch self {
        case .recent: "Più recenti"
        case .updated: "Modificati di recente"
        case .oldest: "Meno recenti"
        case .value: "Importo più alto"
        case .code: "Codice"
        case .client: "Cliente (A→Z)"
        }
    }

    func areInOrder(_ a: QuoteSummary, _ b: QuoteSummary) -> Bool {
        switch self {
        case .recent: a.createdAt > b.createdAt
        case .updated: a.updatedAt > b.updatedAt
        case .oldest: a.createdAt < b.createdAt
        case .value: a.total > b.total
        case .code: a.code.localizedStandardCompare(b.code) == .orderedDescending
        case .client: (a.clientName ?? "\u{FFFF}").localizedCompare(b.clientName ?? "\u{FFFF}") == .orderedAscending
        }
    }
}

/// Un preventivo con i suoi lavori extra (che non sono righe a sé).
struct QuoteGroup: Identifiable {
    let quote: QuoteSummary
    let extras: [QuoteSummary]
    var id: String { quote.id }

    static func make(_ quotes: [QuoteSummary], search: String, status: QuoteStatus?,
                     client: String?, sort: QuoteSort) -> [QuoteGroup] {
        let ids = Set(quotes.map(\.id))
        let isChild = { (q: QuoteSummary) in q.isExtra && q.parentQuoteId.map(ids.contains) == true }
        let extrasByParent = Dictionary(grouping: quotes.filter(isChild)) { $0.parentQuoteId ?? "" }
        let needle = search.trimmingCharacters(in: .whitespaces)

        func matches(_ q: QuoteSummary) -> Bool {
            if !needle.isEmpty {
                let hit = q.title.localizedStandardContains(needle) || q.code.localizedStandardContains(needle)
                    || (q.clientName?.localizedStandardContains(needle) ?? false)
                if !hit { return false }
            }
            if let status, q.status != status { return false }
            if let client, q.clientName != client { return false }
            return true
        }

        return quotes
            .filter { !isChild($0) }
            .map { QuoteGroup(quote: $0, extras: (extrasByParent[$0.id] ?? []).sorted { $0.createdAt < $1.createdAt }) }
            .filter { matches($0.quote) || $0.extras.contains(where: matches) }
            .sorted { sort.areInOrder($0.quote, $1.quote) }
    }
}
