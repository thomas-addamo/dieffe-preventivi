import Foundation

// Preventivo completo (GET /api/quotes/[id], src/lib/db/quotes.ts
// getQuoteWithRelations) e calcoli identici a src/lib/calculations.ts.

struct QuoteDetail: Codable, Identifiable, Equatable {
    let id: String
    let code: String
    var title: String
    var status: QuoteStatus
    var clientId: String?
    var client: Party?
    var projectAddress: String?
    var vatRate: Double
    var discountType: DiscountType?
    var discountValue: Double?
    var notes: String?
    var paymentTerms: String?
    var validUntil: String?
    var isLocked: Bool
    let kind: String
    let parentQuoteId: String?
    var publicToken: String?
    var publicTokenExpiresAt: String?
    let author: Party?
    var sections: [QuoteSection]

    var isExtra: Bool { kind == "extra" }

    struct Party: Codable, Equatable {
        let id: String
        let name: String
    }

    var publicLinkActive: Bool {
        guard publicToken != nil, let raw = publicTokenExpiresAt, let date = Self.parseDate(raw) else { return false }
        return date > .now
    }

    var publicLinkExpiry: Date? { publicTokenExpiresAt.flatMap(Self.parseDate) }

    static func parseDate(_ raw: String) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) { return d }
        iso.formatOptions = [.withInternetDateTime]
        return iso.date(from: raw)
    }

    var totals: QuoteTotals { QuoteTotals(self) }
}

enum DiscountType: String, Codable, CaseIterable, Identifiable {
    case percent, fixed
    var id: String { rawValue }
    var label: String { self == .percent ? "Percentuale" : "Importo fisso" }
}

extension QuoteStatus: Encodable {
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(rawValue)
    }
}

struct QuoteSection: Codable, Identifiable, Equatable {
    let id: String
    var code: String
    var title: String
    var description: String?
    var orderIndex: Int
    var sectionNote: String?
    var isOptional: Bool
    var isOptionalIncluded: Bool
    var lumpSum: Bool
    var lumpSumPrice: Double?
    var items: [QuoteItem]

    /// Il prezzo a corpo quando attivo, altrimenti la somma delle voci.
    var total: Double {
        lumpSum ? (lumpSumPrice ?? 0) : items.reduce(0) { $0 + $1.total }
    }

    var json: [String: Any?] {
        ["id": id, "code": code, "title": title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Senza titolo" : title,
         "description": description, "orderIndex": orderIndex,
         "sectionNote": sectionNote, "isOptional": isOptional, "isOptionalIncluded": isOptionalIncluded,
         "lumpSum": lumpSum, "lumpSumPrice": lumpSumPrice]
    }

    static func new(code: String, orderIndex: Int, optional: Bool) -> QuoteSection {
        QuoteSection(id: newID(), code: code, title: optional ? "Nuova sezione opzionale" : "Nuova sezione",
                     description: nil, orderIndex: orderIndex, sectionNote: nil, isOptional: optional,
                     isOptionalIncluded: false, lumpSum: false, lumpSumPrice: nil, items: [])
    }
}

struct QuoteItem: Codable, Identifiable, Equatable {
    let id: String
    var description: String
    var unitOfMeasure: String
    var quantity: Double
    var unitPrice: Double
    var discount: Double
    var notes: String?
    var orderIndex: Int
    var images: [ItemImage]

    struct ItemImage: Codable, Identifiable, Equatable {
        let id: String
        let cloudinaryUrl: String
    }

    /// Come calcItemTotal: quantità × prezzo, meno lo sconto %.
    var total: Double {
        let subtotal = quantity * unitPrice
        return subtotal - subtotal * (discount / 100)
    }

    enum CodingKeys: String, CodingKey {
        case id, description, unitOfMeasure, quantity, unitPrice, discount, notes, orderIndex, images
    }

