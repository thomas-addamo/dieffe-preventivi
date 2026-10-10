import Observation
import SwiftUI
import UserNotifications

/// Stato condiviso dell'app: una pagina web per sezione, tab selezionata,
/// anteprima file (Quick Look) e impostazioni native.
@MainActor
@Observable
final class AppModel {
    var selectedTab: AppTab = .home
    /// File da mostrare in Quick Look (PDF, Excel…), con Condividi/Salva su File.
    var previewURL: URL?
    var showSettings = false
    var lastError: String?

    let lock = AppLock()
    @ObservationIgnored private(set) var pages: [AppTab: WebPageModel] = [:]

    init() {
        for tab in AppTab.sections {
            pages[tab] = WebPageModel(tab: tab, app: self)
        }
        if let tab = PreviewOptions.startTab { selectedTab = tab }
        showSettings = PreviewOptions.showSettings
    }

    func page(_ tab: AppTab) -> WebPageModel {
        pages[tab]!
    }

    /// Tap sulla tab bar: un secondo tap sulla stessa sezione torna alla sua
    /// pagina iniziale; "Nuovo" apre il nuovo preventivo nella Home.
    func select(_ tab: AppTab) {
        if tab == .nuovo {
            selectedTab = .home
            page(.home).navigate(to: AppTab.nuovo.path)
            return
        }
        if tab == selectedTab {
            page(tab).navigate(to: tab.path)
        }
        selectedTab = tab
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
        default:
            break
        }
    }

    private static var badgeAuthorized: Bool?

    private static func setBadge(_ count: Int) async {
        let center = UNUserNotificationCenter.current()
        if badgeAuthorized == nil {
            badgeAuthorized = (try? await center.requestAuthorization(options: [.badge])) ?? false
        }
        guard badgeAuthorized == true else { return }
        try? await center.setBadgeCount(count)
    }
}
