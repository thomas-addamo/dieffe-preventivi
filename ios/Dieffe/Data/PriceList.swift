import Observation
import SwiftUI

/// Voce del listino prezzi (GET /api/price-list).
struct PriceListItem: Decodable, Identifiable, Hashable {
    let id: String
    let code: String?
    var description: String
    var unitOfMeasure: String
    var unitPrice: Double
    var category: String?
    var subcategory: String?
    var notes: String?
    var isActive: Bool
    var pinned: Bool
    let source: String?
    let lastUsedAt: String?
    let usageCount: Int

    enum CodingKeys: String, CodingKey {
        case id, code, description, unitOfMeasure, unitPrice, category, subcategory, notes
        case isActive, pinned, source, lastUsedAt, usageCount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        code = try c.decodeIfPresent(String.self, forKey: .code)
        description = try c.decode(String.self, forKey: .description)
        unitOfMeasure = try c.decodeIfPresent(String.self, forKey: .unitOfMeasure) ?? "n°"
        // Nel database è numeric: arriva come stringa ("12.50").
        if let text = try? c.decode(String.self, forKey: .unitPrice) {
            unitPrice = Double(text) ?? 0
        } else {
            unitPrice = (try? c.decode(Double.self, forKey: .unitPrice)) ?? 0
        }
        category = try c.decodeIfPresent(String.self, forKey: .category)
        subcategory = try c.decodeIfPresent(String.self, forKey: .subcategory).nonEmpty
        notes = try c.decodeIfPresent(String.self, forKey: .notes).nonEmpty
        isActive = try c.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
        pinned = try c.decodeIfPresent(Bool.self, forKey: .pinned) ?? false
        source = try c.decodeIfPresent(String.self, forKey: .source)
        lastUsedAt = try c.decodeIfPresent(String.self, forKey: .lastUsedAt)
        usageCount = try c.decodeIfPresent(Int.self, forKey: .usageCount) ?? 0
    }

    var categoryName: String { category ?? PriceCatalog.defaultCategory }

    /// La voce come riga di preventivo.
    var asQuoteItem: QuoteItem {
        QuoteItem(id: newID(), description: description, unitOfMeasure: unitOfMeasure, quantity: 1,
                  unitPrice: unitPrice, discount: 0, notes: nil, orderIndex: 0, images: [])
    }
}

/// Le macro-categorie del catalogo, nell'ordine di un computo metrico
/// (src/lib/price-list/taxonomy.ts).
enum PriceCatalog {
    static let defaultCategory = "Opere varie"
    static let categories: [(name: String, prefix: String, symbol: String)] = [
        ("Cantiere e sicurezza", "CAN", "exclamationmark.triangle"),
        ("Demolizioni e rimozioni", "DEM", "hammer"),
        ("Scavi e movimenti terra", "SCA", "mountain.2"),
        ("Strutture e murature", "MUR", "square.stack.3d.up"),
        ("Massetti e sottofondi", "MAS", "square.3.layers.3d.down.right"),
        ("Intonaci e rasature", "INT", "paintbrush.pointed"),
        ("Cartongesso e controsoffitti", "CAR", "rectangle.split.3x1"),
        ("Isolamenti e cappotto", "ISO", "thermometer.snowflake"),
        ("Impermeabilizzazioni", "IMP", "drop.triangle"),
        ("Pavimenti", "PAV", "square.grid.3x3"),
        ("Rivestimenti", "RIV", "square.grid.3x3.square"),
        ("Tinteggiature e decorazioni", "TIN", "paintbrush"),
        ("Serramenti e infissi", "SER", "door.left.hand.open"),
        ("Impianto idraulico", "IDR", "drop"),
        ("Bagni e sanitari", "BAG", "shower"),
        ("Impianto elettrico", "ELE", "bolt"),
        ("Riscaldamento e climatizzazione", "TER", "heater.vertical"),
        ("Coperture e lattonerie", "COP", "house"),
        ("Facciate ed esterni", "EST", "building.2"),
        ("Smaltimento e trasporti", "SMA", "truck.box"),
        ("Noli e attrezzature", "NOL", "wrench.and.screwdriver"),
        ("Opere varie", "VAR", "ellipsis.circle"),
    ]

    static func symbol(for category: String) -> String {
        categories.first { $0.name == category }?.symbol ?? "ellipsis.circle"
    }

    static func order(_ category: String) -> Int {
        categories.firstIndex { $0.name == category } ?? categories.count
    }
}

/// Catalogo del listino, condiviso da schermata Listino ed editor.
@MainActor
@Observable
final class PriceListStore {
    private(set) var items: [PriceListItem]?
    private(set) var error: String?

    func load() async {
        do {
            items = try await APIClient.shared.get("/api/price-list")
            error = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error.localizedDescription
        }
    }

    func loadIfNeeded() async {
        if items == nil { await load() }
    }

    func save(_ draft: PriceListDraft, editing id: String?) async throws {
        let body: [String: Any?] = [
            "description": draft.description.trimmingCharacters(in: .whitespacesAndNewlines),
            "unitOfMeasure": draft.unitOfMeasure,
            "unitPrice": String(format: "%.2f", draft.unitPrice),
            "category": draft.category,
            "subcategory": draft.subcategory.trimmingCharacters(in: .whitespaces).isEmpty ? nil : draft.subcategory,
            "notes": draft.notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : draft.notes,
            "isActive": draft.isActive,
            "pinned": draft.pinned,
        ]
        if let id {
            try await APIClient.shared.send("PUT", "/api/price-list/\(id)", json: body, as: Empty.self)
        } else {
            try await APIClient.shared.send("POST", "/api/price-list", json: body, as: Empty.self)
        }
        // I codici gerarchici li riassegna il server: si ricarica il catalogo.
        await load()
    }

    func setFlags(_ item: PriceListItem, active: Bool? = nil, pinned: Bool? = nil) async throws {
        guard let index = items?.firstIndex(where: { $0.id == item.id }) else { return }
        if let active { items?[index].isActive = active }
        if let pinned { items?[index].pinned = pinned }
        var body: [String: Any?] = [:]
        if let active { body["isActive"] = active }
        if let pinned { body["pinned"] = pinned }
        do {
            try await APIClient.shared.send("PUT", "/api/price-list/\(item.id)", json: body, as: Empty.self)
        } catch {
            items?[index] = item
            throw error
        }
    }

    func delete(_ item: PriceListItem) async throws {
        try await APIClient.shared.delete("/api/price-list/\(item.id)")
        items?.removeAll { $0.id == item.id }
    }
}

struct PriceListDraft {
    var description = ""
    var unitOfMeasure = "mq"
    var unitPrice: Double = 0
    var category = PriceCatalog.defaultCategory
    var subcategory = ""
    var notes = ""
    var isActive = true
    var pinned = false

    init(category: String? = nil) {
        if let category { self.category = category }
    }

    init(_ item: PriceListItem) {
        description = item.description
        unitOfMeasure = item.unitOfMeasure
        unitPrice = item.unitPrice
        category = item.categoryName
        subcategory = item.subcategory ?? ""
        notes = item.notes ?? ""
        isActive = item.isActive
        pinned = item.pinned
    }

    var isValid: Bool {
        !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && unitPrice > 0
    }
}
