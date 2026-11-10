import Observation
import SwiftUI

// Gestione Cantieri: modelli delle API /api/sites (src/lib/sites/queries.ts).
// I numeri (avanzamento, SAL, ritardo, costi) li calcola il server: l'app li
// mostra così come sono, uguali al sito e all'app desktop.

enum SiteHealth: String, Decodable {
    case pending, not_started, on_track, at_risk, late, done

    init(from decoder: Decoder) throws {
        self = SiteHealth(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .not_started
    }

    var label: String {
        switch self {
        case .pending: "In attesa"
        case .not_started: "Da avviare"
        case .on_track: "In tempo"
        case .at_risk: "A rischio"
        case .late: "In ritardo"
        case .done: "Completato"
        }
    }

    /// Stessi colori del sito (src/lib/sites/metrics.ts).
    var color: Color {
        switch self {
        case .pending: Color(red: 0.58, green: 0.64, blue: 0.72)
        case .not_started: .blue
        case .on_track: .green
        case .at_risk: .orange
        case .late: .red
        case .done: .purple
        }
    }

    /// Ordine "chi richiede attenzione prima".
    var rank: Int {
        switch self {
        case .late: 0
        case .at_risk: 1
        case .on_track: 2
        case .not_started: 3
        case .done: 4
        case .pending: 5
        }
    }
}

struct SiteMetrics: Decodable {
    let contractNet: Double
    let contractGross: Double
    let progress: Double
    let milestonesTotal: Double
    let invoiced: Double
    let paid: Double
    let toInvoice: Double
    let toCollect: Double
    let elapsedDays: Int?
    let plannedDays: Int?
    let expectedProgress: Double?
    let forecastEnd: String?
    let delayDays: Int
    let dailyBurn: Double
    let delayCost: Double
    let margin: Double
    let marginAfterDelay: Double
    let breakEvenDelayDays: Int?
    let health: SiteHealth
}

struct SiteTip: Decodable, Hashable {
    let title: String
    let body: String
    let priority: String
    let kind: String?

    var color: Color {
        switch priority {
        case "alta": .red
        case "bassa": .blue
        default: .orange
        }
    }
}

struct SiteWeather: Decodable, Hashable {
    let date: String
    let rain: Double
    let code: Int
    let tmax: Double
}

struct SiteInsights: Decodable {
    let tips: [SiteTip]
    let weather: [SiteWeather]?
}

// MARK: Dashboard

struct SitesOverview: Decodable {
    let sites: [SiteListItem]
    let upcoming: [UpcomingEvent]
    let totals: Totals
    let pendingWork: Int

    struct Totals: Decodable {
        let active: Int
        let pending: Int
        let inProgressValue: Double
        let invoiced: Double
        let milestonesTotal: Double
        let toInvoice: Double
        let toCollect: Double
        let late: Int
        let delayCost: Double
        /// Cantieri in archivio (4.5.0).
        let archived: Int?
    }

    struct UpcomingEvent: Decodable, Identifiable {
        let siteId: String
        let siteName: String
        let date: String
        let endDate: String?
        let title: String
        let type: String
        var id: String { "\(siteId)-\(date)-\(title)" }
    }
}

struct SiteListItem: Decodable, Identifiable {
    let id: String
    let name: String
    let status: String
    let address: String?
    let lat: Double?
    let lng: Double?
    let geoStatus: String
    let clientName: String?
    let clientPhone: String?
    let startDate: String?
    let plannedEndDate: String?
    let quotes: [QuoteChip]
    let metrics: SiteMetrics
    let nextEvent: NextEvent?
    let topTip: SiteTip?
    /// Solo nell'elenco dell'archivio (GET /api/sites/archive).
    let archivedAt: String?
    let archiveReason: String?

    struct QuoteChip: Decodable, Identifiable {
        let id: String
        let code: String
        let title: String
        let status: String
        let kind: String
        let net: Double
    }

    struct NextEvent: Decodable {
        let date: String
        let title: String
        let type: String
    }

