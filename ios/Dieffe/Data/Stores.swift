import Observation
import SwiftUI

/// Dati della Home: GET /api/app/home.
@MainActor
@Observable
final class HomeStore {
    private(set) var data: HomeData?
    private(set) var error: String?
    private(set) var isLoading = false

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            data = try await APIClient.shared.get("/api/app/home")
            error = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error.localizedDescription
        }
    }

    /// Sposta nel cestino (recuperabile dal sito: Altro › Cestino).
    func trash(_ quote: QuoteSummary) async throws {
        try await APIClient.shared.delete("/api/quotes/\(quote.id)")
        data?.quotes.removeAll { $0.id == quote.id }
    }
}

/// Clienti con i loro preventivi: GET /api/app/clients.
@MainActor
@Observable
final class ClientsStore {
    private(set) var clients: [ClientRecord]?
    private(set) var error: String?

    func load() async {
        do {
            clients = try await APIClient.shared.get("/api/app/clients")
            error = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error.localizedDescription
        }
    }

    func client(_ id: String) -> ClientRecord? {
        clients?.first { $0.id == id }
    }

    /// Crea o aggiorna; restituisce il cliente salvato.
    func save(_ draft: ClientDraft, editing id: String?) async throws -> ClientRecord {
        let body = draft.json
        if let id {
            var saved: ClientRecord = try await APIClient.shared.send("PATCH", "/api/clients/\(id)", json: body)
            saved.quotes = client(id)?.quotes ?? []
            if let index = clients?.firstIndex(where: { $0.id == id }) { clients?[index] = saved }
            return saved
        }
        let saved: ClientRecord = try await APIClient.shared.send("POST", "/api/clients", json: body)
        clients?.insert(saved, at: 0)
        return saved
    }

    func delete(_ client: ClientRecord) async throws {
        try await APIClient.shared.delete("/api/clients/\(client.id)")
        clients?.removeAll { $0.id == client.id }
    }
}

/// Campi del modulo cliente.
struct ClientDraft {
    var name = ""
    var phone = ""
    var email = ""
    var vatNumber = ""
    var address = ""
    var notes = ""

    init() {}

    init(_ client: ClientRecord) {
        name = client.name
        phone = client.phone ?? ""
        email = client.email ?? ""
        vatNumber = client.vatNumber ?? ""
        address = client.address ?? ""
        notes = client.notes ?? ""
    }

    var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var emailError: String? {
        let value = email.trimmingCharacters(in: .whitespaces)
        guard !value.isEmpty else { return nil }
        return value.wholeMatch(of: /[^@\s]+@[^@\s]+\.[^@\s]+/) == nil ? "Email non valida" : nil
    }

    var isValid: Bool { !trimmedName.isEmpty && emailError == nil }

    var json: [String: Any?] {
        func optional(_ s: String) -> String? {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        }
        return [
            "name": trimmedName,
            "phone": optional(phone),
            "email": optional(email),
            "vatNumber": optional(vatNumber),
            "address": optional(address),
            "notes": optional(notes),
        ]
    }
}
