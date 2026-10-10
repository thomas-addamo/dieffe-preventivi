import Observation
import UIKit
import WebKit

/// Una sezione dell'app = un WKWebView sul sito. Tutte le sezioni condividono
/// lo stesso archivio dati (cookie di sessione `dieffe_session`): un solo login.
@MainActor
@Observable
final class WebPageModel: NSObject {
    let tab: AppTab
    @ObservationIgnored weak var app: AppModel?

    var isLoading = false
    var progress = 0.0
    var loadError: String?
    var hasLoaded = false

    @ObservationIgnored private(set) lazy var webView: WKWebView = makeWebView()
    @ObservationIgnored private var observations: [NSKeyValueObservation] = []
    @ObservationIgnored private var downloads: [WKDownload: URL] = [:]

    init(tab: AppTab, app: AppModel) {
        self.tab = tab
        self.app = app
        super.init()
    }

    // MARK: Creazione

    private func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.applicationNameForUserAgent = "Mobile/15E148 Safari/604.1 \(AppConfig.userAgentToken)"
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.preferredContentMode = .mobile
        config.userContentController.add(MessageProxy(target: self), name: "dieffe")

        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = true
        view.allowsLinkPreview = false
        view.isOpaque = false
        view.backgroundColor = .systemBackground
        view.scrollView.backgroundColor = .systemBackground
        // Le safe area (notch, tab bar) le gestisce il CSS con env(safe-area-inset-*).
        view.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        view.isInspectable = true // Safari › Sviluppo › iPhone
        #endif

        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(pullToRefresh(_:)), for: .valueChanged)
        view.scrollView.refreshControl = refresh

        observations = [
            view.observe(\.estimatedProgress, options: [.new]) { [weak self] v, _ in
                MainActor.assumeIsolated { self?.progress = v.estimatedProgress }
            },
            view.observe(\.isLoading, options: [.new]) { [weak self] v, _ in
                MainActor.assumeIsolated { self?.isLoading = v.isLoading }
            },
        ]
        let start = URLRequest(url: AppConfig.url(for: tab.path))
        if let cookie = PreviewOptions.sessionCookie {
            config.websiteDataStore.httpCookieStore.setCookie(cookie) { view.load(start) }
        } else {
            view.load(start)
        }
        return view
    }

    @objc private func pullToRefresh(_ sender: UIRefreshControl) {
        webView.reload()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { sender.endRefreshing() }
    }

    // MARK: Navigazione

    /// Naviga a un percorso del sito: con il router della web-app se la pagina
    /// è pronta (nessun ricaricamento), altrimenti caricandolo.
    func navigate(to path: String) {
        let js = """
        (function(){ if (typeof window.__dieffeIOSNavigate === 'function') { window.__dieffeIOSNavigate(\(Self.jsString(path))); return true; } return false; })()
        """
        webView.evaluateJavaScript(js) { [weak self] result, _ in
            guard let self else { return }
            if (result as? Bool) != true {
                self.webView.load(URLRequest(url: AppConfig.url(for: path)))
            }
        }
    }

    func reload() {
        loadError = nil
        if webView.url == nil {
            webView.load(URLRequest(url: AppConfig.url(for: tab.path)))
        } else {
            webView.reload()
        }
    }

    private static func jsString(_ s: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [s])
        let array = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"/\"]"
        return String(array.dropFirst().dropLast())
    }

    // MARK: File (PDF, Excel, CSV)

    /// Scarica un file del sito con la sessione dell'utente e lo apre in Quick Look.
    func downloadForPreview(_ url: URL) async {
        do {
            let cookies = await webView.configuration.websiteDataStore.httpCookieStore.allCookies()
            var request = URLRequest(url: url)
            let host = url.host() ?? ""
            let sessionCookies = cookies.filter { host.hasSuffix($0.domain.trimmingCharacters(in: ["."])) }
            for (key, value) in HTTPCookie.requestHeaderFields(with: sessionCookies) {
                request.setValue(value, forHTTPHeaderField: key)
            }
            let (tmp, response) = try await URLSession.shared.download(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                throw URLError(.badServerResponse)
            }
            let name = response.suggestedFilename ?? "documento.pdf"
            let dest = Self.previewDirectory().appendingPathComponent(name)
            try? FileManager.default.removeItem(at: dest)
            try FileManager.default.moveItem(at: tmp, to: dest)
            app?.previewURL = dest
        } catch {
            app?.lastError = "Impossibile aprire il documento. Controlla la connessione e riprova."
        }
    }

    private static func previewDirectory() -> URL {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("Documenti", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
}

// MARK: - WKNavigationDelegate

extension WebPageModel: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }

        if action.shouldPerformDownload { return decisionHandler(.download) }

        switch url.scheme?.lowercased() {
        case "http", "https":
            // Link esterni (Maps, siti dei fornitori…): Safari o l'app dedicata.
            if !AppConfig.isAppURL(url), action.targetFrame?.isMainFrame ?? true {
                UIApplication.shared.open(url)
                return decisionHandler(.cancel)
            }
            decisionHandler(.allow)
        case "about", "blob", "data":
            decisionHandler(.allow)
        default:
            // tel:, mailto:, sms:, whatsapp:…
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let disposition = (response.response as? HTTPURLResponse)?
            .value(forHTTPHeaderField: "Content-Disposition")?.lowercased() ?? ""
        if !response.canShowMIMEType || disposition.hasPrefix("attachment") {
            decisionHandler(.download)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hasLoaded = true
        loadError = nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showError(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showError(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    private func showError(_ error: Error) {
        let ns = error as NSError
        // Navigazioni annullate (nuovo tap, download): non sono errori.
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return }
        if ns.domain == "WebKitErrorDomain" && (ns.code == 102 || ns.code == 204) { return }
        if !hasLoaded || ns.domain == NSURLErrorDomain {
            loadError = ns.code == NSURLErrorNotConnectedToInternet
                ? "Sei offline. Controlla la connessione e riprova."
                : "Impossibile raggiungere Dieffe Preventivi."
        }
    }
}

// MARK: - WKUIDelegate

extension WebPageModel: WKUIDelegate {
    /// target="_blank" / window.open: le pagine del sito restano qui, il resto va fuori.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if AppConfig.isAppURL(url), url.path().hasPrefix("/api/") {
                Task { await downloadForPreview(url) }
            } else if AppConfig.isAppURL(url) || url.scheme == "blob" {
                webView.load(action.request)
            } else {
                UIApplication.shared.open(url)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        present(alert: message, actions: [("OK", .default, { completionHandler() })])
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        present(alert: message, actions: [
            ("Annulla", .cancel, { completionHandler(false) }),
            ("OK", .default, { completionHandler(true) }),
        ])
    }

    private func present(alert message: String, actions: [(String, UIAlertAction.Style, () -> Void)]) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        for (title, style, handler) in actions {
            alert.addAction(UIAlertAction(title: title, style: style) { _ in handler() })
        }
        var top = webView.window?.rootViewController
        while let next = top?.presentedViewController { top = next }
        guard let top else {
            actions.first?.2()
            return
        }
        top.present(alert, animated: true)
    }
}

// MARK: - WKDownloadDelegate

extension WebPageModel: WKDownloadDelegate {
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let dest = Self.previewDirectory().appendingPathComponent(suggestedFilename)
        try? FileManager.default.removeItem(at: dest)
        downloads[download] = dest
        completionHandler(dest)
    }

    func downloadDidFinish(_ download: WKDownload) {
        if let url = downloads.removeValue(forKey: download) { app?.previewURL = url }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeValue(forKey: download)
        app?.lastError = "Download non riuscito, riprova."
    }
}

// MARK: - Messaggi JS → nativo

/// WKUserContentController trattiene il suo handler: il proxy evita il ciclo.
@MainActor
private final class MessageProxy: NSObject, WKScriptMessageHandler {
    weak var target: WebPageModel?
    init(target: WebPageModel) { self.target = target }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let target, AppConfig.isAppURL(message.frameInfo.request.url ?? AppConfig.baseURL) else { return }
        target.app?.handle(message: message.body, from: target)
    }
}
