import MapKit
import SwiftUI

/// Gestione Cantieri (come src/app/(app)/cantieri/CantieriClient.tsx): mappa di
/// Apple con i cantieri, panoramica economica e dei tempi, prossimi eventi,
/// consigli IA ed elenco. I cantieri nascono da soli dai preventivi inviati
/// (in attesa) e accettati (attivi); quelli conclusi o ritirati vanno in
/// Archivio (sola lettura, si riaprono dal cantiere).
struct SitesView: View {
    @Environment(AppModel.self) private var model
    @State private var filter: Filter
    @State private var search = ""
    @State private var selection: String?
    @State private var camera: MapCameraPosition = .automatic

    enum Filter: String, CaseIterable { case active, pending, all, archive }

    init(initialFilter: Filter = .active) {
        _filter = State(initialValue: initialFilter)
    }

    private var store: SitesStore { model.sites }

    var body: some View {
        Group {
            if let data = store.data {
                content(data)
            } else {
                LoadingOrError(error: store.error) { await store.load() }
            }
        }
        .navigationTitle("Cantieri")
        .searchable(text: $search, placement: .navigationBarDrawer, prompt: "Cantiere, cliente o indirizzo")
        .refreshable {
            await store.load()
            if filter == .archive { await store.loadArchive() }
        }
        .task(id: model.dataVersion) { await store.load() }
        .task(id: filter) {
            if filter == .archive, store.archive == nil { await store.loadArchive() }
        }
        .onDisappear { store.stopWatching() }
        .toolbar {
            if store.preparing {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 6) {
                        ProgressView().controlSize(.small)
                        Text("L'IA prepara i cantieri").font(.caption)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    private func content(_ data: SitesOverview) -> some View {
        let needle = search.trimmingCharacters(in: .whitespaces)
        let archived = filter == .archive
        let source = archived ? (store.archive ?? []) : data.sites
        let list = source
            .filter { archived || filter == .all || (filter == .active ? !$0.isPending : $0.isPending) }
            .filter {
                needle.isEmpty || $0.name.localizedStandardContains(needle)
                    || ($0.clientName?.localizedStandardContains(needle) ?? false)
                    || ($0.address?.localizedStandardContains(needle) ?? false)
                    || $0.quotes.contains { $0.code.localizedStandardContains(needle) }
            }
            .sorted {
                archived ? ($0.archivedAt ?? "") > ($1.archivedAt ?? "")
                    : ($0.metrics.health.rank, -$0.metrics.toInvoice) < ($1.metrics.health.rank, -$1.metrics.toInvoice)
            }

        return List {
            if needle.isEmpty {
                Section {
                    SitesMap(sites: data.sites, selection: $selection, camera: $camera)
                        .frame(height: 300)
                        .listRowInsets(EdgeInsets())
                    if let id = selection, let site = data.sites.first(where: { $0.id == id }) {
                        SelectedSiteCard(site: site)
                    }
                }

                Section {
                    KpiGrid(totals: data.totals)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                if !data.upcoming.isEmpty {
                    Section("Prossimi 7 giorni") {
                        ForEach(data.upcoming.prefix(6)) { e in
                            NavigationLink(value: AltroRoute.site(e.siteId, tab: "calendario")) {
                                EventRow(type: SiteEventType(raw: e.type), title: e.title,
                                         subtitle: "\(SiteDate.short(e.date)) · \(SiteText.title(e.siteName))")
                            }
                        }
                    }
                }

                let tips = data.sites.compactMap { s in s.topTip.map { (s, $0) } }
                    .sorted { ($0.1.priority == "alta" ? 0 : 1) < ($1.1.priority == "alta" ? 0 : 1) }
                    .prefix(3)
                if !tips.isEmpty {
                    Section {
                        ForEach(Array(tips), id: \.0.id) { site, tip in
                            NavigationLink(value: AltroRoute.site(site.id, tab: "note")) {
                                TipRow(tip: tip, footer: site.title)
                            }
                        }
                    } header: {
                        Label("Consigli dell'IA", systemImage: "sparkles")
                    }
                }
            }

            Section {
                SiteFilterBar(selection: $filter, items: [
                    .init(value: .active, title: "Attivi", count: data.totals.active, symbol: "hammer"),
                    .init(value: .pending, title: "In attesa", count: data.totals.pending, symbol: "hourglass"),
                    .init(value: .all, title: "Tutti", count: nil, symbol: "square.grid.2x2"),
                    .init(value: .archive, title: "Archivio", count: data.totals.archived, symbol: "archivebox"),
                ])
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            Section {
                if archived, store.archive == nil {
                    if let error = store.archiveError {
                        VStack(alignment: .leading, spacing: 8) {
                            Label(error, systemImage: "wifi.exclamationmark").foregroundStyle(.secondary)
                            Button("Riprova") { Task { await store.loadArchive() } }
                        }
                    } else {
                        HStack(spacing: 10) {
                            ProgressView()
                            Text("Caricamento dell'archivio…").foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, minHeight: 60)
                    }
                } else if list.isEmpty {
                    emptyRow(archived: archived, searching: !needle.isEmpty)
                }
                ForEach(list) { site in
                    NavigationLink(value: AltroRoute.site(site.id, tab: nil)) {
                        SiteRow(site: site)
                    }
                    .contextMenu {
                        if !site.isArchived {
                            Button("Mostra sulla mappa", systemImage: "map") { show(site) }
                        }
                        if let url = SiteLinks.directions(lat: site.lat, lng: site.lng, address: site.address) {
                            Link(destination: url) { Label("Indicazioni", systemImage: "car.fill") }
                        }
                    }
                }
            } footer: {
                if archived, !list.isEmpty {
                    Text("I cantieri in archivio si consultano in sola lettura. Quelli conclusi si possono riaprire dalla loro pagina.")
                }
            }
        }
        .animation(.default, value: filter)
        .overlay {
            if data.sites.isEmpty, (data.totals.archived ?? 0) == 0 {
                ContentUnavailableView {
                    Label("Nessun cantiere", systemImage: "hammer")
                } description: {
                    Text("I cantieri nascono da soli quando un preventivo viene inviato o accettato.")
                }
            }
        }
    }

    @ViewBuilder
    private func emptyRow(archived: Bool, searching: Bool) -> some View {
        let (symbol, text): (String, String) = searching
            ? ("magnifyingglass", "Nessun risultato per «\(search)».")
            : archived ? ("archivebox", "L'archivio è vuoto: qui finiscono i cantieri conclusi e quelli con il preventivo ritirato.")
            : filter == .pending ? ("hourglass", "Nessun preventivo in attesa di risposta.")
            : ("hammer", "Nessun cantiere in corso.")
        VStack(spacing: 8) {
            Image(systemName: symbol).font(.title2).foregroundStyle(.tertiary)
            Text(text).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .accessibilityElement(children: .combine)
    }

    private func show(_ site: SiteListItem) {
        guard let lat = site.lat, let lng = site.lng else { return }
        selection = site.id
        withAnimation {
            camera = .region(MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: lat, longitude: lng),
                                                latitudinalMeters: 1500, longitudinalMeters: 1500))
        }
    }
}

// MARK: Mappa

private struct SitesMap: View {
    let sites: [SiteListItem]
    @Binding var selection: String?
    @Binding var camera: MapCameraPosition

    var body: some View {
        Map(position: $camera, selection: $selection) {
            ForEach(sites.filter { $0.lat != nil && $0.lng != nil }) { site in
                Annotation(site.title, coordinate: CLLocationCoordinate2D(latitude: site.lat!, longitude: site.lng!), anchor: .bottom) {
                    SitePin(site: site, selected: selection == site.id)
                }
                .annotationTitles(.hidden)
                .tag(site.id)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .mapControls {
            MapCompass()
            MapScaleView()
        }
    }
}

private struct SitePin: View {
    let site: SiteListItem
    let selected: Bool

    var body: some View {
        let size: CGFloat = selected ? 38 : 32
        VStack(spacing: 0) {
            Text(site.isPending ? "•" : "\(Int(site.metrics.progress.rounded()))")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .frame(width: size, height: size)
                .background(site.metrics.health.color.gradient, in: Circle())
                .overlay(Circle().stroke(.white, lineWidth: 2.5))
                .shadow(color: .black.opacity(0.25), radius: 4, y: 2)
            Image(systemName: "triangle.fill")
                .font(.system(size: 9))
                .rotationEffect(.degrees(180))
                .foregroundStyle(site.metrics.health.color)
                .offset(y: -3)
        }
        .animation(.spring(duration: 0.25), value: selected)
    }
}

/// Scheda sotto la mappa per il segnaposto scelto.
private struct SelectedSiteCard: View {
    let site: SiteListItem

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(site.title).font(.headline).lineLimit(2)
                    Text([site.clientName, site.address].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
                Spacer()
                HealthBadge(health: site.metrics.health)
            }
            if !site.isPending {
                SiteProgressBar(value: site.metrics.progress, expected: site.metrics.expectedProgress, health: site.metrics.health)
            }
            HStack(spacing: 8) {
                if let url = SiteLinks.directions(lat: site.lat, lng: site.lng, address: site.address) {
                    Link(destination: url) {
                        Label("Indicazioni", systemImage: "car.fill").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glassProminent)
                }
                if let phone = site.clientPhone, let url = URL(string: "tel:\(phone.filter { !$0.isWhitespace })") {
                    Link(destination: url) { Image(systemName: "phone.fill") }
                        .buttonStyle(.glass)
                }
                NavigationLink(value: AltroRoute.site(site.id, tab: nil)) {
                    Text("Apri").frame(maxWidth: .infinity)
                }
                .buttonStyle(.glass)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: Panoramica

private struct KpiGrid: View {
    let totals: SitesOverview.Totals

    var body: some View {
        let invoicedPct = totals.milestonesTotal > 0 ? totals.invoiced / totals.milestonesTotal * 100 : 0
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            Kpi(title: "Da fatturare", value: Format.currency(totals.toInvoice), symbol: "doc.text.fill",
                tint: totals.toInvoice > 0 ? .orange : .accentColor, footer: "SAL raggiunti (+ IVA)")
            Kpi(title: "Lavori in corso", value: Format.currency(totals.inProgressValue), symbol: "eurosign.circle.fill",
                tint: .accentColor, footer: "\(totals.active) attivi, imponibile")
            Kpi(title: "Fatturato", value: Format.currency(totals.invoiced), symbol: "checkmark.seal.fill",
                tint: .green, footer: "\(Int(invoicedPct.rounded()))% dei SAL · da incassare \(Format.currency(totals.toCollect))")
            Kpi(title: "In ritardo", value: "\(totals.late)", symbol: "exclamationmark.triangle.fill",
                tint: totals.late > 0 ? .red : .green,
                footer: totals.late > 0 ? "Costo stimato \(Format.currency(totals.delayCost))" : "Tutti nei tempi")
        }
    }
}

private struct Kpi: View {
    let title: String
    let value: String
    let symbol: String
    let tint: Color
    let footer: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: symbol)
                .font(.caption.weight(.medium))
                .foregroundStyle(tint)
            Text(value)
                .font(.title3.weight(.bold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(footer)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

// MARK: Righe e componenti condivisi

struct SiteRow: View {
    let site: SiteListItem

    var body: some View {
        let m = site.metrics
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(site.title)
                    .font(.body.weight(.semibold))
                    .lineLimit(2)
                Spacer(minLength: 4)
                if !site.isPending, !site.isArchived {
                    Text("\(Int(m.progress.rounded()))%")
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                }
            }
            HStack(spacing: 6) {
                if !site.isArchived { HealthBadge(health: m.health) }
                Text(site.clientName ?? "Nessun cliente")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if let reason = site.reason {
                HStack(spacing: 6) {
                    Label(reason == .completed ? "Concluso il \(SiteDate.long(site.archivedAt))" : reason.label,
                          systemImage: reason.symbol)
                        .foregroundStyle(reason.color)
                    Spacer()
                    Text(Format.currency(site.metrics.contractNet)).monospacedDigit().foregroundStyle(.secondary)
                }
                .font(.caption)
            } else if site.isPending {
                Text("Preventivo inviato · \(Format.currency(site.quotes.reduce(0) { $0 + $1.net })) + IVA")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                SiteProgressBar(value: m.progress, expected: m.expectedProgress, health: m.health)
                HStack {
                    if m.toInvoice > 0 {
                        Label("Da fatturare \(Format.currency(m.toInvoice))", systemImage: "doc.text")
                            .foregroundStyle(.orange)
                    }
                    Spacer()
                    if m.delayDays > 0 {
                        Text("+\(m.delayDays) gg").foregroundStyle(.red)
                    } else if let end = site.plannedEndDate {
                        Text("Fine \(SiteDate.short(end))").foregroundStyle(.secondary)
                    }
                }
                .font(.caption)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

/// Filtri della dashboard come chip scorrevoli: con quattro voci e i numeri
/// un controllo segmentato non ci sta su iPhone (né con il testo grande).
struct SiteFilterBar<Value: Hashable>: View {
    struct Item {
        let value: Value
        let title: String
        let count: Int?
        let symbol: String
    }

    @Binding var selection: Value
    let items: [Item]

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(items, id: \.value) { item in
                    let (value, title, count, symbol) = (item.value, item.title, item.count, item.symbol)
                    let selected = value == selection
                    Button {
                        selection = value
                        UISelectionFeedbackGenerator().selectionChanged()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: symbol).imageScale(.small)
                            Text(title)
                            if let count {
                                Text("\(count)")
                                    .monospacedDigit()
                                    .foregroundStyle(selected ? Color.white.opacity(0.85) : Color.secondary)
                            }
                        }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .foregroundStyle(selected ? Color.white : Color.primary)
                        .background(selected ? AnyShapeStyle(Color.accentColor.gradient) : AnyShapeStyle(Color(.secondarySystemGroupedBackground)),
                                    in: Capsule())
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(count.map { "\(title), \($0)" } ?? title)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 2)
        }
        .scrollIndicators(.hidden)
    }
}

struct HealthBadge: View {
    let health: SiteHealth

    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(health.color).frame(width: 6, height: 6)
            Text(health.label)
        }
        .font(.caption2.weight(.semibold))
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .foregroundStyle(health.color)
        .background(health.color.opacity(0.14), in: Capsule())
    }
}

struct SiteProgressBar: View {
    let value: Double
    var expected: Double?
    var health: SiteHealth = .on_track

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.primary.opacity(0.08))
                Capsule().fill(health.color.gradient)
                    .frame(width: geo.size.width * min(1, max(0, value / 100)))
                if let expected, expected > 0, expected < 100 {
                    Rectangle().fill(Color.primary.opacity(0.45))
                        .frame(width: 2)
                        .offset(x: geo.size.width * expected / 100 - 1)
                }
            }
        }
        .frame(height: 6)
        .animation(.easeOut(duration: 0.4), value: value)
        .accessibilityLabel("Avanzamento \(Int(value.rounded())) per cento")
    }
}

struct EventRow: View {
    let type: SiteEventType
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: type.symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(type.color.gradient, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).lineLimit(2)
                Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
        }
    }
}

struct TipRow: View {
    let tip: SiteTip
    var footer: String?

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle().fill(tip.color).frame(width: 8, height: 8).padding(.top, 6)
            VStack(alignment: .leading, spacing: 2) {
                Text(tip.title).font(.subheadline.weight(.semibold))
                Text(tip.body).font(.subheadline).foregroundStyle(.secondary)
                if let footer {
                    Text(footer).font(.caption2).foregroundStyle(.tertiary).lineLimit(1)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

enum SiteLinks {
    /// Mappe di Apple con le indicazioni stradali verso il cantiere.
    static func directions(lat: Double?, lng: Double?, address: String?) -> URL? {
        var c = URLComponents(string: "maps://")
        if let lat, let lng {
            c?.queryItems = [URLQueryItem(name: "daddr", value: "\(lat),\(lng)"), URLQueryItem(name: "dirflg", value: "d")]
        } else if let address, !address.isEmpty {
            c?.queryItems = [URLQueryItem(name: "daddr", value: address), URLQueryItem(name: "dirflg", value: "d")]
        } else {
            return nil
        }
        return c?.url
    }
}

/// Al posto della Gestione Cantieri mentre è sospesa (anche dai link delle
/// notifiche arrivate prima della sospensione).
struct SitesMaintenanceView: View {
    var body: some View {
        ContentUnavailableView {
            Label("In manutenzione", systemImage: "wrench.and.screwdriver")
        } description: {
            Text("Gestione Cantieri è momentaneamente disabilitata per manutenzione: tornerà disponibile a breve su tutti i dispositivi.")
        }
        .navigationTitle("Cantieri")
    }
}