    var isPending: Bool { status == "pending" }
    var isArchived: Bool { archivedAt != nil }
    var reason: SiteArchiveReason? { archivedAt == nil ? nil : SiteArchiveReason(raw: archiveReason) }
    var title: String { SiteText.title(name) }
    /// "Via Roma 12" dall'indirizzo completo.
    var street: String? { SiteText.street(address) }
    /// "Torino TO", senza CAP né paese.
    var locality: String? { SiteText.locality(address) }
    /// Come si riconosce il cantiere nell'elenco: la via, altrimenti il cliente.
    var headline: String { street ?? clientName ?? title }
}

/// GET /api/sites/archive
struct SitesArchive: Decodable {
    let sites: [SiteListItem]
}

/// Perché un cantiere è in archivio.
enum SiteArchiveReason: String {
    case completed, withdrawn

    init(raw: String?) { self = raw == "withdrawn" ? .withdrawn : .completed }

    var label: String {
        switch self {
        case .completed: "Lavori conclusi"
        case .withdrawn: "Preventivo ritirato"
        }
    }

    var symbol: String {
        switch self {
        case .completed: "flag.checkered"
        case .withdrawn: "arrow.uturn.backward.circle"
        }
    }

    var color: Color {
        switch self {
        case .completed: .purple
        case .withdrawn: .gray
        }
    }
}

// MARK: Pagina del cantiere

struct SiteDetail: Decodable {
    var site: Site
    let clientName: String?
    let clientPhone: String?
    let clientEmail: String?
    let quotes: [Quote]
    var phases: [Phase]
    var milestones: [Milestone]
    var events: [Event]
    var notes: [Note]
    /// Foto di cantiere (4.5.0): assenti sui server più vecchi.
    var photos: [Photo]?
    var metrics: SiteMetrics
    let setupPending: Bool
    var insightsStale: Bool?

    struct Site: Decodable {
        let id: String
        let status: String
        let mainQuoteId: String
        let name: String
        let address: String?
        let lat: Double?
        let lng: Double?
        let startDate: String?
        let plannedEndDate: String?
        let dailyCost: Double?
        let penaltyPerDay: Double?
        let marginPct: Double
        var progress: Double
        var aiInsights: SiteInsights?
        /// In archivio da quando e perché (4.5.0).
        var archivedAt: String?
        var archiveReason: String?
    }

    struct Quote: Decodable, Identifiable {
        let id: String
        let code: String
        let title: String
        let status: String
        let kind: String
        let vatRate: Double
        let net: Double
    }

    struct Phase: Decodable, Identifiable {
        let id: String
        let quoteId: String?
        let title: String
        let weight: Double
        let orderIndex: Int
        let durationDays: Int?
        let plannedStart: String?
        let plannedEnd: String?
        var doneAt: String?
        let note: String?
        let source: String

        var isDone: Bool { doneAt != nil }
    }

    struct Milestone: Decodable, Identifiable {
        let id: String
        let quoteId: String?
        let label: String
        let percent: Double?
        let amount: Double?
        let trigger: String
        let phaseId: String?
        var reachedAt: String?
        var invoicedAt: String?
        var invoiceNumber: String?
        var paidAt: String?
        let value: Double
    }

    struct Event: Decodable, Identifiable {
        let id: String
        let date: String
        let endDate: String?
        let type: String
        let title: String
        let notes: String?
    }

    struct Note: Decodable, Identifiable, Hashable {
        let id: String
        var body: String
        let createdAt: String
        var updatedAt: String?
        let userId: String?
        let userName: String?
    }

    struct Photo: Decodable, Identifiable, Hashable {
        let id: String
        var phaseId: String?
        let publicId: String?
        let url: String
        let width: Double?
        let height: Double?
        var caption: String?
        let userId: String?
        let userName: String?
        let createdAt: String

        /// Miniatura quadrata di Cloudinary (come il sito).
        var thumbURL: URL? { URL(string: SitePhotoURL.transform(url, "f_auto,q_auto,w_400,h_400,c_fill,g_auto")) }
        /// Per il visore a schermo intero.
        var fullURL: URL? { URL(string: SitePhotoURL.transform(url, "f_auto,q_auto,w_2000,c_limit")) }
    }

