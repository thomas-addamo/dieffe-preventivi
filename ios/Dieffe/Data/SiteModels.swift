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
    var title: String { SiteText.title(name) }
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

    struct Note: Decodable, Identifiable {
        let id: String
        let body: String
        let createdAt: String
        let userName: String?
    }

    var isPending: Bool { site.status == "pending" }
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

/// GET /api/sites; finché il server ha cantieri da preparare (posizione,
/// fasi e SAL dell'IA) li fa avanzare a piccoli lotti, come la dashboard web.
@MainActor
@Observable
final class SitesStore {
    private(set) var data: SitesOverview?
    private(set) var error: String?
    private(set) var preparing = false

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
        if (data?.pendingWork ?? 0) > 0, !preparing { await prepare() }
    }

    private func prepare() async {
        preparing = true
        defer { preparing = false }
        struct Remaining: Decodable { let remaining: Int }
        for _ in 0..<25 {
            guard let r: Remaining = try? await APIClient.shared.send("POST", "/api/sites/process") else { break }
            if let fresh: SitesOverview = try? await APIClient.shared.get("/api/sites") { data = fresh }
            if r.remaining <= 0 { break }
        }
    }

    func reset() { data = nil; error = nil }
}
