import SwiftUI
import UIKit

// ─────────────────────────────────────────────────────────────────────────────
// Menu laterale (D2), al posto della scheda "Altro". Stesso modello dell'app
// Polso (thomas-addamo/polso, iOS/RootView.swift), che a sua volta riprende
// l'app Claude:
//  • il menu sta sotto, su un fondo leggermente più scuro della pagina;
//  • aprendo, la pagina scorre a destra e diventa una scheda: gli angoli
//    crescono con l'apertura fino al raggio dello schermo dell'iPhone (border
//    radius annidato), con bordo sottile e ombra;
//  • il menu entra con un leggero scorrimento e dissolvenza;
//  • animazione a molla; si apre trascinando dai primi 60 punti del bordo
//    sinistro (solo nelle schermate principali, così il gesto "indietro"
//    resta libero) o con ☰; si chiude toccando la pagina o trascinandola;
//  • vibrazione all'apertura e alla chiusura;
//  • a menu chiuso la pagina non viene ritagliata né ombreggiata: gli angoli
//    sono disegnati sopra solo mentre il menu è aperto (passaggio tra le
//    schede pulito, senza sfarfallii di titoli e ricerca).
// ─────────────────────────────────────────────────────────────────────────────

/// Pagina aperta dal menu laterale.
enum MenuPage: Hashable, Identifiable {
    case route(AltroRoute)
    case web(WebDestination)
    case help
    case appSettings

    var id: Self { self }
}

/// Fondo del menu: un tono più scuro della pagina (come Polso), così la scheda si stacca.
private let menuBackground = Color(uiColor: UIColor {
    $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.035, green: 0.035, blue: 0.045, alpha: 1)
        : UIColor(red: 0.905, green: 0.915, blue: 0.94, alpha: 1)
})

/// Raggio degli angoli dello schermo dell'iPhone (55 se iOS non lo dice).
@MainActor
let screenCornerRadius: CGFloat = {
    let value = (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.value(forKey: "_displayCornerRadius") as? CGFloat
    return value.flatMap { $0 > 0 ? $0 : nil } ?? 55
}()

private let menuSpring = Animation.spring(response: 0.38, dampingFraction: 0.86)

extension View {
    /// Il menu laterale sopra le schede (in RootView).
    func sideMenu() -> some View { modifier(SideMenuContainer()) }

    /// Tasto ☰ in alto a sinistra nelle schermate principali delle schede.
    func sideMenuButton() -> some View { modifier(SideMenuButton()) }
}

private struct SideMenuButton: ViewModifier {
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Menu", systemImage: "line.3.horizontal") {
                    withAnimation(menuSpring) { model.sideMenuOpen = true }
                }
                .accessibilityHint("Apre il menu con le altre sezioni dell'app")
            }
        }
    }
}

private struct SideMenuContainer: ViewModifier {
    @Environment(AppModel.self) private var model
    /// Spostamento del dito mentre si apre o si chiude (punti).
    @State private var dragOffset: CGFloat = 0
    @State private var size = CGSize(width: 402, height: 874)
    @State private var insets = EdgeInsets()

    /// Il gesto dal bordo vale solo dove non c'è una pagina da cui tornare indietro.
    private var edgeEnabled: Bool {
        guard model.editor == nil, model.menuPage == nil else { return false }
        switch model.selectedTab {
        case .clienti: return model.clientsPath.isEmpty
        case .cantieri: return model.sitesPath.isEmpty
        case .listino: return model.priceListPath.isEmpty
        default: return true
        }
    }