    var isPending: Bool { site.status == "pending" }
    var isArchived: Bool { site.archivedAt != nil }
    var archiveReason: SiteArchiveReason? { isArchived ? SiteArchiveReason(raw: site.archiveReason) : nil }
    var allPhotos: [Photo] { photos ?? [] }
}

// MARK: Testi e date

enum SiteText {
    /// I titoli dei preventivi sono spesso tutti maiuscoli: "Ristrutturazione palazzina…".
    static func title(_ name: String) -> String {
        let s = name.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return s == s.uppercased() ? s.prefix(1) + s.dropFirst().lowercased() : s
    }

    static func triggerLabel(_ trigger: String, phase: String?) -> String {
        switch trigger {
        case "accept": "All'accettazione"
        case "start": "A inizio lavori"
        case "phase": phase.map { "A fine «\($0)»" } ?? "A fine fase"
        case "end": "A fine lavori"
        default: "Da segnare a mano"
        }
    }

    static func days(_ n: Int) -> String { n == 1 ? "1 giorno" : "\(n) giorni" }

    private static func parts(_ address: String?) -> [String] {
        (address ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    static func street(_ address: String?) -> String? { parts(address).first }

    static func locality(_ address: String?) -> String? {
        let rest = parts(address).dropFirst()
            .filter { !["italia", "italy"].contains($0.lowercased()) }
            .map { $0.replacingOccurrences(of: #"^\d{5}\s*"#, with: "", options: .regularExpression) }
            .filter { !$0.isEmpty }
        return rest.isEmpty ? nil : rest.joined(separator: ", ")
    }
}

extension Array where Element: Hashable {
    func removingDuplicates() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

enum SitePhotoURL {
    /// Aggiunge una trasformazione di Cloudinary all'indirizzo della foto.
    static func transform(_ url: String, _ t: String) -> String {
        guard url.contains("res.cloudinary.com"), url.contains("/upload/") else { return url }
        return url.replacingOccurrences(of: "/upload/", with: "/upload/\(t)/")
    }
}

/// Giorni lavorativi come sul server (src/lib/sites/metrics.ts): dal lunedì
/// al venerdì, festività nazionali escluse (Pasquetta compresa).
enum SiteWorkdays {
    private static let fixed: Set<String> = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"]

    static func isHoliday(_ date: Date, calendar cal: Calendar = .current) -> Bool {
        let c = cal.dateComponents([.year, .month, .day], from: date)
        guard let y = c.year, let m = c.month, let d = c.day else { return false }
        if fixed.contains(String(format: "%02d-%02d", m, d)) { return true }
        let (em, ed) = easter(y)
        // Lunedì dell'Angelo: il giorno dopo Pasqua.
        guard let e = cal.date(from: DateComponents(year: y, month: em, day: ed)),
              let monday = cal.date(byAdding: .day, value: 1, to: e) else { return false }
        return cal.isDate(date, inSameDayAs: monday)
    }

    static func isWorkday(_ date: Date, calendar cal: Calendar = .current) -> Bool {
        let wd = cal.component(.weekday, from: date)
        return wd != 1 && wd != 7 && !isHoliday(date, calendar: cal)
    }

    /// Pasqua (calendario gregoriano, algoritmo di Meeus/Jones/Butcher) → (mese, giorno).
    static func easter(_ y: Int) -> (Int, Int) {
        let a = y % 19, b = y / 100, c = y % 100, d = b / 4, e = b % 4
        let f = (b + 8) / 25, g = (b - f + 1) / 3
        let h = (19 * a + b - d - g + 15) % 30
        let i = c / 4, k = c % 4
        let l = (32 + 2 * e + 2 * i - h - k) % 7
        let m = (a + 11 * h + 22 * l) / 451
        let month = (h + l - 7 * m + 114) / 31
        let day = (h + l - 7 * m + 114) % 31 + 1
        return (month, day)
    }
}

enum SiteDate {
    private static let iso: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// "2026-10-14" o un timestamp ISO → data locale.
    static func date(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        if raw.count <= 10 { return iso.date(from: raw) }
        return (try? Date(raw, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)))
            ?? (try? Date(raw, strategy: .iso8601))
            ?? iso.date(from: String(raw.prefix(10)))
    }

    static func string(_ date: Date) -> String { iso.string(from: date) }

    /// "14 ott 2025"
    static func long(_ raw: String?) -> String {
        guard let d = date(raw) else { return "—" }
        return d.formatted(.dateTime.day().month(.abbreviated).year().locale(Locale(identifier: "it_IT")))
    }

    /// "14 ott"
    static func short(_ raw: String?) -> String {
        guard let d = date(raw) else { return "—" }
        return d.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "it_IT")))
    }
}

/// Tipi di evento del calendario (come EVENT_TYPES sul sito).
enum SiteEventType: String, CaseIterable, Identifiable {
    case suolo_pubblico, intervento, consegna, sopralluogo, scadenza, altro

