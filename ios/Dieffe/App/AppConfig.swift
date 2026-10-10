import Foundation

/// Impostazioni fisse dell'app. L'indirizzo della web-app sta in Info.plist
/// (chiave `DieffeBaseURL`, da project.yml) per cambiarlo senza toccare il codice.
enum AppConfig {
    static let baseURL: URL = {
        if let value = Bundle.main.object(forInfoDictionaryKey: "DieffeBaseURL") as? String,
           let url = URL(string: value) {
            return url
        }
        return URL(string: "https://dieffe-preventivi.vercel.app")!
    }()

    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    static var build: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
    }

    /// Aggiunto allo User-Agent: il sito lo riconosce e nasconde la sua tab bar
    /// (vedi src/app/layout.tsx, data-shell="ios").
    static var userAgentToken: String { "DieffeiOS/\(version)" }

    static func url(for path: String) -> URL {
        URL(string: path, relativeTo: baseURL)?.absoluteURL ?? baseURL
    }

    static func isAppURL(_ url: URL) -> Bool {
        url.host() == baseURL.host()
    }
}
