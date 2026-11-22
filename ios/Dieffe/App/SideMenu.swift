import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// Menu laterale (D2), al posto della scheda "Altro".
//  • si apre scorrendo dal bordo sinistro (solo dalle schermate principali,
//    così il gesto "indietro" di iOS resta libero) o con il tasto ☰ in alto;
//  • come l'app Claude: il menu sta sotto, a tutta altezza, e la pagina scorre a
//    destra diventando una scheda con gli angoli dello schermo (ConcentricRectangle,
//    regola del border radius annidato); tasti rotondi e tasti in basso in Liquid
//    Glass, concentrici agli angoli dell'iPhone;
//  • vibrazione all'apertura e alla chiusura;
//  • in alto il logo Dieffe (le notifiche restano nella Home), poi i preventivi recenti e le pagine di "Altro";
//    in basso a sinistra il profilo e accanto "Nuovo preventivo".
// ─────────────────────────────────────────────────────────────────────────────

/// Pagina aperta dal menu laterale.
enum MenuPage: Hashable, Identifiable {
    case route(AltroRoute)
    case web(WebDestination)
    case help
    case appSettings

    var id: Self { self }
}

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
                    withAnimation(.snappy(duration: 0.32)) { model.sideMenuOpen = true }
                }
                .accessibilityHint("Apre il menu con le altre sezioni dell'app")
            }
        }
    }
}

/// Raggio degli angoli dello schermo dell'iPhone (55 se iOS non lo dice).
@MainActor
let screenCornerRadius: CGFloat = {
    let value = (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.value(forKey: "_displayCornerRadius") as? CGFloat
    return value.flatMap { $0 > 0 ? $0 : nil } ?? 55
}()

/// La forma dello schermo: la pagina spostata ha gli stessi angoli dell'iPhone.
@MainActor
private var screenShape: RoundedRectangle { RoundedRectangle(cornerRadius: screenCornerRadius, style: .continuous) }

private struct SideMenuContainer: ViewModifier {
    @Environment(AppModel.self) private var model
    /// Spostamento del dito mentre si apre o si chiude (punti).
    @State private var drag: CGFloat = 0
    @State private var dragging = false

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
        GeometryReader { geo in
            // Come l'app Claude: il menu sta sotto, a tutta altezza; la pagina scorre a
            // destra e ne resta visibile un pezzo, come una scheda.
            let travel = geo.size.width - 70
            let open = model.sideMenuOpen
            let progress = max(0, min(1, open ? 1 + drag / travel : drag / travel))

            ZStack(alignment: .leading) {
                SideMenuPanel(top: geo.safeAreaInsets.top, bottom: geo.safeAreaInsets.bottom, close: { setOpen(false) })
                    .frame(width: travel)
                    .offset(x: (progress - 1) * 60)
                    .opacity(progress > 0 ? 1 : 0)
                    .accessibilityHidden(!open)

                content
                    // Angoli della pagina = angoli dello schermo dell'iPhone (stesso raggio).
                    .clipShape(screenShape)
                    .overlay {
                        // Pagina spostata: un tocco o un trascinamento la riportano al centro.
                        if progress > 0 {
                            screenShape
                                .fill(Color.black.opacity(0.06 * progress))
                                .overlay(screenShape.stroke(Color.primary.opacity(0.1 * progress), lineWidth: 1))
                                .contentShape(Rectangle())
                                .onTapGesture { setOpen(false) }
                                .gesture(closeDrag(travel: travel))
                                .accessibilityLabel("Chiudi il menu")
                                .accessibilityAddTraits(.isButton)
                        }
                    }
                    .shadow(color: .black.opacity(0.18 * progress), radius: 24, x: -6)
                    .offset(x: progress * travel)

                // Striscia sul bordo sinistro: si scorre verso destra per aprire.
                if edgeEnabled, !open {
                    Color.clear
                        .frame(width: 18)
                        .contentShape(Rectangle())
                        .gesture(openDrag(travel: travel))
                        .accessibilityHidden(true)
                }
            }
            // Tutto a schermo intero: la pagina spostata è una scheda con gli angoli dell'iPhone
            // dall'alto in basso (i margini di sistema arrivano comunque ai contenuti).
            .ignoresSafeArea()
            .background(Color(.systemGroupedBackground).ignoresSafeArea())
            .animation(dragging ? nil : .snappy(duration: 0.34), value: progress)
        }
        .sensoryFeedback(trigger: model.sideMenuOpen) { _, isOpen in
            isOpen ? .impact(weight: .medium) : .impact(weight: .light)
        }
        .onChange(of: model.selectedTab) { setOpen(false) }
    }

    private func setOpen(_ value: Bool) {
        drag = 0
        dragging = false
        model.sideMenuOpen = value
    }

    private func openDrag(travel: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 8, coordinateSpace: .global)
            .onChanged { value in
                dragging = true
                drag = max(0, min(travel, value.translation.width))
            }
            .onEnded { value in
                let goal = max(value.translation.width, value.predictedEndTranslation.width)
                setOpen(goal > travel * 0.35)
            }
    }

    private func closeDrag(travel: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 10, coordinateSpace: .global)
            .onChanged { value in
                guard model.sideMenuOpen else { return }
                dragging = true
                drag = min(0, max(-travel, value.translation.width))
            }
            .onEnded { value in
                guard model.sideMenuOpen else { return }
                let goal = min(value.translation.width, value.predictedEndTranslation.width)
                setOpen(goal > -travel * 0.3)
            }
    }
}

