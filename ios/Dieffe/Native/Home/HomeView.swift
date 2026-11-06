import SwiftUI

/// Home nativa: il mese in corso, riquadri rapidi, "Da seguire", aperti di
/// recente e archivio preventivi con filtri per stato (dati come la dashboard
/// del sito, src/app/(app)/dashboard/DashboardClient.tsx; grafica in HomeDashboard).
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
            .searchable(text: $search, placement: .navigationBarDrawer, prompt: "Titolo, codice o cliente")
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
        // Ricerca e cliente nascondono la panoramica; lo stato (filtri rapidi) no.
        let searching = !search.isEmpty || clientFilter != nil
        let insights = HomeInsights(data.quotes)
        let counts = Dictionary(grouping: data.quotes, by: \.status).mapValues(\.count)

        return ScrollViewReader { proxy in
            List {
                if let expiry = AppConfig.signatureExpiry, expiry.timeIntervalSinceNow < 2 * 86400 {
                    Section {
                        Label("La firma dell'app scade \(expiry.formatted(.relative(presentation: .named))). Tieni l'iPhone sulla stessa Wi‑Fi del Mac o collegalo: il Mac la rinnova da solo.",
                              systemImage: "clock.badge.exclamationmark")
                            .font(.subheadline)
                            .foregroundStyle(.orange)
                    }
                }
                if !searching {
                    Section {
                        MonthHeroCard(insights: insights)
                    }
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowBackground(Color.clear)

                    Section {
                        HStack(spacing: 10) {
                            KPITile(symbol: "paperplane.fill", colors: [.init(hex: 0x38BDF8), .init(hex: 0x2563EB)],
                                    value: "\(insights.pending)", label: "In attesa",
                                    detail: insights.pendingValue > 0 ? CompactMoney.format(insights.pendingValue) : nil) {
                                showArchive(.sent, proxy)
                            }
                            KPITile(symbol: "pencil", colors: [.init(hex: 0xA3A3A3), .init(hex: 0x52525B)],
                                    value: "\(insights.drafts)", label: "Bozze",
                                    detail: insights.staleDrafts.isEmpty ? nil : "\(insights.staleDrafts.count) ferme") {
                                showArchive(.draft, proxy)
                            }
                            KPITile(symbol: "person.2.fill", colors: [.init(hex: 0xC084FC), .init(hex: 0x7C3AED)],
                                    value: "\(data.stats.clients)", label: "Clienti", detail: nil) {
                                model.select(.clienti)
                            }
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowBackground(Color.clear)

                    let followUps = Array((insights.waiting + insights.staleDrafts).prefix(4))
                    if !followUps.isEmpty {
                        Section {
                            ForEach(followUps) { item in
                                FollowUpRow(item: item) { model.openQuote(item.quote.id) }
                            }
                        } header: {
                            Label("Da seguire", systemImage: "bell.and.waves.left.and.right")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                                .textCase(nil)
                        } footer: {
                            Text("Inviati senza risposta da più di \(HomeInsights.followUpDays) giorni e bozze ferme da più di \(HomeInsights.staleDraftDays).")
                        }
                    }

                    let recent = model.recents.ids.compactMap { id in data.quotes.first { $0.id == id } }.prefix(6)
                    if !recent.isEmpty {
                        Section {
                            ScrollView(.horizontal) {
                                HStack(spacing: 10) {
                                    ForEach(Array(recent)) { quote in
                                        RecentQuoteCard(quote: quote) { model.openQuote(quote.id) }
                                    }
                                }
                                .padding(.horizontal, 16)
                            }
                            .scrollIndicators(.hidden)
                        } header: {
                            Text("Aperti di recente")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                                .textCase(nil)
                                .padding(.horizontal, 16)
                        }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    }
                }

                Section {
                    StatusChips(selection: $statusFilter, counts: counts)
                } header: {
                    HStack {
                        Text("Archivio")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(.primary)
                        Spacer()
                        Text(Format.count(groups.count, "preventivo", "preventivi"))
                            .font(.footnote)
                            .monospacedDigit()
                    }
                    .textCase(nil)
                    .padding(.horizontal, 20)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .id("archive")

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
                }
            }
            .listStyle(.insetGrouped)
            .listSectionSpacing(14)
            .scrollContentBackground(.hidden)
            .background { HomeBackground() }
            .overlay {
                if groups.isEmpty, searching || statusFilter == nil {
                    if searching {
                        ContentUnavailableView.search(text: search)
                    } else if data.quotes.isEmpty {
                        ContentUnavailableView {
                            Label("Nessun preventivo", systemImage: "doc.text")
                        } description: {
                            Text("Crea il tuo primo preventivo con il tasto ＋.")
                        }
                    }
                }
            }
            .animation(.default, value: expanded)
            .animation(.snappy, value: statusFilter)
        }
    }

    /// Dai riquadri rapidi: filtra l'archivio per stato e ci scorre.
    private func showArchive(_ status: QuoteStatus, _ proxy: ScrollViewProxy) {
        withAnimation(.snappy) { statusFilter = status }
        withAnimation(.smooth) { proxy.scrollTo("archive", anchor: .top) }
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
                DestructiveButton("Sposta nel cestino", systemImage: "trash") { pendingTrash = quote }
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
            // Il ＋ in un cerchio blu, staccato da campanella e filtri.
            ToolbarSpacer(.fixed, placement: .topBarTrailing)
            ToolbarItem(placement: .topBarTrailing) {
                // L'importazione da file è dentro "Nuovo preventivo".
                Button("Nuovo preventivo", systemImage: "plus") { model.newQuote() }
                    .buttonStyle(.glassProminent)
                    .tint(.accentColor)
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
                DestructiveButton("Esci", systemImage: "rectangle.portrait.and.arrow.right") {
                    confirmLogout = true
                }
            }
        } label: {
            // L'iniziale come simbolo di iOS: il tasto resta rotondo e di sistema come
            // gli altri (stessa misura, allineamento e animazione del menu).
            Label("Profilo", systemImage: Self.symbol(for: model.currentUser?.name ?? ""))
                .labelStyle(.iconOnly)
        }
        .accessibilityLabel("Profilo")
    }

    /// "a.circle" per Admin (blu come campanella e filtri); senza lettera latina, la sagoma di persona.
    static func symbol(for name: String) -> String {
        guard let letter = name.trimmingCharacters(in: .whitespaces).first?.lowercased(),
              letter.count == 1, ("a"..."z").contains(letter) else { return "person.crop.circle" }
        return "\(letter).circle"
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
