import Observation
import SwiftUI

/// Stato dell'editor nativo di un preventivo, con salvataggio automatico.
/// Le modifiche ai campi si salvano 1,2 secondi dopo l'ultima (come sul sito),
/// inviando solo intestazione, sezioni e voci cambiate; creazioni,
/// eliminazioni, riordini e cambi di stato partono subito.
@MainActor
@Observable
final class QuoteEditorModel {
    enum SaveState: Equatable { case saved, pending, saving, failed(String) }

    let quoteID: String
    private(set) var quote: QuoteDetail?
    private(set) var loadError: String?
    private(set) var saveState: SaveState = .saved
    /// Lavori extra di questo preventivo (o del principale, se è un extra).
    private(set) var extras: [ExtraRef] = []

    var canEdit = false
    var role = "viewer"

    @ObservationIgnored private var headerDirty = false
    @ObservationIgnored private var dirtySections: Set<String> = []
    @ObservationIgnored private var dirtyItems: Set<String> = []
    @ObservationIgnored private var saveTask: Task<Void, Never>?
    @ObservationIgnored private var api: APIClient { .shared }

    struct ExtraRef: Decodable, Identifiable, Hashable {
        let id: String
        let code: String
        let title: String
        let status: QuoteStatus
    }

    init(quoteID: String) {
        self.quoteID = quoteID
    }

    /// Modificabile: ruolo admin/editor e preventivo non bloccato (l'admin può sempre).
    var isEditable: Bool {
        guard canEdit, let quote else { return false }
        return !quote.isLocked || role == "admin"
    }

    // MARK: Caricamento