// MARK: - Pannello


private struct SideMenuPanel: View {
    @Environment(AppModel.self) private var model
    /// Margini di sistema (ora, Dynamic Island, barra Home): il pannello va fino ai bordi.
    let top: CGFloat
    let bottom: CGFloat
    let close: () -> Void

    var body: some View {
        VStack(spacing: 0) {
                header
                    .padding(.top, top + 8)
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        recents
                        sections
                    }
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
                .scrollEdgeEffectStyle(.soft, for: .vertical)
                footer
                    .padding(.top, 10)
                    .background(alignment: .top) {
                        // La lista sfuma sotto i tasti invece di finirci sotto di netto.
                        LinearGradient(colors: [Color(.systemGroupedBackground).opacity(0), Color(.systemGroupedBackground)],
                                       startPoint: .top, endPoint: .bottom)
                            .frame(height: 24)
                            .offset(y: -24)
                            .allowsHitTesting(false)
                    }
                    .background(Color(.systemGroupedBackground))
                    .padding(.bottom, max(12, bottom - 8))
            }
            .padding(.horizontal, 12)
        .padding(.leading, 8)
    }

    // MARK: Parti

    private var header: some View {
        HStack(spacing: 10) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: 32, height: 32)
                .accessibilityHidden(true)
            Text("Dieffe")
                .font(.title.weight(.bold))
                .accessibilityAddTraits(.isHeader)
            Spacer()
        }
        .padding(.leading, 6)
    }

    private var recentQuotes: [QuoteSummary] {
        let all = model.home.data?.quotes ?? []
        let byID = Dictionary(all.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        return model.recents.ids.compactMap { byID[$0] }.prefix(4).map { $0 }
    }

    @ViewBuilder
    private var recents: some View {
        let quotes = recentQuotes
        if !quotes.isEmpty {
            VStack(alignment: .leading, spacing: 2) {
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
                    .tint(.primary)
                }
                ForEach(quotes) { quote in
                    row(quote.title, symbol: "doc.text", detail: [quote.code, quote.clientName].compactMap { $0 }.joined(separator: " · ")) {
                        model.openQuote(quote.id)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var sections: some View {
        VStack(alignment: .leading, spacing: 2) {
            sectionTitle("Operatività")
            row("Lavori extra", symbol: "doc.badge.plus") { model.openMenuPage(.route(.extras)) }
            row("Statistiche", symbol: "chart.bar") { model.openMenuPage(.route(.stats)) }
            row("Comunicazioni", symbol: "envelope") { model.openMenuPage(.route(.communications)) }
            if model.canEdit {
                row("Cestino", symbol: "trash", badge: model.home.data?.trashCount ?? 0) { model.openMenuPage(.route(.trash)) }
            }
        }
        if model.currentUser?.role == "admin" {
            VStack(alignment: .leading, spacing: 2) {
                sectionTitle("Amministrazione")
                row("Invia notifica", symbol: "bell.badge") { model.openMenuPage(.route(.notify)) }
                row("Utenti", symbol: "person.2") { model.openMenuPage(.route(.users)) }
                row("Impostazioni azienda", symbol: "building.2") { model.openMenuPage(.route(.company)) }
            }
        }
        VStack(alignment: .leading, spacing: 2) {
            sectionTitle("App")
            row("Aiuto", symbol: "questionmark.circle") { model.openMenuPage(.help) }
            row("App iPhone", symbol: "iphone", detail: "Face ID, versione, cache") { model.openMenuPage(.appSettings) }
        }
        Text("Dieffe Preventivi · app \(AppConfig.version)")
            .font(.caption2)
            .foregroundStyle(.secondary)
            .padding(.leading, 6)
    }

    private var footer: some View {
        HStack(spacing: 10) {
            Button {
                close()
                model.showProfile = true
            } label: {
                InitialsAvatar(name: model.currentUser?.name ?? "", size: 40)
                    .frame(width: 52, height: 52)
                    .contentShape(ConcentricRectangle())
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.interactive(), in: ConcentricRectangle(corners: .concentric(minimum: 26), isUniform: true))
            .accessibilityLabel("Profilo")

            if model.canEdit {
                Button {
                    close()
                    model.newQuote()
                } label: {
                    Label("Nuovo preventivo", systemImage: "plus")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .contentShape(ConcentricRectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(.white)
                .glassEffect(.regular.tint(.accentColor).interactive(), in: ConcentricRectangle(corners: .concentric(minimum: 26), isUniform: false))
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .padding(.leading, 6)
            .padding(.bottom, 4)
            .accessibilityAddTraits(.isHeader)
    }

    private func row(_ title: String, symbol: String, detail: String? = nil, badge: Int = 0, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.body)
                    .frame(width: 24)
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).lineLimit(1)
                    if let detail, !detail.isEmpty {
                        Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                Spacer(minLength: 4)
                if badge > 0 {
                    Text("\(badge)")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(.red, in: Capsule())
                        .foregroundStyle(.white)
                }
            }
            .padding(.horizontal, 6)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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
