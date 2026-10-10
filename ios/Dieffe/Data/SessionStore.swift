import Foundation
import Security

/// Sessione dell'utente (cookie `dieffe_session`) nel Portachiavi di iOS.
///
/// L'archivio cookie di WKWebView scrive su disco solo quando l'app apre una
/// pagina web: con le schermate native il cookie del login poteva restare in
/// memoria e sparire alla riapertura dell'app. Il Portachiavi è la fonte
/// sicura e persistente (cifrato, legato a questo dispositivo, leggibile anche
/// dall'aggiornamento in background dopo il primo sblocco).
enum SessionStore {
    static let cookieName = "dieffe_session"
    private static let service = "it.dieffe.preventivi.session"
    private static let account = "dieffe_session"

    struct Session: Codable {
        let token: String
        let expires: Date?
    }

    static func load() -> Session? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let session = try? JSONDecoder().decode(Session.self, from: data) else { return nil }
        if let expires = session.expires, expires < .now {
            clear()
            return nil
        }
        return session
    }

    static func save(token: String, expires: Date?) {
        guard let data = try? JSONEncoder().encode(Session(token: token, expires: expires)) else { return }
        let update: [String: Any] = [kSecValueData as String: data]
        if SecItemUpdate(baseQuery as CFDictionary, update as CFDictionary) == errSecItemNotFound {
            var add = baseQuery
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    static func save(_ cookie: HTTPCookie) {
        guard cookie.name == cookieName else { return }
        save(token: cookie.value, expires: cookie.expiresDate)
    }

    static func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }

    /// Il cookie da rimettere nell'archivio delle pagine web.
    static func cookie(for host: String) -> HTTPCookie? {
        guard let session = load() else { return nil }
        var properties: [HTTPCookiePropertyKey: Any] = [
            .name: cookieName, .value: session.token, .domain: host, .path: "/", .secure: "TRUE",
        ]
        properties[.expires] = session.expires ?? Date(timeIntervalSinceNow: 30 * 86400)
        return HTTPCookie(properties: properties)
    }

    private static var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }
}
