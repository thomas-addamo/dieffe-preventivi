import QuickLook
import SwiftUI

/// Tab bar nativa (Liquid Glass): Home e Clienti in SwiftUI, Profilo e Altro
/// dal sito; l'editor dei preventivi (ancora web) si apre a tutto schermo.
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
            ForEach(AppTab.webSections) { tab in
                Tab(tab.title, systemImage: tab.symbol, value: tab) {
                    WebPageView(page: model.page(tab))
                }
            }
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
        .sheet(isPresented: $model.showPriceList) {
            PriceListView()
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
        }
        .task(id: model.dataVersion) {
            // Utente e permessi servono a tutte le schermate, non solo alla Home.
            await APIClient.shared.installPreviewSession()
            await model.home.load()
        }
        .task {
            // La pagina Altro tiene aggiornato il badge delle notifiche.
            _ = model.page(.altro).webView
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