    func body(content: Content) -> some View {
        let menuWidth = min(size.width * 0.82, 340)
        let open = model.sideMenuOpen
        let progress = min(1, max(0, (open ? 1 : 0) + dragOffset / menuWidth))
        let radius = screenCornerRadius * progress

        ZStack(alignment: .leading) {
            if progress > 0 {
                menuBackground.ignoresSafeArea()

                SideMenuPanel(top: insets.top, bottom: insets.bottom, close: { setMenu(false) })
                    .frame(width: menuWidth)
                    // Le scritte sfumano fino a zero insieme al movimento (prima restavano al 30%
                    // e sparivano di colpo a fine chiusura).
                    .opacity(Double(progress * progress))
                    .scaleEffect(0.97 + 0.03 * progress, anchor: .leading)
                    .offset(x: -40 * (1 - progress))
                    .ignoresSafeArea()
                    .accessibilityHidden(!open)
            }

            content
                .background {
                    // Ombra della scheda (dietro la pagina, solo con il menu aperto).
                    if progress > 0 {
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .fill(Color(.systemBackground))
                            .shadow(color: .black.opacity(0.25 * progress), radius: 24)
                            .ignoresSafeArea()
                    }
                }
                // La pagina ritagliata davvero con gli angoli dello schermo (come Polso): l'ombra
                // dietro resta intera, senza righe dritte lungo il bordo.
                .mask {
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .ignoresSafeArea()
                }
                .overlay {
                    if progress > 0 {
                        ZStack {
                            RoundedRectangle(cornerRadius: radius, style: .continuous)
                                .strokeBorder(Color.primary.opacity(0.08 * progress))
                            // Pagina spostata: un tocco la riporta al centro.
                            if open {
                                Color.black.opacity(0.001)
                                    .onTapGesture { setMenu(false) }
                                    .accessibilityLabel("Chiudi il menu")
                                    .accessibilityAddTraits(.isButton)
                            }
                        }
                        .ignoresSafeArea()
                    }
                }
                .offset(x: menuWidth * progress)

            // Apertura: si trascina dal bordo sinistro. La lista della Home è un componente di
            // sistema che si prende il tocco, quindi serve una striscia SwiftUI sopra la pagina
            // (24 punti, nel margine: non copre tasti o righe).
            if edgeEnabled, !open {
                Color.clear
                    .frame(width: 24)
                    .frame(maxHeight: .infinity)
                    .contentShape(Rectangle())
                    .gesture(openGesture(menuWidth: menuWidth))
                    .ignoresSafeArea()
                    .accessibilityHidden(true)
            }
        }
        // Chiusura: trascinando la pagina spostata verso sinistra.
        .simultaneousGesture(dragGesture(menuWidth: menuWidth))
        .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
        .onGeometryChange(for: EdgeInsets.self) { $0.safeAreaInsets } action: { insets = $0 }
        .sensoryFeedback(trigger: model.sideMenuOpen) { _, isOpen in
            isOpen ? .impact(weight: .medium) : .impact(weight: .light)
        }
        .onChange(of: model.selectedTab) {
            if model.sideMenuOpen { setMenu(false) }
        }
    }

    private func setMenu(_ value: Bool) {
        withAnimation(menuSpring) {
            model.sideMenuOpen = value
            dragOffset = 0
        }
    }

    private func openGesture(menuWidth: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 6, coordinateSpace: .global)
            .onChanged { value in
                dragOffset = max(0, min(menuWidth, value.translation.width))
            }
            .onEnded { value in
                withAnimation(menuSpring) {
                    if value.predictedEndTranslation.width > menuWidth / 3 { model.sideMenuOpen = true }
                    dragOffset = 0
                }
            }
    }

    private func dragGesture(menuWidth: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                let dx = value.translation.width
                guard abs(dx) > abs(value.translation.height) else { return }
                if model.sideMenuOpen { dragOffset = min(0, dx) }
            }
            .onEnded { value in
                let predicted = value.predictedEndTranslation.width
                let wasDragging = dragOffset != 0
                withAnimation(menuSpring) {
                    if model.sideMenuOpen, wasDragging, predicted < -menuWidth / 3 {
                        model.sideMenuOpen = false
                    }
                    dragOffset = 0
                }
            }
    }
}

// MARK: - Menu

private struct SideMenuPanel: View {
    @Environment(AppModel.self) private var model
    /// Margini di sistema (ora, Dynamic Island, barra Home): il menu va fino ai bordi.
    let top: CGFloat
    let bottom: CGFloat
    let close: () -> Void