    var id: String { rawValue }

    init(raw: String) { self = SiteEventType(rawValue: raw) ?? .altro }

    var label: String {
        switch self {
        case .suolo_pubblico: "Suolo pubblico"
        case .intervento: "Intervento ditta"
        case .consegna: "Consegna materiali"
        case .sopralluogo: "Sopralluogo"
        case .scadenza: "Scadenza"
        case .altro: "Altro"
        }
    }

    var symbol: String {
        switch self {
        case .suolo_pubblico: "signpost.right.and.left.fill"
        case .intervento: "hammer.fill"
        case .consegna: "shippingbox.fill"
        case .sopralluogo: "checklist"
        case .scadenza: "exclamationmark.triangle.fill"
        case .altro: "calendar"
        }
    }

    var color: Color {
        switch self {
        case .suolo_pubblico: .orange
        case .intervento: .blue
        case .consegna: .green
        case .sopralluogo: .purple
        case .scadenza: .red
        case .altro: .gray
        }
    }

    var placeholder: String {
        switch self {
        case .suolo_pubblico: "Richiesta occupazione suolo pubblico"
        case .intervento: "Interviene l'idraulico"
        case .consegna: "Consegna piastrelle"
        case .sopralluogo: "Sopralluogo con il cliente"
        case .scadenza: "Scadenza permesso"
        case .altro: "Titolo"
        }
    }
}

// MARK: Archivio della dashboard

/// GET /api/sites. Il server prepara da solo i cantieri nuovi (posizione,
/// fasi e SAL dell'IA) dopo ogni lettura: finché `pendingWork > 0` l'app
/// rilegge ogni 5 secondi, al massimo per 3 minuti. Niente più /process.
@MainActor
@Observable
final class SitesStore {
    private(set) var data: SitesOverview?
    private(set) var error: String?
    private(set) var preparing = false
    /// Archivio (GET /api/sites/archive), caricato quando serve.
    private(set) var archive: [SiteListItem]?
    private(set) var archiveError: String?

    @ObservationIgnored private var watcher: Task<Void, Never>?

    func load() async {
        do {
            data = try await APIClient.shared.get("/api/sites")
            error = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error.localizedDescription
        }
        if (data?.pendingWork ?? 0) > 0 { watch() }
    }

    private func watch() {
        guard watcher == nil else { return }
        preparing = true
        watcher = Task { [weak self] in
            let deadline = Date.now.addingTimeInterval(180)
            while Date.now < deadline, !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                guard !Task.isCancelled else { break }
                guard let fresh: SitesOverview = try? await APIClient.shared.get("/api/sites") else { continue }
                self?.data = fresh
                if fresh.pendingWork <= 0 { break }
            }
            // Se è stato fermato, ci ha già pensato stopWatching (e può esserci un nuovo giro).
            if !Task.isCancelled {
                self?.preparing = false
                self?.watcher = nil
            }
        }
    }

    /// La dashboard non è più visibile: smette di rileggere.
    func stopWatching() {
        watcher?.cancel()
        watcher = nil
        preparing = false
    }

    func loadArchive() async {
        do {
            let r: SitesArchive = try await APIClient.shared.get("/api/sites/archive")
            archive = r.sites
            archiveError = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            archiveError = error.localizedDescription
        }
    }

    func reset() {
        stopWatching()
        data = nil
        error = nil
        archive = nil
        archiveError = nil
    }
}
