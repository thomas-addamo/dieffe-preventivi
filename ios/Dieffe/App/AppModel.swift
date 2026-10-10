import Observation
import SwiftUI
import UserNotifications

/// Stato condiviso dell'app: schermate native, pagine del sito aperte da
/// Altro, accesso, anteprima file (Quick Look) e impostazioni.
@MainActor
@Observable
final class AppModel {
    var selectedTab: AppTab = .home
    /// File da mostrare in Quick Look (PDF, Excel…), con Condividi/Salva su File.
    var previewURL: URL?
    var showSettings = false
    var lastError: String?

    /// Nessuna sessione valida: si mostra il login nativo.
    var needsLogin = false
    var currentUser: CurrentUser? { home.data?.user }
    var canEdit: Bool { currentUser?.canEdit ?? false }

    // Creazione
    var showNewQuote = false
    var showImport = false
    /// Cliente già scelto per il nuovo preventivo (dalla scheda cliente).
    var newQuoteClient: ClientRef?
    /// Preventivo appena creato: l'editor si apre quando il foglio è chiuso.
    @ObservationIgnored var quoteToOpen: String?

    /// Editor del preventivo a tutto schermo: nativo, oppure il sito ("Apri nel sito").
    var editor: EditorSession?
    var showProfile = false
    var clientsPath = NavigationPath()
    var priceListPath = NavigationPath()
    var altroPath = NavigationPath()

    /// Cresce a ogni modifica dei dati: Home e Clienti si ricaricano.
    private(set) var dataVersion = 0

    let lock = AppLock()
    let home = HomeStore()
    let clients = ClientsStore()
    let recents = RecentQuotes()
    let priceList = PriceListStore()

    init() {
        if let tab = PreviewOptions.startTab { selectedTab = tab }
        showSettings = PreviewOptions.showSettings
        needsLogin = PreviewOptions.showLogin
        if let page = PreviewOptions.startPage { openWebPage(page, title: WebDestination.title(for: page)) }
        APIClient.shared.onUnauthorized = { [weak self] in self?.sessionExpired() }
    }

    func dataChanged() {
        dataVersion += 1
    }

    // MARK: Tab bar

    /// Tap sulla tab bar: un secondo tap sulla stessa sezione torna alla sua
    /// pagina iniziale; "Nuovo" apre il foglio del nuovo preventivo.
    func select(_ tab: AppTab) {
        if tab == .nuovo {
            newQuote()
            return
        }
        if tab == selectedTab {
            switch tab {
            case .clienti: clientsPath = NavigationPath()
            case .listino: priceListPath = NavigationPath()
            case .altro: altroPath = NavigationPath()
            default: break
            }
        }
        selectedTab = tab
    }

    func newQuote(client: ClientRef? = nil) {
        guard canEdit else {
            lastError = currentUser == nil
                ? "Attendi il caricamento dei dati e riprova."
                : "Il tuo profilo può consultare i preventivi ma non crearli."
            return
        }
        newQuoteClient = client
        showNewQuote = true
    }

    // MARK: Editor

    func openQuote(_ id: String) {
        recents.add(id)
        if editor?.quoteID == id, editor?.page == nil { return }
        editor = EditorSession(quoteID: id, page: nil)
    }

    /// L'editor del sito, per le funzioni non ancora native (chat AI, riassegna…).
    func openWebEditor(_ id: String) {
        editor = EditorSession(quoteID: id, page: WebPageModel(path: "/preventivi/\(id)", role: .editor, app: self))
    }

    func closeEditor() {
        guard editor != nil else { return }
        editor = nil
        dataChanged()
    }

    /// Dopo la chiusura dei fogli di creazione.
    func openPendingQuote() {
        guard let id = quoteToOpen else { return }
        quoteToOpen = nil
        dataChanged()
        openQuote(id)
    }

    // MARK: Accesso

    func didLogin(mustChangePassword: Bool) {
        needsLogin = false
        altroPath = NavigationPath()
        dataChanged()
        if mustChangePassword {
            showProfile = true
            lastError = "Per sicurezza imposta una nuova password dal Profilo."
        }
    }

    /// Una pagina dentro Altro: la schermata nativa se c'è, altrimenti il
    /// sito con titolo e "indietro" nativi.
    func openWebPage(_ path: String, title: String) {
        selectedTab = .altro
        if let route = AltroRoute(path: path) {
            altroPath.append(route)
        } else {
            altroPath.append(WebDestination(path: path, title: title))
        }
    }

    func open(_ route: AltroRoute) {
        selectedTab = .altro
        altroPath = NavigationPath()
        altroPath.append(route)
    }

