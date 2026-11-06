import Foundation

/// Numeri della Home calcolati dall'elenco dei preventivi (GET /api/app/home),
/// con le stesse regole della dashboard del sito: "accettato nel mese" usa la
/// data di ultima modifica, i valori sono imponibili (IVA esclusa).
struct HomeInsights {
    struct Month: Identifiable {
        let start: Date
        let accepted: Double
        let created: Double
        var id: Date { start }
    }

    struct FollowUp: Identifiable {
        let quote: QuoteSummary
        let days: Int
        var id: String { quote.id }
    }

    let acceptedThisMonth: Int
    let acceptedValueThisMonth: Double
    let pending: Int
    let pendingValue: Double
    let drafts: Int
    /// Accettati / (accettati + rifiutati) degli ultimi 12 mesi; nil senza risposte.
    let acceptanceRate: Double?
    /// Ultimi 6 mesi, dal più vecchio.
    let months: [Month]
    /// Inviati senza risposta da almeno `followUpDays` giorni, dal più vecchio.
    let waiting: [FollowUp]
    /// Bozze ferme da almeno `staleDraftDays` giorni, dalla più vecchia.
    let staleDrafts: [FollowUp]

    static let followUpDays = 7
    static let staleDraftDays = 14

    init(_ quotes: [QuoteSummary], now: Date = .now, calendar: Calendar = .current) {
        func date(_ raw: String) -> Date? { Self.parse(raw) }
        func days(since raw: String) -> Int {
            guard let d = date(raw) else { return 0 }
            return calendar.dateComponents([.day], from: d, to: now).day ?? 0
        }
        let monthStart = calendar.dateInterval(of: .month, for: now)?.start ?? now

        let acceptedNow = quotes.filter {
            $0.status == .accepted && (date($0.updatedAt).map { $0 >= monthStart } ?? false)
        }
        acceptedThisMonth = acceptedNow.count
        acceptedValueThisMonth = acceptedNow.reduce(0) { $0 + $1.total }

        let sent = quotes.filter { $0.status == .sent }
        pending = sent.count
        pendingValue = sent.reduce(0) { $0 + $1.total }
        drafts = quotes.filter { $0.status == .draft }.count

        let yearAgo = calendar.date(byAdding: .month, value: -12, to: now) ?? now
        let answered = quotes.filter {
            ($0.status == .accepted || $0.status == .rejected) && (date($0.updatedAt).map { $0 >= yearAgo } ?? false)
        }
        acceptanceRate = answered.isEmpty ? nil
            : Double(answered.filter { $0.status == .accepted }.count) / Double(answered.count)

        months = (0..<6).reversed().compactMap { back -> Month? in
            guard let start = calendar.date(byAdding: .month, value: -back, to: monthStart),
                  let interval = calendar.dateInterval(of: .month, for: start) else { return nil }
            let accepted = quotes.filter {
                $0.status == .accepted && (date($0.updatedAt).map(interval.contains) ?? false)
            }.reduce(0) { $0 + $1.total }
            let created = quotes.filter { date($0.createdAt).map(interval.contains) ?? false }
                .reduce(0) { $0 + $1.total }
            return Month(start: interval.start, accepted: accepted, created: created)
        }

        waiting = sent.map { FollowUp(quote: $0, days: days(since: $0.updatedAt)) }
            .filter { $0.days >= Self.followUpDays }
            .sorted { $0.days > $1.days }
        staleDrafts = quotes.filter { $0.status == .draft }
            .map { FollowUp(quote: $0, days: days(since: $0.updatedAt)) }
            .filter { $0.days >= Self.staleDraftDays }
            .sorted { $0.days > $1.days }
    }

    /// Date del sito: ISO ("2026-10-13T18:12:00.123Z") o del database
    /// ("2026-10-13 18:12:00.123+00"), oppure solo il giorno.
    static func parse(_ raw: String) -> Date? {
        if let d = QuoteDetail.parseDate(raw) { return d }
        var s = raw.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: " ", with: "T")
        if s.range(of: #"[+-]\d{2}$"#, options: .regularExpression) != nil { s += ":00" }
        // Più di 3 decimali nei secondi: il lettore ISO ne vuole al massimo 3.
        if let r = s.range(of: #"\.\d+"#, options: .regularExpression) {
            s.replaceSubrange(r, with: String(s[r].prefix(4)))
        }
        if let d = QuoteDetail.parseDate(s) { return d }
        let day = DateFormatter()
        day.locale = Locale(identifier: "en_US_POSIX")
        day.timeZone = .current
        day.dateFormat = "yyyy-MM-dd"
        return day.date(from: String(raw.prefix(10)))
    }
}