    func load() async {
        do {
            let loaded: QuoteDetail = try await api.get("/api/quotes/\(quoteID)")
            quote = loaded
            loadError = nil
            let root = loaded.isExtra ? loaded.parentQuoteId : loaded.id
            if let root {
                extras = (try? await api.get("/api/quotes/\(root)/extras")) ?? []
            }
        } catch APIError.unauthorized {
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: Intestazione

    func updateHeader(_ change: (inout QuoteDetail) -> Void) {
        guard isEditable, var q = quote else { return }
        change(&q)
        quote = q
        headerDirty = true
        scheduleSave()
    }

    // MARK: Sezioni

    func addSection(optional: Bool) async -> String? {
        guard isEditable, let q = quote else { return nil }
        let used = Set(q.sections.map(\.code))
        let code = QuoteOptions.sectionCodes.first { !used.contains($0) } ?? String(q.sections.count + 1)
        let section = QuoteSection.new(code: code, orderIndex: q.sections.count, optional: optional)
        quote?.sections.append(section)
        do {
            try await api.send("POST", "/api/quotes/\(quoteID)/sections", json: section.json, as: Empty.self)
            return section.id
        } catch {
            quote?.sections.removeAll { $0.id == section.id }
            fail(error)
            return nil
        }
    }

    func updateSection(_ id: String, _ change: (inout QuoteSection) -> Void) {
        guard isEditable, let index = quote?.sections.firstIndex(where: { $0.id == id }) else { return }
        change(&quote!.sections[index])
        dirtySections.insert(id)
        scheduleSave()
    }

    func deleteSection(_ id: String) async {
        guard isEditable, let q = quote, let index = q.sections.firstIndex(where: { $0.id == id }) else { return }
        let removed = q.sections[index]
        quote?.sections.remove(at: index)
        dirtySections.remove(id)
        removed.items.forEach { dirtyItems.remove($0.id) }
        do {
            try await api.delete("/api/quotes/\(quoteID)/sections/\(id)")
        } catch {
            quote?.sections.insert(removed, at: min(index, quote?.sections.count ?? 0))
            fail(error)
        }
    }

    func moveSections(from source: IndexSet, to destination: Int) {
        guard isEditable, quote != nil else { return }
        quote!.sections.move(fromOffsets: source, toOffset: destination)
        for i in quote!.sections.indices { quote!.sections[i].orderIndex = i }
        let order = quote!.sections.map { ["id": $0.id, "orderIndex": $0.orderIndex] as [String: Any] }
        Task { await run { try await self.api.send("PATCH", "/api/quotes/\(self.quoteID)/sections/reorder", array: order) } }
    }

    // MARK: Voci

    func addItem(to sectionID: String, from template: QuoteItem? = nil) async -> String? {
        guard isEditable, let sIndex = quote?.sections.firstIndex(where: { $0.id == sectionID }) else { return nil }
        var item = QuoteItem.new(orderIndex: quote!.sections[sIndex].items.count)
        if let template {
            item.description = template.description
            item.unitOfMeasure = template.unitOfMeasure
            item.quantity = template.quantity
            item.unitPrice = template.unitPrice
            item.discount = template.discount
            item.notes = template.notes
        }
        quote!.sections[sIndex].items.append(item)
        do {
            try await api.send("POST", "/api/quotes/\(quoteID)/items", json: item.json(sectionID: sectionID), as: Empty.self)
            return item.id
        } catch {
            removeItemLocally(item.id)
            fail(error)
            return nil
        }
    }

    func updateItem(_ id: String, _ change: (inout QuoteItem) -> Void) {
        guard isEditable, let (s, i) = locate(id) else { return }
        change(&quote!.sections[s].items[i])
        dirtyItems.insert(id)
        scheduleSave()
    }

    func deleteItem(_ id: String) async {
        guard isEditable, let (s, i) = locate(id) else { return }
        let removed = quote!.sections[s].items.remove(at: i)
        dirtyItems.remove(id)
        do {
            try await api.delete("/api/quotes/\(quoteID)/items/\(id)")
        } catch {
            quote?.sections[s].items.insert(removed, at: i)
            fail(error)
        }
    }

    /// Copia della voce subito sotto l'originale.
    func duplicateItem(_ id: String) async {
        guard isEditable, let (s, i) = locate(id) else { return }
        var copy = quote!.sections[s].items[i]
        copy = QuoteItem(id: newID(), description: copy.description, unitOfMeasure: copy.unitOfMeasure,
                         quantity: copy.quantity, unitPrice: copy.unitPrice, discount: copy.discount,
                         notes: copy.notes, orderIndex: i + 1, images: [])
        quote!.sections[s].items.insert(copy, at: i + 1)
        let sectionID = quote!.sections[s].id
        renumberItems(section: s)
        do {
            try await api.send("POST", "/api/quotes/\(quoteID)/items", json: copy.json(sectionID: sectionID), as: Empty.self)
            try await saveItemOrder(section: s)
        } catch {
            removeItemLocally(copy.id)
            fail(error)
        }
    }

    func moveItems(in sectionID: String, from source: IndexSet, to destination: Int) {
        guard isEditable, let s = quote?.sections.firstIndex(where: { $0.id == sectionID }) else { return }
        quote!.sections[s].items.move(fromOffsets: source, toOffset: destination)
        renumberItems(section: s)
        Task { await run { try await self.saveItemOrder(section: s) } }
    }

    func item(_ id: String) -> QuoteItem? {
        locate(id).map { quote!.sections[$0.0].items[$0.1] }
    }

    func sectionID(ofItem id: String) -> String? {
        locate(id).map { quote!.sections[$0.0].id }
    }

    // MARK: Foto

    func addImage(to itemID: String, data: Data) async {
        do {
            let json = try await api.upload("/api/upload", data: data, filename: "foto.jpg", mimeType: "image/jpeg",
                                            fields: ["quoteId": quoteID, "itemId": itemID])
            guard let id = json["id"] as? String, let url = json["cloudinaryUrl"] as? String,
                  let (s, i) = locate(itemID) else { return }
            quote!.sections[s].items[i].images.append(.init(id: id, cloudinaryUrl: url))
        } catch {
            fail(error)
        }
    }

    func deleteImage(_ imageID: String, from itemID: String) async {
        guard let (s, i) = locate(itemID) else { return }
        quote!.sections[s].items[i].images.removeAll { $0.id == imageID }
        await run { try await self.api.delete("/api/quotes/\(self.quoteID)/items/\(itemID)/images/\(imageID)") }
    }

    // MARK: Azioni sul preventivo

    func setStatus(_ status: QuoteStatus) async {
        guard isEditable, let old = quote?.status, old != status else { return }
        quote?.status = status
        do {
            try await api.send("PATCH", "/api/quotes/\(quoteID)/status", json: ["status": status.rawValue], as: Empty.self)
        } catch {
            quote?.status = old
            fail(error)
        }
    }

    func setLocked(_ locked: Bool) async {
        guard role == "admin" else { return }
        do {
            try await api.send("PATCH", "/api/quotes/\(quoteID)/\(locked ? "lock" : "unlock")", as: Empty.self)
            quote?.isLocked = locked
        } catch {
            fail(error)
        }
    }

    struct PublicLink: Decodable {
        let token: String
        let expiresAt: String
        let url: String
        let pin: String?
    }

    func createPublicLink(days: Int) async -> PublicLink? {
        do {
            let link: PublicLink = try await api.send("POST", "/api/quotes/\(quoteID)/public-link", json: ["days": days])
            quote?.publicToken = link.token
            quote?.publicTokenExpiresAt = link.expiresAt
            return link
        } catch {
            fail(error)
            return nil
        }
    }

    func revokePublicLink() async {
        await run {
            try await self.api.delete("/api/quotes/\(self.quoteID)/public-link")
            self.quote?.publicToken = nil
            self.quote?.publicTokenExpiresAt = nil
        }
    }

    func createExtra() async -> String? {
        do {
            await flush()
            let created: CreatedID = try await api.send("POST", "/api/quotes/\(quoteID)/extras")
            return created.id
        } catch {
            fail(error)
            return nil
        }
    }

    func trash() async -> Bool {
        do {
            saveTask?.cancel()
            try await api.delete("/api/quotes/\(quoteID)")
            return true
        } catch {
            fail(error)
            return false
        }
    }

    func exportFile(_ format: String) async -> URL? {
        await flush()
        do {
            return try await api.download(format == "pdf" ? "/api/export/pdf/\(quoteID)" : "/api/export/\(format)/\(quoteID)")
        } catch {
            fail(error)
            return nil
        }
    }

    // MARK: Salvataggio

    private func scheduleSave() {
        saveState = .pending
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(1200))
            guard !Task.isCancelled else { return }
            await save()
        }
    }

