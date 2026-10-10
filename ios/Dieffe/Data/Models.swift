import SwiftUI

// Modelli delle API JSON del sito (src/app/api/app/*, /api/clients, /api/quotes).

struct HomeData: Decodable {
    let user: CurrentUser
    let stats: Stats
    var quotes: [QuoteSummary]
    let clients: [ClientRef]
    let trashCount: Int?
    let unreadNotifications: Int?

    struct Stats: Decodable {
        let total: Int
        let acceptedThisMonth: Int
        let pending: Int
        let clients: Int
    }
}

struct CurrentUser: Decodable, Equatable {
    let id: String
    let name: String
    let email: String?
    let role: String

    var roleLabel: String {
        switch role {
        case "admin": "Amministratore"
        case "editor": "Editor"
        default: "Visualizzatore"
        }
    }

    /// Admin ed editor creano e modificano; il ruolo "viewer" consulta soltanto.
    var canEdit: Bool { role == "admin" || role == "editor" }

    var firstName: String { name.split(separator: " ").first.map(String.init) ?? name }
}

struct ClientRef: Decodable, Identifiable, Hashable {
    let id: String
    let name: String

    init(id: String, name: String) {
        self.id = id
        self.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(id: try c.decode(String.self, forKey: .id), name: try c.decode(String.self, forKey: .name))
    }

    private enum CodingKeys: String, CodingKey { case id, name }
}

enum QuoteStatus: String, Decodable, CaseIterable, Identifiable {
    case draft, sent, accepted, rejected, archived

    var id: String { rawValue }

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = QuoteStatus(rawValue: raw) ?? .draft
    }

    var label: String {
        switch self {
        case .draft: "Bozza"
        case .sent: "Inviato"
        case .accepted: "Accettato"
        case .rejected: "Rifiutato"
        case .archived: "Archiviato"
        }
    }

    var color: Color {
        switch self {
        case .draft: .gray
        case .sent: .blue
        case .accepted: .green
        case .rejected: .red
        case .archived: .brown
        }
    }

    var symbol: String {
        switch self {
        case .draft: "pencil.circle"
        case .sent: "paperplane.circle"
        case .accepted: "checkmark.circle"
        case .rejected: "xmark.circle"
        case .archived: "archivebox.circle"
        }
    }
}

struct QuoteSummary: Decodable, Identifiable, Hashable {
    let id: String
    let code: String
    let title: String
    let status: QuoteStatus
    let createdAt: String
    let updatedAt: String
    let clientId: String?
    let clientName: String?
    let authorName: String
    let kind: String
    let parentQuoteId: String?
    /// Imponibile: al netto dello sconto, IVA esclusa.
    let total: Double
    let publicLinkActive: Bool

    var isExtra: Bool { kind == "extra" }
}

struct ClientRecord: Decodable, Identifiable, Hashable {
    let id: String
    var name: String
    var address: String?
    var vatNumber: String?
    var email: String?
    var phone: String?
    var notes: String?
    let createdAt: String
    var quotes: [ClientQuote]

    struct ClientQuote: Decodable, Identifiable, Hashable {
        let id: String
        let code: String
        let title: String
        let status: QuoteStatus
        let createdAt: String
        let total: Double
    }

    enum CodingKeys: String, CodingKey {
        case id, name, address, vatNumber, email, phone, notes, createdAt, quotes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name).trimmingCharacters(in: .whitespacesAndNewlines)
        address = try c.decodeIfPresent(String.self, forKey: .address).nonEmpty
        vatNumber = try c.decodeIfPresent(String.self, forKey: .vatNumber).nonEmpty
        email = try c.decodeIfPresent(String.self, forKey: .email).nonEmpty
        phone = try c.decodeIfPresent(String.self, forKey: .phone).nonEmpty
        notes = try c.decodeIfPresent(String.self, forKey: .notes).nonEmpty
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        quotes = try c.decodeIfPresent([ClientQuote].self, forKey: .quotes) ?? []
    }

    /// Valore dei soli preventivi accettati: è il dato che conta davvero.
    var acceptedValue: Double {
        quotes.filter { $0.status == .accepted }.reduce(0) { $0 + $1.total }
    }

    var initials: String {
        name.split(separator: " ").prefix(2).compactMap { $0.first.map { String($0).uppercased() } }.joined()
    }
}

struct CreatedID: Decodable {
    let id: String
}

extension Optional where Wrapped == String {
    /// Nel database alcuni campi vuoti sono "" invece di null.
    var nonEmpty: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}

// MARK: - Formattazione

enum Format {
    /// "8.460,00 €" come sul sito (iOS in italiano scriverebbe "8460,00 €").
    static func currency(_ value: Double) -> String {
        currencyFormatter.string(from: value as NSNumber) ?? ""
    }

    private static let currencyFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "it_IT")
        f.currencyCode = "EUR"
        f.minimumGroupingDigits = 1
        return f
    }()

    /// "1 preventivo", "28 preventivi".
    static func count(_ n: Int, _ one: String, _ many: String) -> String {
        "\(n.formatted()) \(n == 1 ? one : many)"
    }

    /// Le date arrivano da Postgres ("2026-10-10 12:34:56+00" o ISO): basta il giorno.
    static func date(_ raw: String) -> String {
        let day = String(raw.prefix(10))
        let parts = day.split(separator: "-")
        guard parts.count == 3 else { return raw }
        return "\(parts[2])/\(parts[1])/\(parts[0])"
    }
}
