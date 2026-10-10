import SwiftUI

@main
struct DieffeApp: App {
    @State private var model = AppModel()
    @AppStorage("appearance") private var appearance: Appearance = .system

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(Color.accentColor)
                .preferredColorScheme(appearance.colorScheme)
        }
    }
}