    /// Salva subito quello che è in sospeso (chiusura editor, PDF, extra).
    func flush() async {
        saveTask?.cancel()
        if headerDirty || !dirtySections.isEmpty || !dirtyItems.isEmpty { await save() }
    }

    private func save() async {
        guard let q = quote else { return }
        let header = headerDirty
        let sections = dirtySections
        let items = dirtyItems
        headerDirty = false
        dirtySections = []
        dirtyItems = []
        saveState = .saving
        do {
            if header {
                try await api.send("PATCH", "/api/quotes/\(q.id)", json: [
                    "title": q.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Senza titolo" : q.title,
                    "clientId": q.clientId,
                    "projectAddress": q.projectAddress.nonEmpty,
                    "vatRate": q.vatRate,
                    "discountType": q.discountType?.rawValue,
                    "discountValue": q.discountType == nil ? nil : (q.discountValue ?? 0),
                    "notes": q.notes.nonEmpty,
                    "paymentTerms": q.paymentTerms.nonEmpty,
                    "validUntil": q.validUntil,
                ], as: Empty.self)
            }
            for section in q.sections {
                if sections.contains(section.id) {
                    try await api.send("POST", "/api/quotes/\(q.id)/sections", json: section.json, as: Empty.self)
                }
                for item in section.items where items.contains(item.id) {
                    try await api.send("POST", "/api/quotes/\(q.id)/items", json: item.json(sectionID: section.id), as: Empty.self)
                }
            }
            if saveState == .saving { saveState = .saved }
        } catch {
            // Riprova al prossimo salvataggio.
            if header { headerDirty = true }
            dirtySections.formUnion(sections)
            dirtyItems.formUnion(items)
            saveState = .failed(error.localizedDescription)
        }
    }

    // MARK: Supporto

    private func locate(_ itemID: String) -> (Int, Int)? {
        guard let sections = quote?.sections else { return nil }
        for (s, section) in sections.enumerated() {
            if let i = section.items.firstIndex(where: { $0.id == itemID }) { return (s, i) }
        }
        return nil
    }

    private func removeItemLocally(_ id: String) {
        guard let (s, i) = locate(id) else { return }
        quote?.sections[s].items.remove(at: i)
    }

    private func renumberItems(section s: Int) {
        for i in quote!.sections[s].items.indices { quote!.sections[s].items[i].orderIndex = i }
    }

    private func saveItemOrder(section s: Int) async throws {
        guard let items = quote?.sections[s].items else { return }
        try await api.send("PATCH", "/api/quotes/\(quoteID)/items/reorder",
                           array: items.map { ["id": $0.id, "orderIndex": $0.orderIndex] })
    }

    private func run(_ work: @escaping () async throws -> Void) async {
        do { try await work() } catch { fail(error) }
    }

    private func fail(_ error: Error) {
        if case APIError.unauthorized = error { return }
        saveState = .failed(error.localizedDescription)
    }
}
