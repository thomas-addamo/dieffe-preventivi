import SwiftUI

@main
struct DieffeApp: App {
    @State private var model = AppModel()
    @AppStorage("appearance") private var appearance: Appearance = .system

    init() {
        LocalNotifier.registerBackgroundTask()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(Color.accentColor)
                .preferredColorScheme(appearance.colorScheme)
                .onOpenURL { url in
                    // dieffe://open?path=/preventivi/<id>[&action=item|endvisit]
                    let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
                    let path = items.first { $0.name == "path" }?.value ?? "/dashboard"
                    let action = items.first { $0.name == "action" }?.value
                    if path.hasPrefix("/preventivi/") {
                        let quoteID = String(path.dropFirst("/preventivi/".count))
                        switch action {
                        case "item": model.pendingAddItem = quoteID
                        case "endvisit":
                            Task {
                                await LiveActivities.endSiteVisit(quoteID)
                                model.openPath(path)
                            }
                            return
                        default: break
                        }
                    }
                    model.openPath(path)
                }
        }
    }
}
