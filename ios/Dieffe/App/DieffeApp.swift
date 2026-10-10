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
                    // dieffe://open?path=/preventivi/<id>
                    let path = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                        .queryItems?.first { $0.name == "path" }?.value
                    model.openPath(path ?? "/dashboard")
                }
        }
    }
}