    /// Esci: chiude la sessione sul server e cancella il cookie dall'app.
    func logout() async {
        await APIClient.shared.logout()
        home.reset()
        clients.reset()
        sessionExpired()
        selectedTab = .home
        altroPath = NavigationPath()
    }

    private func sessionExpired() {
        editor = nil
        showProfile = false
        showNewQuote = false
        showImport = false
        needsLogin = true
    }

    // MARK: Messaggi dal sito (src/lib/ios-app.ts)

    func handle(message body: Any, from page: WebPageModel) {
        guard let dict = body as? [String: Any], let action = dict["action"] as? String else { return }
        switch action {
        case "pdf":
            guard let raw = dict["url"] as? String, let url = URL(string: raw) else { return }
            Task { await page.downloadForPreview(url) }
        case "badge":
            let count = (dict["count"] as? Int) ?? 0
            Task { await Self.setBadge(count) }
        case "settings":
            showSettings = true
        case "route":
            if let path = dict["path"] as? String { route(path, from: page) }
        default:
            break
        }
    }

    /// Il sito ha cambiato pagina: le pagine che ora sono native si aprono
    /// nell'app invece che nel WKWebView.
    private func route(_ path: String, from page: WebPageModel) {
        if path.hasPrefix("/login") {
            sessionExpired()
            return
        }
        let destination = NativeDestination(path: path)
        switch page.role {
        case .editor:
            // Dentro l'editor si può passare a un altro preventivo (es. lavori extra).
            if case .quote = destination { return }
            closeEditor()
            open(destination, path: path)
        case .embedded:
            guard let destination else { return }
            page.goBack()
            open(destination, path: path)
        }
    }

    private func open(_ destination: NativeDestination?, path: String) {
        switch destination {
        case .home: selectedTab = .home
        case .clients: selectedTab = .clienti
        case .quote(let id): openQuote(id)
        case .priceList: selectedTab = .listino
        case .profile: showProfile = true
        case .more: selectedTab = .altro
        case nil:
            // Altre pagine del sito (cestino, statistiche…) dentro Altro.
            openWebPage(path, title: WebDestination.title(for: path))
        }
    }

    private static var badgeAuthorized: Bool?

    static func setBadge(_ count: Int) async {
        let center = UNUserNotificationCenter.current()
        if badgeAuthorized == nil {
            badgeAuthorized = (try? await center.requestAuthorization(options: [.badge])) ?? false
        }
        guard badgeAuthorized == true else { return }
        try? await center.setBadgeCount(count)
    }
}

/// Pagine del sito che nell'app sono schermate native.
enum NativeDestination: Equatable {
    case home, clients, quote(String), priceList, profile, more

    init?(path: String) {
        let parts = path.split(separator: "/").map(String.init)
        switch parts.first {
        case "dashboard": self = .home
        case "clienti": self = .clients
        case "listino": self = .priceList
        case "profilo": self = .profile
        case "altro": self = .more
        case "preventivi":
            if parts.count >= 2, parts[1] != "nuovo" { self = .quote(parts[1]) } else { self = .home }
        default: return nil
        }
    }
}

/// Pagina del sito aperta dentro la NavigationStack di Altro.
struct WebDestination: Hashable {
    let path: String
    let title: String

    static func title(for path: String) -> String {
        let titles = ["/lavori-extra": "Lavori extra", "/statistiche": "Statistiche", "/comunicazioni": "Comunicazioni",
                      "/cestino": "Cestino", "/impostazioni": "Impostazioni", "/utenti": "Utenti",
                      "/admin/notifiche": "Invia notifica", "/admin/audit-log": "Audit Log",
                      "/admin/sessioni": "Sessioni attive"]
        return titles.first { path.hasPrefix($0.key) }?.value ?? "Dieffe"
    }
}

struct EditorSession: Identifiable {
    let quoteID: String
    /// nil = editor nativo; altrimenti la pagina del sito.
    let page: WebPageModel?
    var id: String { page == nil ? quoteID : "web-\(quoteID)" }
}

/// Ultimi preventivi aperti dall'app (come "Aperti di recente" sul sito).
@MainActor
@Observable
final class RecentQuotes {
    private static let key = "recentQuotes"
    private(set) var ids: [String] = UserDefaults.standard.stringArray(forKey: key) ?? []

    func add(_ id: String) {
        ids = Array(([id] + ids.filter { $0 != id }).prefix(8))
        UserDefaults.standard.set(ids, forKey: Self.key)
    }
}
