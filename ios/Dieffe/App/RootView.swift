import QuickLook
import SwiftUI

/// Tab bar nativa (Liquid Glass su iOS 26+) con una pagina web per sezione.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        @Bindable var model = model

        TabView(selection: Binding(get: { model.selectedTab }, set: { model.select($0) })) {
            ForEach(AppTab.sections) { tab in
                Tab(tab.title, systemImage: tab.symbol, value: tab) {
                    WebPageView(page: model.page(tab))
                }
            }
            Tab(AppTab.nuovo.title, systemImage: AppTab.nuovo.symbol, value: AppTab.nuovo, role: .search) {
                Color.clear
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .quickLookPreview($model.previewURL)
        .sheet(isPresented: $model.showSettings) {
            SettingsView()
                .presentationDetents([.medium, .large])
        }
        .alert("Dieffe Preventivi", isPresented: Binding(
            get: { model.lastError != nil },
            set: { if !$0 { model.lastError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.lastError ?? "")
        }
        .overlay {
            if model.lock.isLocked {
                LockView()
                    .transition(.opacity)
            } else if scenePhase != .active {
                // Nel selettore app non si vedono importi e clienti.
                PrivacyCover()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: model.lock.isLocked)
        .onChange(of: scenePhase) { _, phase in
            model.lock.scenePhaseChanged(phase)
        }
    }
}

private struct PrivacyCover: View {
    var body: some View {
        ZStack {
            Rectangle().fill(.regularMaterial)
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: 84, height: 84)
        }
        .ignoresSafeArea()
    }
}