    var body: some View {
        // Intestazione e tasti in basso sono barre di iOS 26 sopra la lista: scorrendo, le
        // voci spariscono dietro con la sfumatura sfocata di sistema (come ChatGPT e Claude).
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 2) {
                recents
                sections
            }
            .padding(.vertical, 8)
        }
        .scrollIndicators(.hidden)
        .scrollEdgeEffectStyle(.soft, for: .vertical)
        .safeAreaBar(edge: .top) {
            header.padding(.top, top + 6)
        }
        .safeAreaBar(edge: .bottom) {
            bottomBar
        }
    }

    // MARK: Parti

    /// L'icona del logo e «Dieffe» in nero (bianco in modalità scura), con le grazie
    /// come la scritta del logo originale.
    private var header: some View {
        HStack(spacing: 12) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: 38, height: 38)
                .accessibilityHidden(true)
            Text("Dieffe")
                .font(.system(size: 32, weight: .semibold, design: .serif))
                .foregroundStyle(.primary)
                .accessibilityLabel("Dieffe Ristrutturazioni")
                .accessibilityAddTraits(.isHeader)
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 10)
    }

    private var recentQuotes: [QuoteSummary] {
        let all = model.home.data?.quotes ?? []
        let byID = Dictionary(all.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        return model.recents.ids.compactMap { byID[$0] }.prefix(5).map { $0 }
    }

    @ViewBuilder
    private var recents: some View {
        let quotes = recentQuotes
        if !quotes.isEmpty {
            HStack {
                sectionTitle("Recenti")
                Spacer()
                Button {
                    close()
                    model.select(.home)
                } label: {
                    HStack(spacing: 2) {
                        Text("Vedi tutto")
                        Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                    }
                    .font(.subheadline)
                }
                .buttonStyle(.plain)
                .padding(.trailing, 22)
            }
            ForEach(quotes) { quote in
                row(quote.title.trimmingCharacters(in: .whitespacesAndNewlines), icon: "doc.text") {
                    model.openQuote(quote.id)
                }
            }
        }
    }

    @ViewBuilder
    private var sections: some View {
        sectionTitle("Operatività").padding(.top, 14)
        row("Lavori extra", icon: "doc.badge.plus") { model.openMenuPage(.route(.extras)) }
        row("Statistiche", icon: "chart.bar") { model.openMenuPage(.route(.stats)) }
        row("Comunicazioni", icon: "envelope") { model.openMenuPage(.route(.communications)) }
        if model.canEdit {
            row("Cestino", icon: "trash", badge: model.home.data?.trashCount ?? 0) { model.openMenuPage(.route(.trash)) }
        }
        if model.currentUser?.role == "admin" {
            sectionTitle("Amministrazione").padding(.top, 14)
            row("Invia notifica", icon: "bell.badge") { model.openMenuPage(.route(.notify)) }
            row("Utenti", icon: "person.2") { model.openMenuPage(.route(.users)) }
            row("Impostazioni azienda", icon: "building.2") { model.openMenuPage(.route(.company)) }
        }
        sectionTitle("App").padding(.top, 14)
        row("Aiuto", icon: "questionmark.circle") { model.openMenuPage(.help) }
        row("App iPhone", icon: "iphone") { model.openMenuPage(.appSettings) }
        Text("Dieffe Preventivi · app \(AppConfig.version)")
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 22)
            .padding(.top, 12)
    }

    private var bottomBarHeight: CGFloat { 52 }

    private var bottomBar: some View {
        // Border radius annidato con l'angolo in basso a sinistra dell'iPhone: i tasti sono alti
        // 52 (raggio 26) e stanno a (raggio dello schermo − 26) dal bordo sinistro e dal fondo,
        // così la loro curva è concentrica a quella dello schermo.
        let inset = max(12, screenCornerRadius - bottomBarHeight / 2)
        return HStack(spacing: 12) {
            Button {
                close()
                model.showProfile = true
            } label: {
                Text(InitialsAvatar.initials(of: model.currentUser?.name ?? ""))
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: bottomBarHeight, height: bottomBarHeight)
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.interactive(), in: .circle)
            .accessibilityLabel("Profilo")

            Spacer(minLength: 0)

            if model.canEdit {
                Button {
                    close()
                    model.newQuote()
                } label: {
                    Label("Nuovo preventivo", systemImage: "plus")
                        .font(.headline)
                        .lineLimit(1)
                        .fixedSize()
                        .foregroundStyle(Color(uiColor: .systemBackground))
                        .padding(.horizontal, 20)
                        .frame(height: bottomBarHeight)
                        .background(Color.primary, in: Capsule())
                        .shadow(color: .black.opacity(0.2), radius: 12, y: 4)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.leading, inset)
        .padding(.trailing, 16)
        .padding(.top, 10)
        .padding(.bottom, inset)
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 22)
            .padding(.vertical, 6)
            .accessibilityAddTraits(.isHeader)
    }

    private func row(_ title: String, icon: String, badge: Int = 0, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 17))
                    .foregroundStyle(.secondary)
                    .frame(width: 24)
                Text(title)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if badge > 0 {
                    Text("\(badge)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 8)
    }
}

// MARK: - Pagina aperta dal menu

/// Una pagina di "Altro" a tutto schermo, con la sua navigazione e la X per chiuderla.
struct MenuPageScreen: View {
    @Environment(AppModel.self) private var model
    let page: MenuPage

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.altroPath) {
            root
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Chiudi", systemImage: "xmark") { model.menuPage = nil }
                    }
                }
                .navigationDestination(for: WebDestination.self) { destination in
                    WebScreen(path: destination.path, title: destination.title)
                }
                .navigationDestination(for: AltroRoute.self) { AltroDestination(route: $0) }
        }
        // Un preventivo aperto da qui (cestino, lavori extra…) si apre sopra la pagina.
        .fullScreenCover(item: $model.editor, onDismiss: model.closeEditor) { session in
            EditorCover(session: session)
        }
        .appMessages(active: model.editor == nil)
    }

    @ViewBuilder
    private var root: some View {
        switch page {
        case .route(let route): AltroDestination(route: route)
        case .web(let destination): WebScreen(path: destination.path, title: destination.title)
        case .help: HelpView()
        case .appSettings: SettingsView(embedded: true)
        }
    }
}