    init(id: String, description: String, unitOfMeasure: String, quantity: Double, unitPrice: Double,
         discount: Double, notes: String?, orderIndex: Int, images: [ItemImage]) {
        self.id = id
        self.description = description
        self.unitOfMeasure = unitOfMeasure
        self.quantity = quantity
        self.unitPrice = unitPrice
        self.discount = discount
        self.notes = notes
        self.orderIndex = orderIndex
        self.images = images
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        unitOfMeasure = try c.decodeIfPresent(String.self, forKey: .unitOfMeasure) ?? "n°"
        quantity = try c.decodeIfPresent(Double.self, forKey: .quantity) ?? 1
        unitPrice = try c.decodeIfPresent(Double.self, forKey: .unitPrice) ?? 0
        discount = try c.decodeIfPresent(Double.self, forKey: .discount) ?? 0
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        orderIndex = Int(try c.decodeIfPresent(Double.self, forKey: .orderIndex) ?? 0)
        images = try c.decodeIfPresent([ItemImage].self, forKey: .images) ?? []
    }

    func json(sectionID: String) -> [String: Any?] {
        ["id": id, "sectionId": sectionID, "description": description, "unitOfMeasure": unitOfMeasure,
         "quantity": quantity, "unitPrice": unitPrice, "discount": discount, "notes": notes,
         "orderIndex": orderIndex]
    }

    static func new(orderIndex: Int) -> QuoteItem {
        QuoteItem(id: newID(), description: "", unitOfMeasure: "n°", quantity: 1, unitPrice: 0,
                  discount: 0, notes: nil, orderIndex: orderIndex, images: [])
    }
}

/// Come calcQuoteTotals: le sezioni opzionali contano solo se incluse.
struct QuoteTotals {
    let baseSubtotal: Double
    let optionalIncluded: Double
    let subtotalBeforeDiscount: Double
    let discountAmount: Double
    let taxable: Double
    let vat: Double
    let total: Double

    init(_ quote: QuoteDetail) {
        baseSubtotal = quote.sections.filter { !$0.isOptional }.reduce(0) { $0 + $1.total }
        optionalIncluded = quote.sections.filter { $0.isOptional && $0.isOptionalIncluded }.reduce(0) { $0 + $1.total }
        subtotalBeforeDiscount = baseSubtotal + optionalIncluded
        switch quote.discountType {
        case .percent: discountAmount = subtotalBeforeDiscount * ((quote.discountValue ?? 0) / 100)
        case .fixed: discountAmount = quote.discountValue ?? 0
        case nil: discountAmount = 0
        }
        taxable = subtotalBeforeDiscount - discountAmount
        vat = taxable * quote.vatRate / 100
        total = taxable + vat
    }
}

/// Stesso formato di generateId() del sito: 16 byte casuali in esadecimale.
func newID() -> String {
    (0..<16).map { _ in String(format: "%02x", UInt8.random(in: 0...255)) }.joined()
}

enum QuoteOptions {
    static let units = ["mq", "ml", "mc", "kg", "n°", "h", "a corpo", "vs.carico"]
    static let vatRates: [(Double, String)] = [(0, "Esente (0%)"), (4, "Ridotta (4%)"),
                                               (10, "Agevolata (10%)"), (22, "Ordinaria (22%)")]
    static let paymentTerms = [
        "30% all'accettazione del preventivo, 40% a metà lavori, 30% alla consegna",
        "50% inizio lavori, 50% fine lavori",
        "20% inizio lavori, 30% al primo SAL, 30% al secondo SAL, 20% fine lavori",
        "Pagamento in un'unica soluzione alla consegna",
        "Bonifico bancario a 30 giorni dalla fattura",
    ]
    static let sectionCodes = (65...90).map { String(UnicodeScalar($0)!) }
}

/// Risposta di /api/ai/suggest-price.
struct PriceSuggestion: Decodable {
    let unitOfMeasure: String
    let unitPrice: Double
    let shortLabel: String
    let improvedDescription: String
    let suggestedQuantity: Double?
    let confidence: String
    let priceSource: String
    let reasoning: String
}
