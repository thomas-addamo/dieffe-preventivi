import SwiftUI

/// Altro nativo (come src/app/(app)/altro/AltroClient.tsx): profilo, aiuto,
/// operatività e amministrazione, tutto in SwiftUI. Audit log e Sessioni
/// attive restano solo sul sito e nell'app desktop.
struct AltroView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        let user = model.currentUser

        NavigationStack(path: $model.altroPath) {
            List {
                Section {
                    NavigationLink {
                        ProfileView()
                    } label: {
                        HStack(spacing: 14) {
                            InitialsAvatar(name: user?.name ?? "", size: 52)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(user?.name ?? "Profilo")
                                    .font(.headline)
                                Text("Profilo, sicurezza, aspetto")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section {
                    Button {
                        model.showNotifications = true
                    } label: {
                        MoreRow(title: "Notifiche", subtitle: "Firme, stati, assegnazioni, comunicazioni",
                                symbol: "bell.fill", color: .red, badge: model.unreadNotifications, chevron: true)
                    }
                    .tint(.primary)
                    NavigationLink {
                        HelpView()
                    } label: {
                        MoreRow(title: "Aiuto", subtitle: "Chiedi all'assistente o scrivi all'amministratore",
                                symbol: "questionmark.circle.fill", color: .cyan)
                    }
                    NavigationLink {
                        SettingsView(embedded: true)
                    } label: {
                        MoreRow(title: "App iPhone", subtitle: "Face ID, versione, cache",
                                symbol: "iphone", color: .gray)
                    }
                }

                Section("Operatività") {
                    link(.extras, "Lavori extra", "Lavorazioni aggiuntive di un preventivo", "doc.badge.plus", .orange)
                    Button {
                        model.select(.listino)
                    } label: {
                        MoreRow(title: "Listino", subtitle: "Prezzi e voci ricorrenti",
                                symbol: "list.bullet.rectangle.portrait.fill", color: .blue, chevron: true)
                    }
                    .tint(.primary)
                    link(.stats, "Statistiche", "Andamento preventivi e conversioni", "chart.bar.fill", .green)
                    link(.communications, "Comunicazioni", "Lettere su carta intestata con timbro", "envelope.fill", .purple)
                    if model.canEdit {
                        link(.trash, "Cestino", "Preventivi eliminati di recente", "trash.fill", .orange,
                             badge: model.home.data?.trashCount ?? 0)
                    }
                }

                if user?.role == "admin" {
                    Section {
                        link(.notify, "Invia notifica", "Comunicazioni agli utenti", "bell.badge.fill", .pink)
                        link(.users, "Utenti", "Gestione account e ruoli", "person.2.badge.gearshape.fill", .indigo)
                        link(.company, "Impostazioni azienda", "Dati, logo, PDF, numerazione, team", "gearshape.fill", .gray)
                    } header: {
                        Label("Amministrazione", systemImage: "shield.lefthalf.filled")
                    } footer: {
                        Text("Audit log e Sessioni attive sono disponibili sul sito e nell'app desktop.")
                    }
                }

                Section {
                } footer: {
                    Text("Dieffe Preventivi · app \(AppConfig.version)")
                        .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Altro")
            .navigationDestination(for: WebDestination.self) { destination in
                WebScreen(path: destination.path, title: destination.title)
            }
            .navigationDestination(for: AltroRoute.self) { route in
                switch route {
                case .extras: ExtrasView()
                case .stats: StatsView()
                case .communications: CommunicationsView()
                case .trash: TrashView()
                case .notify: SendNotificationView()
                case .users: UsersView()
                case .company: CompanySettingsView()
                }
            }
            .refreshable { model.dataChanged() }
        }
    }

    private func link(_ route: AltroRoute, _ title: String, _ subtitle: String, _ symbol: String, _ color: Color,
                      badge: Int = 0) -> some View {
        NavigationLink(value: route) {
            MoreRow(title: title, subtitle: subtitle, symbol: symbol, color: color, badge: badge)
        }
    }
}

/// Schermate native raggiungibili da Altro.
enum AltroRoute: Hashable {
    case extras, stats, communications, trash, notify, users, company

    /// La pagina del sito corrispondente (link dai PDF, notifiche, menu).
    init?(path: String) {
        switch path.split(separator: "/").map(String.init) {
        case ["lavori-extra"]: self = .extras
        case ["statistiche"]: self = .stats
        case ["comunicazioni"]: self = .communications
        case ["cestino"]: self = .trash
        case ["admin", "notifiche"]: self = .notify
        case ["utenti"]: self = .users
        case ["impostazioni"]: self = .company
        default: return nil
        }
    }
}

private struct MoreRow: View {
    let title: String
    let subtitle: String
    let symbol: String
    let color: Color
    var badge = 0
    var chevron = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(color.gradient, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .foregroundStyle(Color.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            if badge > 0 {
                Text(badge > 99 ? "99+" : "\(badge)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(.red, in: Capsule())
            }
            if chevron {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

/// Pagina del sito dentro la navigazione nativa.
struct WebScreen: View {
    @Environment(AppModel.self) private var model
    let path: String
    let title: String
    @State private var page: WebPageModel?

    var body: some View {
        Group {
            if let page {
                WebPageView(page: page, fullScreen: false)
            } else {
                Color(.systemBackground)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let page {
                ToolbarItem(placement: .primaryAction) {
                    Button("Ricarica", systemImage: "arrow.clockwise") { page.reload() }
                }
            }
        }
        .onAppear {
            if page == nil { page = WebPageModel(path: path, role: .embedded, app: model) }
        }
    }
}

/// Aiuto: assistente AI (POST /api/ai/help) o messaggio all'amministratore
/// (POST /api/support), come src/components/shared/HelpDialog.tsx.
struct HelpView: View {
    private enum Mode: String, CaseIterable { case ai = "Assistente", admin = "Amministratore" }
    private struct Message: Identifiable, Equatable {
        let id = UUID()
        let role: String
        let content: String
    }

    @State private var mode: Mode = .ai
    @State private var messages: [Message] = []
    @State private var input = ""
    @State private var asking = false
    @State private var topic = "domanda"
    @State private var supportText = ""
    @State private var sending = false
    @State private var sent = false
    @State private var error: String?

    private let suggestions = [
        "Come creo un lavoro extra?",
        "Come mando il preventivo al cliente da firmare?",
        "Come funziona il riordino del listino?",
        "Come preparo una lettera per i condòmini?",
    ]
    private let topics = [("problema", "Problema"), ("domanda", "Domanda"), ("funzione", "Nuova funzione"), ("altro", "Altro")]

    var body: some View {
        VStack(spacing: 0) {
            Picker("Modalità", selection: $mode) {
                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 8)

            if mode == .ai { chat } else { support }
        }
        .navigationTitle("Aiuto")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(.systemGroupedBackground))
    }

    private var chat: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        if messages.isEmpty {
                            Text("Chiedi come si usa l'app: l'assistente conosce tutte le funzioni.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            ForEach(suggestions, id: \.self) { s in
                                Button(s) { ask(s) }
                                    .buttonStyle(.bordered)
                                    .font(.subheadline)
                            }
                        }
                        ForEach(messages) { m in
                            Text(LocalizedStringKey(m.content))
                                .font(.subheadline)
                                .padding(12)
                                .foregroundStyle(m.role == "user" ? .white : .primary)
                                .background(m.role == "user" ? Color.accentColor : Color(.secondarySystemGroupedBackground),
                                            in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                                .frame(maxWidth: .infinity, alignment: m.role == "user" ? .trailing : .leading)
                                .id(m.id)
                        }
                        if asking { ProgressView().padding(.leading, 8) }
                    }
                    .padding()
                }
                .onChange(of: messages) { _, list in
                    if let last = list.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                }
            }
            HStack(spacing: 8) {
                TextField("Scrivi una domanda…", text: $input, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
                Button {
                    ask(input)
                } label: {
                    Image(systemName: "arrow.up.circle.fill").font(.system(size: 32))
                }
                .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty || asking)
            }
            .padding()
        }
    }

    private var support: some View {
        Form {
            Section {
                Picker("Argomento", selection: $topic) {
                    ForEach(topics, id: \.0) { Text($0.1).tag($0.0) }
                }
                TextField("Messaggio", text: $supportText, prompt: Text("Descrivi il problema o la richiesta…"), axis: .vertical)
                    .lineLimit(4...10)
            } footer: {
                Text("Arriva all'amministratore come notifica.")
            }
            if let error {
                Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
            }
            Section {
                Button {
                    send()
                } label: {
                    if sending { ProgressView() } else { Label("Invia", systemImage: "paperplane.fill") }
                }
                .disabled(supportText.trimmingCharacters(in: .whitespaces).count < 5 || sending)
            }
        }
        .alert("Richiesta inviata", isPresented: $sent) {
            Button("OK") {}
        } message: {
            Text("L'amministratore la riceverà come notifica.")
        }
    }

    private func ask(_ text: String) {
        let q = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !asking else { return }
        messages.append(Message(role: "user", content: q))
        input = ""
        asking = true
        let history = messages.suffix(12).map { ["role": $0.role, "content": $0.content] }
        Task {
            defer { asking = false }
            struct Answer: Decodable { let answer: String }
            do {
                let r: Answer = try await APIClient.shared.send("POST", "/api/ai/help", json: ["messages": history])
                messages.append(Message(role: "assistant", content: r.answer))
            } catch {
                messages.append(Message(role: "assistant", content: error.localizedDescription))
            }
        }
    }

    private func send() {
        sending = true
        error = nil
        Task {
            defer { sending = false }
            do {
                try await APIClient.shared.send("POST", "/api/support",
                                                json: ["topic": topic, "message": supportText, "page": "app iPhone"],
                                                as: Empty.self)
                supportText = ""
                sent = true
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
