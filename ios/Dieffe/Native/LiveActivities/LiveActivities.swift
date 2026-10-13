import ActivityKit
import OSLog
import UIKit

/// Avvia, aggiorna e chiude le attività in tempo reale (Dynamic Island e
/// schermata di blocco, grafica in ios/DieffeWidgets):
/// - preventivo in modifica: codice e totale mentre si usa un'altra app;
/// - importazione da file e risposte dell'assistente AI;
/// - sopralluogo in cantiere, con cronometro.
/// iOS permette di avviarle solo con l'app in primo piano: partono sempre da
/// un'azione nell'app.
@MainActor
enum LiveActivities {
    typealias Attributes = DieffeActivityAttributes
    typealias State = DieffeActivityAttributes.ContentState

    static var isAvailable: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }
    private static let log = Logger(subsystem: "it.dieffe.preventivi", category: "LiveActivities")

    @discardableResult
    private static func request(_ attributes: Attributes, _ content: ActivityContent<State>) -> Activity<Attributes>? {
        do {
            return try Activity.request(attributes: attributes, content: content)
        } catch {
            log.error("Attività \(attributes.kind.rawValue, privacy: .public) non avviata: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private static func all(_ kind: Attributes.Kind) -> [Activity<Attributes>] {
        Activity<Attributes>.activities.filter { $0.attributes.kind == kind }
    }

    private static func content(_ state: State, staleAfter hours: Double? = nil) -> ActivityContent<State> {
        ActivityContent(state: state, staleDate: hours.map { .now + $0 * 3600 })
    }

    // MARK: Preventivo in modifica

    private static func editingState(_ quote: QuoteDetail) -> State {
        State(title: quote.title, detail: quote.client?.name, total: quote.totals.total)
    }

    /// All'apertura dell'editor. Un solo preventivo alla volta; niente doppione
    /// se per lo stesso preventivo c'è già un sopralluogo in corso.
    static func startEditing(_ quote: QuoteDetail) {
        guard isAvailable else { return log.notice("Attività in tempo reale disattivate per Dieffe") }
        for activity in all(.editing) where activity.attributes.quoteID != quote.id {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        guard siteVisitStart(for: quote.id) == nil else { return }
        if all(.editing).contains(where: { $0.attributes.quoteID == quote.id }) {
            updateEditing(quote)
            return
        }
        let attributes = Attributes(kind: .editing, quoteID: quote.id, code: quote.code,
                                    clientName: quote.client?.name, address: quote.projectAddress,
                                    taskName: nil, startedAt: .now)
        request(attributes, content(editingState(quote), staleAfter: 4))
    }

    /// A ogni modifica del totale o del titolo.
    static func updateEditing(_ quote: QuoteDetail) {
        let state = editingState(quote)
        for activity in all(.editing) where activity.attributes.quoteID == quote.id && activity.content.state != state {
            Task { await activity.update(content(state, staleAfter: 4)) }
        }
    }

    /// Alla chiusura dell'editor.
    static func endEditing() {
        for activity in all(.editing) {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
    }

    // MARK: Importazione e assistente AI

    /// Segue un lavoro lungo: l'isola mostra l'avanzamento e poi l'esito, anche
    /// se nel frattempo si è passati a un'altra app (iOS concede ~30 secondi
    /// in background per finire la richiesta).
    static func track<T>(_ taskName: String, title: String, quote: QuoteDetail? = nil,
                         done: (T) -> (title: String, detail: String?),
                         failed: String = "Non riuscito: apri l'app per i dettagli",
                         _ work: () async throws -> T) async throws -> T {
        let background = UIApplication.shared.beginBackgroundTask(withName: taskName)
        defer { UIApplication.shared.endBackgroundTask(background) }
        var activity: Activity<Attributes>?
        if isAvailable {
            let attributes = Attributes(kind: .task, quoteID: quote?.id, code: quote?.code,
                                        clientName: quote?.client?.name, address: nil,
                                        taskName: taskName, startedAt: .now)
            activity = request(attributes, content(State(title: title), staleAfter: 1))
        }
        do {
            let value = try await work()
            let result = done(value)
            await finish(activity, State(title: result.title, detail: result.detail, phase: .done))
            return value
        } catch {
            let cancelled = (error as? URLError)?.code == .cancelled || error is CancellationError
            if cancelled {
                await activity?.end(nil, dismissalPolicy: .immediate)
            } else {
                await finish(activity, State(title: failed, phase: .failed))
            }
            throw error
        }
    }

    /// Esito: con l'app in background l'isola si apre per un attimo (avviso),
    /// poi l'attività resta qualche minuto sulla schermata di blocco.
    private static func finish(_ activity: Activity<Attributes>?, _ state: State) async {
        guard let activity else { return }
        let inForeground = UIApplication.shared.applicationState == .active
        if inForeground {
            await activity.end(content(state), dismissalPolicy: .immediate)
            return
        }
        let alert = AlertConfiguration(title: "\(activity.attributes.taskName ?? "Dieffe")",
                                       body: "\(state.title)", sound: .default)
        await activity.update(content(state), alertConfiguration: alert)
        try? await Task.sleep(for: .seconds(8))
        await activity.end(content(state), dismissalPolicy: .after(.now + 10 * 60))
    }

    // MARK: Sopralluogo

    static func siteVisitStart(for quoteID: String) -> Date? {
        all(.siteVisit).first { $0.attributes.quoteID == quoteID && $0.activityState == .active }?.attributes.startedAt
    }

    static func startSiteVisit(_ quote: QuoteDetail) -> Bool {
        guard isAvailable, siteVisitStart(for: quote.id) == nil else { return false }
        for activity in all(.editing) where activity.attributes.quoteID == quote.id {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        let attributes = Attributes(kind: .siteVisit, quoteID: quote.id, code: quote.code,
                                    clientName: quote.client?.name, address: quote.projectAddress,
                                    taskName: nil, startedAt: .now)
        let state = State(title: quote.client?.name ?? quote.title, detail: quote.title)
        log.notice("Sopralluogo avviato: \(quote.code, privacy: .public) \(quote.id, privacy: .public)")
        return request(attributes, content(state, staleAfter: 8)) != nil
    }

    static func endSiteVisit(_ quoteID: String) async {
        for activity in all(.siteVisit) where activity.attributes.quoteID == quoteID {
            var state = activity.content.state
            state.phase = .done
            let minutes = Int(Date.now.timeIntervalSince(activity.attributes.startedAt) / 60)
            state.detail = "Sopralluogo terminato dopo \(Format.duration(minutes: minutes))"
            await activity.end(content(state), dismissalPolicy: .after(.now + 5 * 60))
        }
    }
}

extension Format {
    /// 45 min, 1 h 20 min.
    static func duration(minutes: Int) -> String {
        minutes < 60 ? "\(max(minutes, 1)) min" : "\(minutes / 60) h" + (minutes % 60 > 0 ? " \(minutes % 60) min" : "")
    }
}
