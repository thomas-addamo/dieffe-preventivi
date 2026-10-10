import Foundation
import WebKit

enum APIError: LocalizedError {
    case unauthorized
    case server(String)
    case offline

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Sessione scaduta: accedi di nuovo."
        case .server(let message): message
        case .offline: "Sei offline. Controlla la connessione e riprova."
        }
    }
}

/// Chiamate alle API JSON del sito per le schermate native. La sessione è la
/// stessa delle pagine web: il cookie `dieffe_session` sta nell'archivio del
/// WKWebView, che resta l'unica fonte (login nativo o web, logout dal Profilo).
@MainActor
final class APIClient {
    static let shared = APIClient()

    /// Il server ha risposto 401: l'app mostra il login.
    var onUnauthorized: (() -> Void)?

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 30
        return URLSession(configuration: config)
    }()

    private var cookieStore: WKHTTPCookieStore { WKWebsiteDataStore.default().httpCookieStore }

    private let decoder = JSONDecoder()

    // MARK: Richieste

    func get<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        try decoder.decode(T.self, from: await perform(request(path, method: "GET")))
    }

    @discardableResult
    func send<T: Decodable>(_ method: String, _ path: String, json: [String: Any?] = [:],
                            as type: T.Type = T.self) async throws -> T {
        var req = request(path, method: method)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: json.mapValues { $0 ?? NSNull() })
        return try decoder.decode(T.self, from: await perform(req))
    }

    /// Corpo JSON come array (riordino di sezioni e voci).
    func send(_ method: String, _ path: String, array: [[String: Any]]) async throws {
        var req = request(path, method: method)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: array)
        _ = try await perform(req)
    }

    func delete(_ path: String) async throws {
        _ = try await perform(request(path, method: "DELETE"))
    }

    /// Invio di un file (multipart/form-data, campo "file" più eventuali campi
    /// di testo); risposta JSON grezza.
    func upload(_ path: String, data fileData: Data, filename: String, mimeType: String,
                fields: [String: String] = [:]) async throws -> [String: Any] {
        let boundary = "dieffe-\(UUID().uuidString)"
        var req = request(path, method: "POST")
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 90 // l'analisi con l'AI può richiedere fino a 60 secondi

        var body = Data()
        for (key, value) in fields {
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(key)\"\r\n\r\n\(value)\r\n".utf8))
        }
        let name = filename.replacingOccurrences(of: "\"", with: "")
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(name)\"\r\nContent-Type: \(mimeType)\r\n\r\n".utf8))
        body.append(fileData)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        req.httpBody = body

        let data = try await perform(req)
        return (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    func upload(_ path: String, file: URL, mimeType: String) async throws -> [String: Any] {
        try await upload(path, data: try Data(contentsOf: file), filename: file.lastPathComponent, mimeType: mimeType)
    }

    /// Scarica un file del sito (PDF, Excel…) in una cartella temporanea, con il
    /// nome suggerito dal server: pronto per Quick Look e Condividi.
    func download(_ path: String) async throws -> URL {
        var req = request(path, method: "GET")
        req.setValue("*/*", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 90
        let (data, response) = try await performWithResponse(req)
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("Documenti", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let dest = dir.appendingPathComponent(response.suggestedFilename ?? "documento.pdf")
        try? FileManager.default.removeItem(at: dest)
        try data.write(to: dest)
        return dest
    }

    /// JSON grezzo in entrata e in uscita (import: i dati analizzati tornano tali e quali).
    func sendRaw(_ method: String, _ path: String, json: [String: Any]) async throws -> [String: Any] {
        var req = request(path, method: method)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: json)
        let data = try await perform(req)
        return (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }

    // MARK: Accesso

    /// Login nativo: il cookie di sessione ricevuto va nell'archivio del WKWebView.
    func login(email: String, password: String) async throws -> LoginResult {
        var req = request("/api/auth/login", method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let (data, response) = try await data(for: req)
        guard let http = response as? HTTPURLResponse else { throw APIError.server("Risposta non valida.") }
        guard (200..<300).contains(http.statusCode) else { throw Self.error(from: data, status: http.statusCode) }

        let headers = http.allHeaderFields.reduce(into: [String: String]()) { result, pair in
            if let key = pair.key as? String, let value = pair.value as? String { result[key] = value }
        }
        let url = http.url ?? AppConfig.baseURL
        for cookie in HTTPCookie.cookies(withResponseHeaderFields: headers, for: url) {
            await cookieStore.setCookie(cookie)
        }
        return try decoder.decode(LoginResult.self, from: data)
    }

    /// Chiude la sessione sul server e toglie il cookie da app e pagine web.
    func logout() async {
        _ = try? await perform(request("/api/auth/logout", method: "POST"))
        for cookie in await cookieStore.allCookies() where cookie.name == "dieffe_session" {
            await cookieStore.deleteCookie(cookie)
        }
    }

    /// Imposta il cookie delle anteprime automatiche (solo build Debug).
    func installPreviewSession() async {
        if let cookie = PreviewOptions.sessionCookie { await cookieStore.setCookie(cookie) }
    }

    // MARK: Interni

    private func request(_ path: String, method: String) -> URLRequest {
        var req = URLRequest(url: AppConfig.url(for: path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("\(AppConfig.userAgentToken) (nativa)", forHTTPHeaderField: "User-Agent")
        return req
    }

    private func perform(_ request: URLRequest) async throws -> Data {
        try await performWithResponse(request).0
    }

    private func performWithResponse(_ request: URLRequest) async throws -> (Data, URLResponse) {
        var request = request
        let host = request.url?.host() ?? ""
        let cookies = await cookieStore.allCookies().filter {
            host.hasSuffix($0.domain.trimmingCharacters(in: ["."]))
        }
        for (key, value) in HTTPCookie.requestHeaderFields(with: cookies) {
            request.setValue(value, forHTTPHeaderField: key)
        }
        let (data, response) = try await data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 {
            onUnauthorized?()
            throw APIError.unauthorized
        }
        guard (200..<300).contains(status) else { throw Self.error(from: data, status: status) }
        return (data, response)
    }

    private func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch let error as URLError where [.notConnectedToInternet, .networkConnectionLost,
                                             .cannotConnectToHost, .timedOut].contains(error.code) {
            throw APIError.offline
        }
    }

    private static func error(from data: Data, status: Int) -> APIError {
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let message = json["error"] as? String {
            return .server(message)
        }
        return .server(status == 403 ? "Permessi insufficienti." : "Errore del server (\(status)). Riprova.")
    }
}

struct LoginResult: Decodable {
    let ok: Bool
    let mustChangePassword: Bool?
}

/// Risposta senza contenuto utile ({ ok: true } e simili).
struct Empty: Decodable {}
