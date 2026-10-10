import Foundation

/// Opzioni di avvio per le anteprime automatiche nel Simulatore
/// (.github/workflows/ios-build.yml), es.
///   xcrun simctl launch booted <bundle> -DieffeTab clienti -DieffeSession <token>
/// Esistono solo nelle build Debug: l'app installata sull'iPhone le ignora.
enum PreviewOptions {
    #if DEBUG
    private static let defaults = UserDefaults.standard

    static var startTab: AppTab? {
        defaults.string(forKey: "DieffeTab").flatMap(AppTab.init(rawValue:))
    }

    static var showSettings: Bool {
        defaults.bool(forKey: "DieffeSettings")
    }

    /// Apre una pagina all'avvio, es. -DieffePage /statistiche (schermata nativa se c'è).
    static var startPage: String? {
        defaults.string(forKey: "DieffePage")
    }

    /// Apre un preventivo all'avvio: un id oppure "first" (il più recente).
    static var startQuote: String? { defaults.string(forKey: "DieffeQuote") }

    /// Nell'editor apre subito "summary" (riepilogo) o "chat" (assistente AI).
    static var editorSheet: String? { defaults.string(forKey: "DieffeEditorSheet") }

    /// Mostra il login nativo anche con una sessione valida (solo per le schermate).
    static var showLogin: Bool {
        defaults.bool(forKey: "DieffeLogin")
    }

    /// Cookie di sessione ottenuto dal workflow con il login dell'account anteprima.
    static var sessionCookie: HTTPCookie? {
        guard let token = defaults.string(forKey: "DieffeSession"), !token.isEmpty,
              let host = AppConfig.baseURL.host() else { return nil }
        return HTTPCookie(properties: [
            .name: "dieffe_session",
            .value: token,
            .domain: host,
            .path: "/",
            .secure: "TRUE",
            .expires: Date().addingTimeInterval(3600),
        ])
    }
    #else
    static let startTab: AppTab? = nil
    static let showSettings = false
    static let showLogin = false
    static let startPage: String? = nil
    static let startQuote: String? = nil
    static let editorSheet: String? = nil
    static let sessionCookie: HTTPCookie? = nil
    #endif
}
