import ActivityKit
import Foundation

/// Attività in tempo reale (Dynamic Island e schermata di blocco), condivise
/// tra l'app e l'estensione DieffeWidgets. Aggiornate dall'app stessa: senza
/// push di Apple (Apple ID gratuito) cambiano solo mentre l'app è attiva.
struct DieffeActivityAttributes: ActivityAttributes {
    enum Kind: String, Codable, Hashable {
        /// Preventivo aperto nell'editor: codice e totale mentre si usa altro.
        case editing
        /// Importazione da file o risposta dell'assistente AI in corso.
        case task
        /// Sopralluogo in cantiere: cliente, indirizzo e tempo trascorso.
        case siteVisit
    }

    enum Phase: String, Codable, Hashable {
        case running, done, failed
    }

    struct ContentState: Codable, Hashable {
        /// editing: titolo del preventivo; task: cosa sta succedendo.
        var title: String
        /// Riga secondaria: cliente, oppure l'esito ("Pronto: 14 voci").
        var detail: String?
        /// Totale IVA inclusa (editing).
        var total: Double?
        var phase: Phase = .running
    }

    let kind: Kind
    let quoteID: String?
    /// Codice completo, es. PREV-2026-043 (abbreviato in QuoteCode).
    let code: String?
    let clientName: String?
    let address: String?
    /// task: "Importazione" o "Assistente AI".
    let taskName: String?
    let startedAt: Date
}

extension DieffeActivityAttributes {
    var shortCode: String { code.map(QuoteCode.short) ?? "" }
    var mediumCode: String { code.map(QuoteCode.medium) ?? "" }

    /// Dove porta il tocco sull'attività.
    var url: URL {
        guard let quoteID else { return URL(string: "dieffe://open?path=/dashboard")! }
        return URL(string: "dieffe://open?path=/preventivi/\(quoteID)")!
    }

    var addItemURL: URL? { actionURL("item") }
    /// Termina il sopralluogo aprendo l'app sul preventivo (affidabile anche
    /// senza push: lo chiude l'app stessa).
    var endVisitURL: URL? { actionURL("endvisit") }

    private func actionURL(_ action: String) -> URL? {
        quoteID.flatMap { URL(string: "dieffe://open?path=/preventivi/\($0)&action=\(action)") }
    }

    var symbol: String {
        switch kind {
        case .editing: "doc.text.fill"
        case .task: taskName == "Importazione" ? "doc.viewfinder.fill" : "sparkles"
        case .siteVisit: "mappin.and.ellipse"
        }
    }
}

/// Codici brevi per la Dynamic Island, dove lo spazio è poco (iPhone piccoli):
/// PREV-2026-043 → "043" (compatta) e "043/26" (estesa); i lavori extra
/// PREV-2026-043-E1 → "043-E1" e "043/26 E1".
enum QuoteCode {
    private static func parts(_ code: String) -> (number: String, year: String, extra: String?)? {
        let p = code.split(separator: "-").map(String.init)
        guard p.count >= 3, p[1].count == 4, p[1].allSatisfy(\.isNumber), p[2].allSatisfy(\.isNumber) else { return nil }
        let extra = p.count >= 4 && p[3].hasPrefix("E") ? p[3] : nil
        return (p[2], String(p[1].suffix(2)), extra)
    }

    static func short(_ code: String) -> String {
        guard let p = parts(code) else { return String(code.suffix(6)) }
        return p.extra.map { "\(p.number)-\($0)" } ?? p.number
    }

    static func medium(_ code: String) -> String {
        guard let p = parts(code) else { return String(code.suffix(9)) }
        return "\(p.number)/\(p.year)" + (p.extra.map { " \($0)" } ?? "")
    }
}

/// Importi brevi per la parte compatta: 950 €, 11,8k €, 1,2M €.
enum CompactMoney {
    static func format(_ value: Double) -> String {
        let abs = Swift.abs(value)
        func n(_ v: Double, _ digits: Int) -> String {
            v.formatted(.number.precision(.fractionLength(0...digits)).rounded(rule: .toNearestOrAwayFromZero)
                .locale(Locale(identifier: "it_IT")))
        }
        if abs >= 1_000_000 { return "\(n(value / 1_000_000, 1))M €" }
        if abs >= 10_000 { return "\(n(value / 1_000, 0))k €" }
        if abs >= 1_000 { return "\(n(value / 1_000, 1))k €" }
        return "\(n(value, 0)) €"
    }
}
