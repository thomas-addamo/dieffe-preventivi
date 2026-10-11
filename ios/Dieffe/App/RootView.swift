import QuickLook
import SwiftUI
import WebKit

/// Barra in basso (Liquid Glass): Home, Clienti, Listino, Altro e, a parte, il tasto ＋.
/// L'editor dei preventivi si apre a tutto schermo; il Profilo in un foglio.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        @Bindable var model = model

        // Barra Liquid Glass fatta in casa: con la tab bar di sistema il ＋
        // resterebbe nella stessa capsula delle sezioni (iOS 27).
        ZStack {
            ForEach(AppTab.sections) { tab in
                section(tab)
                    .opacity(model.selectedTab == tab ? 1 : 0)
                    .allowsHitTesting(model.selectedTab == tab)
                    .accessibilityHidden(model.selectedTab != tab)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            AppTabBar()
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
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
                let quotes = model.home.data?.quotes ?? []
                let id = start == "first" ? quotes.first?.id : quotes.first { $0.code == start }?.id ?? start
                if let id { model.openQuote(id) }
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
            if SelfTest.signatureTestRequested { await SelfTest.runSignatureTest(app: model) }
            if SelfTest.notificationTestRequested { await SelfTest.runNotificationTest(app: model) }
            #endif
        }
    }
}

extension RootView {
    @ViewBuilder
    private func section(_ tab: AppTab) -> some View {
        switch tab {
        case .home: HomeView()
        case .clienti: ClientsView()
        case .listino: PriceListHome()
        case .altro, .nuovo: AltroView()
        }
    }
}

/// Le quattro sezioni in una capsula di vetro e il ＋ in un cerchio separato.
private struct AppTabBar: View {
    @Environment(AppModel.self) private var model
    @Namespace private var selection

    var body: some View {
        GlassEffectContainer(spacing: 14) {
            HStack(spacing: 14) {
                HStack(spacing: 0) {
                    ForEach(AppTab.sections) { tab in
                        button(tab)
                    }
                }
                .padding(4)
                .glassEffect(.regular.interactive(), in: .capsule)

                Button { model.select(.nuovo) } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 62, height: 62)
                        .contentShape(.circle)
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.tint(.accentColor).interactive(), in: .circle)
                .accessibilityLabel("Nuovo preventivo")
            }
        }
        .padding(.horizontal, 20)
        // Stessa altezza della tab bar di sistema: dentro la zona dell'indicatore Home.
        .padding(.bottom, -16)
    }

    private func button(_ tab: AppTab) -> some View {
        let selected = model.selectedTab == tab
        return Button {
            withAnimation(.snappy(duration: 0.3)) { model.select(tab) }
        } label: {
            VStack(spacing: 2) {
                Image(systemName: tab.symbol)
                    .symbolVariant(selected ? .fill : .none)
                    .font(.system(size: 19, weight: .medium))
                    .frame(height: 26)
                    .overlay(alignment: .topTrailing) {
                        if tab == .altro, badge > 0 {
                            Text("\(badge)")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 5)
                                .frame(minWidth: 17, minHeight: 17)
                                .background(.red, in: .capsule)
                                .offset(x: 10, y: -4)
                        }
                    }
                Text(tab.title)
                    .font(.system(size: 10, weight: .semibold))
            }
            .foregroundStyle(selected ? Color.accentColor : Color.primary)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background {
                if selected {
                    Capsule()
                        .fill(Color.primary.opacity(0.08))
                        .matchedGeometryEffect(id: "selected", in: selection)
                }
            }
            .contentShape(.capsule)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var badge: Int {
        guard model.canEdit else { return 0 }
        return model.home.data?.trashCount ?? 0
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
