import QuickLook
import SwiftUI
import WebKit

/// Tab bar nativa (Liquid Glass): Home, Clienti, Listino, Altro e il tasto ＋.
/// L'editor dei preventivi si apre a tutto schermo; il Profilo in un foglio.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        @Bindable var model = model

        TabView(selection: Binding(get: { model.selectedTab }, set: { model.select($0) })) {
            Tab(AppTab.home.title, systemImage: AppTab.home.symbol, value: AppTab.home) {
                HomeView()
            }
            Tab(AppTab.clienti.title, systemImage: AppTab.clienti.symbol, value: AppTab.clienti) {
                ClientsView()
            }
            Tab(AppTab.listino.title, systemImage: AppTab.listino.symbol, value: AppTab.listino) {
                PriceListHome()
            }
            Tab(AppTab.altro.title, systemImage: AppTab.altro.symbol, value: AppTab.altro) {
                AltroView()
            }
            .badge(model.home.data?.trashCount.flatMap { $0 > 0 && model.canEdit ? $0 : nil } ?? 0)
            Tab(AppTab.nuovo.title, systemImage: AppTab.nuovo.symbol, value: AppTab.nuovo, role: .search) {
                Color.clear
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .sheet(isPresented: $model.showNewQuote, onDismiss: model.openPendingQuote) {
            NewQuoteView()
        }
        .sheet(isPresented: $model.showImport, onDismiss: model.openPendingQuote) {
            ImportQuoteView()
        }
        .fullScreenCover(item: $model.editor, onDismiss: model.closeEditor) { session in
            Group {
                if let page = session.page {
                    QuoteEditorScreen(page: page)
                } else {
                    QuoteEditorView(quoteID: session.quoteID)
                }
            }
            .appMessages(active: true)
        }
        .sheet(isPresented: $model.showNotifications) {
            NotificationsView()
        }
        .sheet(isPresented: $model.showProfile) {
            NavigationStack {
                ProfileView(inSheet: true)
            }
        }
        .appMessages(active: model.editor == nil)
        .sheet(isPresented: $model.showSettings) {
            SettingsView()
                .presentationDetents([.medium, .large])
        }
        .overlay {
            if model.needsLogin {
                LoginView()
                    .transition(.opacity)
            }
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
        .animation(.easeInOut(duration: 0.25), value: model.needsLogin)
        .onChange(of: scenePhase) { _, phase in
            model.lock.scenePhaseChanged(phase)
            if phase != .inactive { LocalNotifier.shared.scenePhaseChanged(active: phase == .active) }
        }
        .task(id: model.dataVersion) {
            // Utente e permessi servono a tutte le schermate, non solo alla Home.
            #if DEBUG
            // -DieffeDropWebSession YES: simula il cookie web perso (iPhone senza pagine web aperte).
            if UserDefaults.standard.bool(forKey: "DieffeDropWebSession") {
                let store = WKWebsiteDataStore.default().httpCookieStore
                for cookie in await store.allCookies() where cookie.name == SessionStore.cookieName {
                    await store.deleteCookie(cookie)
                }
            }
            #endif
            await APIClient.shared.restoreSession()
            await model.home.load()
            if let unread = model.home.data?.unreadNotifications { await AppModel.setBadge(unread) }
            if let start = PreviewOptions.startQuote, model.editor == nil {
                if let id = start == "first" ? model.home.data?.quotes.first?.id : start { model.openQuote(id) }
            }
        }
        .task {
            LocalNotifier.shared.start()
            LocalNotifier.shared.scenePhaseChanged(active: true)
        }
        .task {
            #if DEBUG
            if UserDefaults.standard.bool(forKey: "DieffeKeychainTest") { SelfTest.runKeychainTest() }
            if SelfTest.isRequested { await SelfTest.run(app: model) }
            if SelfTest.notificationTestRequested { await SelfTest.runNotificationTest(app: model) }
            #endif
        }
    }
}

/// Editor del preventivo del sito ("Apri nel sito") a tutto schermo: la sua
/// freccia "indietro" porta alla dashboard, e l'app chiude l'editor (vedi AppModel.route).
private struct QuoteEditorScreen: View {
    let page: WebPageModel

    var body: some View {
        WebPageView(page: page)
            .background(Color(.systemBackground))
    }
}

private extension View {
    /// Quick Look e avvisi: presentati dalla vista in primo piano (l'editor a
    /// tutto schermo o la tab bar), altrimenti iOS non li mostrerebbe.
    func appMessages(active: Bool) -> some View {
        modifier(AppMessages(active: active))
    }
}

private struct AppMessages: ViewModifier {
    @Environment(AppModel.self) private var model
    let active: Bool

    func body(content: Content) -> some View {
        content
            .quickLookPreview(Binding(
                get: { active ? model.previewURL : nil },
                set: { model.previewURL = $0 }
            ))
            .alert("Dieffe Preventivi", isPresented: Binding(
                get: { active && model.lastError != nil },
                set: { if !$0 { model.lastError = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(model.lastError ?? "")
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
