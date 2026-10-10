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

    /// Commit da cui è stata compilata (vuoto nelle build da Xcode).
    static var commit: String {
        Bundle.main.object(forInfoDictionaryKey: "DieffeCommit") as? String ?? ""
    }

    /// Scadenza della firma: con l'Apple ID gratuito il profilo dura 7 giorni.
    /// Si legge dal profilo incluso nell'app (nel Simulatore non c'è).
    static let signatureExpiry: Date? = {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let text = String(data: data, encoding: .isoLatin1),
              let start = text.range(of: "<?xml"), let end = text.range(of: "</plist>"),
              let plist = try? PropertyListSerialization.propertyList(
                  from: Data(text[start.lowerBound..<end.upperBound].utf8), format: nil) as? [String: Any]
        else { return nil }
        return plist["ExpirationDate"] as? Date
    }()

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
