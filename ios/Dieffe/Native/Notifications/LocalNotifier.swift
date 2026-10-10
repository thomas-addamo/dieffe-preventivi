import BackgroundTasks
import Observation
import UIKit
import UserNotifications

/// Notifiche di sistema senza i server push di Apple (non disponibili con un
/// Apple ID gratuito): l'app legge le notifiche nuove del sito
/// (GET /api/notifications) e le mostra come notifiche locali.
/// - App aperta: controllo ogni minuto, banner immediato.
/// - App in background: iOS la risveglia periodicamente (Background App
///   Refresh, di solito entro qualche decina di minuti, a seconda dell'uso).
@MainActor
@Observable
final class LocalNotifier: NSObject {
    static let shared = LocalNotifier()
    nonisolated static let refreshTaskID = "it.dieffe.preventivi.refresh"

    private static let enabledKey = "localNotificationsEnabled"
    private static let seenKey = "notifiedIDs"

    var isEnabled: Bool = UserDefaults.standard.bool(forKey: enabledKey) {
        didSet { UserDefaults.standard.set(isEnabled, forKey: Self.enabledKey) }
    }
    private(set) var authorization: UNAuthorizationStatus = .notDetermined
    /// Falso se iOS permette solo il badge (le prime versioni chiedevano solo quello).
    private(set) var alertsAllowed = true
    private(set) var lastCheck: Date?

    /// Apre la pagina di una notifica toccata (impostato da AppModel).
    @ObservationIgnored var open: ((String) -> Void)?
    @ObservationIgnored private var timer: Task<Void, Never>?

    private var seen: Set<String> {
        get { Set(UserDefaults.standard.stringArray(forKey: Self.seenKey) ?? []) }
        set { UserDefaults.standard.set(Array(newValue.suffix(300)), forKey: Self.seenKey) }
    }

    // MARK: Avvio

    /// Da chiamare all'avvio, prima che l'app finisca di partire.
    nonisolated static func registerBackgroundTask() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: refreshTaskID, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else { return }
            Task { @MainActor in
                LocalNotifier.shared.scheduleBackgroundRefresh()
                let work = Task { await LocalNotifier.shared.check() }
                task.expirationHandler = { work.cancel() }
                await work.value
                task.setTaskCompleted(success: true)
            }
        }
    }

    func start() {
        UNUserNotificationCenter.current().delegate = self
        Task { await refreshAuthorization() }
    }

    // MARK: Attivazione

    func enable() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        await refreshAuthorization()
        guard granted else { isEnabled = false; return false }
        isEnabled = true
        // Le notifiche già presenti non diventano avvisi: solo quelle nuove.
        await check(markOnly: true)
        scheduleBackgroundRefresh()
        return true
    }

    func disable() {
        isEnabled = false
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.refreshTaskID)
    }

    func refreshAuthorization() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        authorization = settings.authorizationStatus
        alertsAllowed = settings.alertSetting == .enabled
        if authorization == .denied { isEnabled = false }
    }

    // MARK: Ciclo

    func scenePhaseChanged(active: Bool) {
        timer?.cancel()
        guard isEnabled else { return }
        if active {
            timer = Task {
                while !Task.isCancelled {
                    await check()
                    try? await Task.sleep(for: .seconds(60))
                }
            }
        } else {
            scheduleBackgroundRefresh()
        }
    }

    func scheduleBackgroundRefresh() {
        guard isEnabled else { return }
        let request = BGAppRefreshTaskRequest(identifier: Self.refreshTaskID)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    struct Item: Decodable {
        let id: String
        let title: String
        let body: String?
        let link: String?
    }

    private struct Response: Decodable {
        let notifications: [Item]
        let unreadCount: Int
    }

    /// Legge le notifiche non lette e avvisa di quelle mai viste.
    func check(markOnly: Bool = false) async {
        guard isEnabled else { return }
        guard let response: Response = try? await APIClient.shared.get("/api/notifications?unread=1&limit=20") else { return }
        lastCheck = .now
        var seen = self.seen
        let fresh = response.notifications.filter { !seen.contains($0.id) }
        for item in fresh.reversed() where !markOnly {
            let content = UNMutableNotificationContent()
            content.title = item.title
            if let body = item.body, !body.isEmpty { content.body = body }
            content.sound = .default
            content.threadIdentifier = "dieffe"
            content.userInfo = ["id": item.id, "link": item.link ?? "/dashboard"]
            try? await UNUserNotificationCenter.current()
                .add(UNNotificationRequest(identifier: item.id, content: content, trigger: nil))
        }
        fresh.forEach { seen.insert($0.id) }
        self.seen = seen
        await AppModel.setBadge(response.unreadCount)
    }
}

extension LocalNotifier: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification)
        async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound, .badge]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        let id = info["id"] as? String
        let link = info["link"] as? String ?? "/dashboard"
        await MainActor.run { LocalNotifier.shared.open?(link) }
        if let id {
            _ = try? await APIClient.shared.send("PATCH", "/api/notifications/\(id)", as: Empty.self)
        }
    }
}
