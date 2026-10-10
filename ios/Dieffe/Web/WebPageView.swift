import SwiftUI
import WebKit

/// Mostra il WKWebView di una sezione, con barra di avanzamento e schermata
/// nativa di errore/offline.
struct WebPageView: View {
    let page: WebPageModel
    /// L'editor del sito va sotto la status bar; le pagine incorporate stanno
    /// sotto la barra di navigazione nativa.
    var fullScreen = true

    var body: some View {
        ZStack(alignment: .top) {
            WebViewContainer(webView: page.webView)
                .ignoresSafeArea(edges: fullScreen ? .all : .bottom)
                .opacity(page.loadError == nil ? 1 : 0)

            if let error = page.loadError {
                ContentUnavailableView {
                    Label("Nessuna connessione", systemImage: "wifi.slash")
                } description: {
                    Text(error)
                } actions: {
                    Button("Riprova") { page.reload() }
                        .buttonStyle(.glassProminent)
                }
            } else if !page.hasLoaded {
                ProgressView()
                    .controlSize(.large)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            if page.isLoading && page.hasLoaded {
                ProgressView(value: page.progress)
                    .progressViewStyle(.linear)
                    .tint(Color.accentColor)
                    .frame(height: 2)
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.2), value: page.isLoading)
    }
}

private struct WebViewContainer: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
