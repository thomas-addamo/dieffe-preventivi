import SwiftUI
import UIKit

// ─────────────────────────────────────────────────────────────────────────────
// Sopralluogo con IA vocale (D1). Schermata disegnata su misura:
//  • in alto la sfera dell'IA (SurveyOrb), che ascolta e reagisce alla voce;
//  • sotto il testo in diretta, che sfuma verso l'alto;
//  • al centro la bozza del preventivo, su cui voci, note e foto entrano animate;
//  • in basso Foto, Pausa e Fine in Liquid Glass, concentrici agli angoli.
// D1a: trascrizione sul telefono, foto, revisione → note del preventivo.
// Le voci create dall'IA arrivano con D1b; la modalità dimostrativa (avvio
// con -DieffeSurveyDemo YES) mostra già come si costruirà il preventivo.
// Il testo trascritto non si salva: finita la revisione resta solo ciò che è
// andato nel preventivo (scelta dell'utente, 22/11/2026).
// ─────────────────────────────────────────────────────────────────────────────

/// Da dove parte il sopralluogo.
struct SurveyContext: Identifiable {
    let id = UUID()
    var title: String?
    var client: ClientRef?
    var address: String?
    /// Lavoro extra di un cantiere aperto: il preventivo principale.
    var parentQuoteID: String?
    var parentTitle: String?
    /// Dimostrazione con un sopralluogo finto (nessuna chiamata al server).
    var demo = false
}

struct SurveyItem: Identifiable, Equatable {
    let id = UUID()
    var section: String
    var text: String
    /// Etichetta della quantità (es. "30 m²"); per le voci dell'IA si ricava da qty e unit.
    var quantity: String?
    var qty: Double? = nil
    var unit: String? = nil
    /// Prezzo unitario, solo se detto a voce (D1b).
    var price: Double? = nil

    static func label(qty: Double?, unit: String?) -> String? {
        switch (qty, unit) {
        case let (q?, u?): return "\(q.formatted(.number.precision(.fractionLength(0...2)))) \(u)"
        case let (q?, nil): return q.formatted(.number.precision(.fractionLength(0...2)))
        case let (nil, u?): return u
        default: return nil
        }
    }
}

struct SurveyNote: Identifiable, Equatable {
    let id = UUID()
    var text: String
}

/// Operazione decisa dall'IA (src/lib/ai/quote-agent.ts). Sezioni e voci si
/// indicano con i codici mandati nella bozza (S1…, V1…) o con quelli nuovi (N1…).
struct SurveyOp: Decodable {
    let op: String
    let section: String?
    let item: String?
    let ref: String?
    let title: String?
    let text: String?
    let optional: Bool?
    let quantity: Double?
    let unit: String?
    let price: Double?
    let vatRate: Double?
    let discountPercent: Double?
    let paymentTerms: String?
    let validUntil: String?
    let name: String?
    let address: String?
    let vatNumber: String?
    let email: String?
    let phone: String?
}

/// Cliente del sopralluogo: quello scelto all'avvio o quello detto a voce (D1c).
/// Al salvataggio si usa quello in rubrica con lo stesso nome, altrimenti si crea.
struct SurveyClient: Equatable {
    var id: String?
    var name: String
    var address: String?
    var vatNumber: String?
    var email: String?
    var phone: String?
    /// Dati cambiati a voce da scrivere nella rubrica.
    var changed = false

    var payload: [String: Any] {
        var out: [String: Any] = ["name": name]
        if let address { out["address"] = address }
        if let vatNumber { out["vatNumber"] = vatNumber }
        if let email { out["email"] = email }
        if let phone { out["phone"] = phone }
        return out
    }

    var details: String? {
        let parts = [phone, email, address, vatNumber.map { "P.IVA/CF \($0)" }].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    mutating func merge(_ op: SurveyOp) {
        if let x = op.address?.nilIfEmpty { address = x; changed = true }
        if let x = op.vatNumber?.nilIfEmpty { vatNumber = x; changed = true }
        if let x = op.email?.nilIfEmpty { email = x; changed = true }
        if let x = op.phone?.nilIfEmpty { phone = x; changed = true }
    }
}

/// Dati generali dettati (IVA, sconto, pagamenti, validità): vanno nel preventivo al salvataggio.
struct SurveyQuoteFields: Equatable {
    var vatRate: Double?
    var discountPercent: Double?
    var paymentTerms: String?
    var validUntil: String?

    var summary: [String] {
        var out: [String] = []
        if let vatRate { out.append("IVA \(vatRate.formatted())%") }
        if let discountPercent, discountPercent > 0 { out.append("Sconto \(discountPercent.formatted())%") }
        if paymentTerms != nil { out.append("Pagamenti") }
        if validUntil != nil { out.append("Validità") }
        return out
    }
}

struct SurveyOpsResponse: Decodable {
    let ops: [SurveyOp]
}

struct SurveyShot: Identifiable {
    let id = UUID()
    let image: UIImage
}

struct SurveyView: View {
    @Environment(AppModel.self) private var model
    let context: SurveyContext

    @State private var speech = SurveySpeech()
    @State private var items: [SurveyItem] = []
    @State private var notes: [SurveyNote] = []
    @State private var shots: [SurveyShot] = []
    @State private var fresh: Set<UUID> = []
    @State private var started = Date()
    @State private var pausedTotal: TimeInterval = 0
    @State private var pausedAt: Date?
    @State private var showCamera = false
    // IA sul parlato (D1b)
    @State private var draftTitle: String?
    /// Ordine delle sezioni (anche vuote) e quelle opzionali.
    @State private var sectionOrder: [String] = []
    @State private var optionalSections: Set<String> = []
    @State private var quoteFields = SurveyQuoteFields()
    @State private var client: SurveyClient?
    /// Codici dell'ultima bozza mandata all'IA → voce / sezione.
    @State private var itemRefs: [String: UUID] = [:]
    @State private var sectionRefs: [String: String] = [:]
    @State private var processed = 0
    @State private var aiBusy = false
    @State private var aiOffline = false
    @State private var aiTask: Task<Void, Never>?
    @State private var showReview = false
    @State private var confirmCancel = false
    // Dimostrazione
    @State private var demoFinal = ""
    @State private var demoVolatile = ""
    @State private var demoLevel = 0.0
    @State private var demoThinking = false
    @State private var demoPaused = false
    @State private var demoTask: Task<Void, Never>?

    private var isDemo: Bool { context.demo }
    private var paused: Bool { isDemo ? demoPaused : speech.state == .paused }
    private var text: String { isDemo ? [demoFinal, demoVolatile].filter { !$0.isEmpty }.joined(separator: " ") : speech.fullText }
    private var level: Double { isDemo ? demoLevel : speech.level }
    private var mood: OrbMood {
        if isDemo ? demoThinking : (speech.state == .preparing || aiBusy) { return .thinking }
        if paused { return .idle }
        return (isDemo || speech.state == .listening) ? .listening : .idle
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            background

            VStack(spacing: 0) {
                topBar
                SurveyOrb(mood: mood, level: level, size: 120)
                    .padding(.top, 28)
                statusLine
                    .padding(.top, 30)
                LiveTranscript(text: text)
                    .padding(.horizontal, 24)
                    .padding(.top, 10)
                DraftSheet(context: context, title: draftTitle, client: client, items: items, notes: notes, shots: shots, fresh: fresh, demo: isDemo,
                           sectionOrder: sectionOrder, optionalSections: optionalSections,
                           offline: aiOffline, onRemove: removeItem, onRemoveNote: removeNote)
                    .padding(.horizontal, 12)
                    .padding(.top, 14)
            }

            controls
        }
        .ignoresSafeArea(.container, edges: .bottom)
        .sensoryFeedback(.impact(weight: .light), trigger: items.count)
        .sensoryFeedback(.selection, trigger: paused)
        .task {
            started = .now
            draftTitle = context.title
            if let c = context.client { client = SurveyClient(id: c.id, name: c.name) }
            if isDemo { runDemo() } else { await speech.start() }
        }
        // Ogni frase definitiva fa ripartire l'attesa: si manda all'IA dopo una breve
        // pausa (1,2 s), o subito se il testo da elaborare è già lungo. Un invio per
        // pausa, non per parola: risposte rapide senza sprecare richieste.
        .onChange(of: speech.finalText) { scheduleAI() }
        .onDisappear {
            demoTask?.cancel()
            speech.cancel()
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                withAnimation(.spring(response: 0.45, dampingFraction: 0.75)) { shots.append(SurveyShot(image: image)) }
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showReview) {
            SurveyReviewView(context: context, title: draftTitle, initialText: text, items: items, aiNotes: notes.map(\.text), shots: shots,
                             sectionOrder: sectionOrder, optionalSections: optionalSections, quoteFields: quoteFields, client: client)
        }
        .confirmationDialog("Annullare il sopralluogo?", isPresented: $confirmCancel, titleVisibility: .visible) {
            Button("Annulla il sopralluogo", role: .destructive) { model.survey = nil }
            Button("Continua", role: .cancel) {}
        } message: {
            Text("Il testo e le foto non sono ancora salvati e andranno persi.")
        }
    }

    // MARK: Parti

    private var background: some View {
        ZStack {
            Color(.systemGroupedBackground)
            // Luce che parte dalla sfera e si allarga con la voce.
            RadialGradient(colors: [Color(red: 0.33, green: 0.70, blue: 0.89).opacity(0.28 + level * 0.25), .clear],
                           center: UnitPoint(x: 0.5, y: 0.16), startRadius: 10, endRadius: 360 + level * 80)
                .animation(.smooth(duration: 0.3), value: level)
        }
        .ignoresSafeArea()
    }

    private var topBar: some View {
        HStack {
            Button {
                if text.isEmpty && shots.isEmpty { model.survey = nil } else { confirmCancel = true }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.interactive(), in: .circle)
            .accessibilityLabel("Chiudi")

            Spacer()
            VStack(spacing: 1) {
                Text(isDemo ? "Sopralluogo · prova" : "Sopralluogo")
                    .font(.headline)
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    Text(elapsed(at: ctx.date))
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    private var statusLine: some View {
        Group {
            switch (isDemo, speech.state) {
            case (false, .failed(let message)):
                Label(message, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.orange)
            case (false, .preparing):
                Text("Preparo l'ascolto…")
            default:
                Text(paused ? "In pausa" : mood == .thinking ? "Sto mettendo in ordine…" : "Ti ascolto: descrivi i lavori")
            }
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 30)
        .contentTransition(.opacity)
        .animation(.smooth, value: paused)
        .animation(.smooth, value: mood)
    }

    private var controls: some View {
        // Tasti alti 64 (raggio 32), a "raggio dello schermo − 32" dal fondo e dai lati:
        // le curve sono concentriche a quelle dell'iPhone.
        let inset = max(14, screenCornerRadius - 32)
        return HStack(spacing: 12) {
            Button {
                showCamera = true
            } label: {
                Image(systemName: "camera.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .frame(width: 64, height: 64)
                    .overlay(alignment: .topTrailing) {
                        if !shots.isEmpty {
                            Text("\(shots.count)")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.white)
                                .padding(5)
                                .background(Color.accentColor, in: Circle())
                                .offset(x: 2, y: -2)
                                .transition(.scale.combined(with: .opacity))
                        }
                    }
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.interactive(), in: .circle)
            .accessibilityLabel("Scatta una foto")
            .disabled(!UIImagePickerController.isSourceTypeAvailable(.camera) && !isDemo)

            Button {
                togglePause()
            } label: {
                Label(paused ? "Riprendi" : "Pausa", systemImage: paused ? "mic.fill" : "pause.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 64)
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.interactive(), in: .capsule)

            Button {
                finish()
            } label: {
                Text("Fine")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(width: 88, height: 64)
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.tint(.accentColor).interactive(), in: .capsule)
        }
        .padding(.horizontal, inset)
        .padding(.bottom, inset)
    }

    // MARK: Azioni

    private func elapsed(at date: Date) -> String {
        let running = (pausedAt ?? date).timeIntervalSince(started) - pausedTotal
        let s = max(0, Int(running))
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    private func togglePause() {
        if paused {
            if let pausedAt { pausedTotal += Date().timeIntervalSince(pausedAt) }
            pausedAt = nil
            if isDemo { demoPaused = false } else { speech.resume() }
        } else {
            pausedAt = .now
            if isDemo { demoPaused = true; demoLevel = 0 } else { speech.pause() }
        }
    }

    private func finish() {
        Task {
            if isDemo {
                demoTask?.cancel()
                demoLevel = 0
            } else {
                await speech.finish()
                // Le ultime frasi passano all'IA prima della revisione (al massimo 20 secondi).
                aiTask?.cancel()
                await withTaskGroup(of: Void.self) { group in
                    group.addTask { await processAI(force: true) }
                    group.addTask { try? await Task.sleep(for: .seconds(20)) }
                    await group.next()
                    group.cancelAll()
                }
            }
            showReview = true
        }
    }

    // MARK: IA sul parlato (D1b)

    private func scheduleAI() {
        guard !isDemo else { return }
        aiTask?.cancel()
        let pending = speech.finalText.count - processed
        aiTask = Task {
            if pending < 180 { try? await Task.sleep(for: .seconds(1.2)) }
            guard !Task.isCancelled else { return }
            await processAI(force: false)
        }
    }

    /// Manda all'IA il testo non ancora elaborato con la bozza attuale e applica le
    /// operazioni. Senza rete il testo resta in attesa e si riprova da solo.
    private func processAI(force: Bool) async {
        guard !aiBusy else { return }
        let full = speech.finalText
        let chunk = String(full.dropFirst(processed)).trimmingCharacters(in: .whitespacesAndNewlines)
        guard chunk.count >= (force ? 1 : 12) else { return }
        aiBusy = true
        defer { aiBusy = false }
        do {
            let response: SurveyOpsResponse = try await APIClient.shared.send("POST", "/api/ai/survey", json: [
                "text": chunk,
                "draft": draftPayload(),
            ])
            processed = full.count
            aiOffline = false
            apply(response.ops)
        } catch {
            aiOffline = true
            // Riprova fra poco (rete assente o IA occupata): il testo non si perde.
            guard !force else { return }
            aiTask = Task {
                try? await Task.sleep(for: .seconds(8))
                guard !Task.isCancelled else { return }
                await processAI(force: false)
            }
        }
    }

    /// Sezioni nell'ordine in cui sono nate (anche vuote) con le loro voci.
    private var groupedSections: [(String, [SurveyItem])] {
        var order = sectionOrder
        for item in items where !order.contains(item.section) { order.append(item.section) }
        return order.map { title in (title, items.filter { $0.section == title }) }
    }

    /// La bozza per l'IA, con un codice per ogni sezione (S1…) e voce (V1…).
    private func draftPayload() -> [String: Any] {
        var itemMap: [String: UUID] = [:]
        var sectionMap: [String: String] = [:]
        var v = 0
        let sections: [[String: Any]] = groupedSections.enumerated().map { index, group in
            let ref = "S\(index + 1)"
            sectionMap[ref] = group.0
            let rows: [[String: Any]] = group.1.map { item in
                v += 1
                itemMap["V\(v)"] = item.id
                var row: [String: Any] = ["ref": "V\(v)", "text": item.text]
                if let q = item.qty { row["quantity"] = q }
                if let u = item.unit { row["unit"] = u }
                if let p = item.price { row["price"] = p }
                return row
            }
            return ["ref": ref, "title": group.0, "optional": optionalSections.contains(group.0), "items": rows]
        }
        itemRefs = itemMap
        sectionRefs = sectionMap
        var payload: [String: Any] = ["sections": sections, "notes": notes.map(\.text)]
        if let draftTitle { payload["title"] = draftTitle }
        if let client { payload["client"] = client.payload }
        if let x = quoteFields.vatRate { payload["vatRate"] = x }
        if let x = quoteFields.discountPercent { payload["discountPercent"] = x }
        if let x = quoteFields.paymentTerms { payload["paymentTerms"] = x }
        if let x = quoteFields.validUntil { payload["validUntil"] = x }
        return payload
    }

    /// Titolo della sezione indicata dall'IA: codice (S1/N1) o titolo; se non c'è, la crea.
    private func sectionTitle(for key: String) -> String {
        if let title = sectionRefs[key.uppercased()] { return title }
        if let title = sectionOrder.first(where: { $0.caseInsensitiveCompare(key) == .orderedSame }) { return title }
        ensureSection(key)
        return key
    }

    private func ensureSection(_ title: String, optional: Bool = false) {
        withAnimation(.smooth) {
            if !sectionOrder.contains(title) { sectionOrder.append(title) }
            if optional { optionalSections.insert(title) }
        }
    }

    private func itemIndex(_ ref: String?) -> Int? {
        guard let ref, let id = itemRefs[ref.uppercased()] else { return nil }
        return items.firstIndex { $0.id == id }
    }

    private func apply(_ ops: [SurveyOp]) {
        for op in ops {
            switch op.op {
            case "add_section":
                guard let title = op.title?.trimmingCharacters(in: .whitespaces), !title.isEmpty else { continue }
                ensureSection(title, optional: op.optional ?? false)
                if let ref = op.ref { sectionRefs[ref.uppercased()] = title }
            case "update_section":
                guard let key = op.section, let old = sectionRefs[key.uppercased()] else { continue }
                let new = op.title?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? old
                withAnimation(.smooth) {
                    if new != old {
                        if let i = sectionOrder.firstIndex(of: old) { sectionOrder[i] = new } else { sectionOrder.append(new) }
                        for i in items.indices where items[i].section == old { items[i].section = new }
                        if optionalSections.remove(old) != nil { optionalSections.insert(new) }
                        sectionRefs[key.uppercased()] = new
                    }
                    if let optional = op.optional {
                        if optional { optionalSections.insert(new) } else { optionalSections.remove(new) }
                    }
                }
            case "remove_section":
                guard let key = op.section, let title = sectionRefs[key.uppercased()] else { continue }
                _ = withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                    items.removeAll { $0.section == title }
                    sectionOrder.removeAll { $0 == title }
                    optionalSections.remove(title)
                }
            case "add_item":
                guard let text = op.text, let key = op.section else { continue }
                let section = sectionTitle(for: key)
                add(SurveyItem(section: section, text: text, quantity: SurveyItem.label(qty: op.quantity, unit: op.unit),
                               qty: op.quantity, unit: op.unit, price: op.price))
            case "update_item":
                guard let index = itemIndex(op.item) else { continue }
                let target = op.section.map { sectionTitle(for: $0) }
                withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) {
                    if let text = op.text, !text.isEmpty { items[index].text = text }
                    if let q = op.quantity { items[index].qty = q }
                    if let u = op.unit { items[index].unit = u }
                    if let p = op.price { items[index].price = p }
                    if let target { items[index].section = target }
                    items[index].quantity = SurveyItem.label(qty: items[index].qty, unit: items[index].unit) ?? items[index].quantity
                    fresh.insert(items[index].id)
                }
                let id = items[index].id
                Task {
                    try? await Task.sleep(for: .seconds(1.6))
                    _ = withAnimation(.smooth(duration: 0.8)) { fresh.remove(id) }
                }
            case "remove_item":
                guard let index = itemIndex(op.item) else { continue }
                _ = withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { items.remove(at: index) }
            case "add_note":
                guard let text = op.text else { continue }
                withAnimation(.spring(response: 0.5, dampingFraction: 0.75)) { notes.append(SurveyNote(text: text)) }
            case "set_client":
                // Un lavoro extra resta del cliente del preventivo principale.
                guard context.parentQuoteID == nil, let name = op.name?.nilIfEmpty else { continue }
                withAnimation(.smooth) {
                    if var same = client, same.name.caseInsensitiveCompare(name) == .orderedSame {
                        same.merge(op)
                        client = same
                    } else {
                        var fresh = SurveyClient(id: nil, name: name)
                        fresh.merge(op)
                        fresh.changed = false
                        client = fresh
                    }
                }
            case "update_client":
                guard var current = client else { continue }
                withAnimation(.smooth) {
                    if let name = op.name?.nilIfEmpty, name != current.name { current.name = name; current.changed = true }
                    current.merge(op)
                    client = current
                }
            case "set_quote":
                withAnimation(.smooth) {
                    if let title = op.title?.nilIfEmpty { draftTitle = title }
                    if let x = op.vatRate { quoteFields.vatRate = x }
                    if let x = op.discountPercent { quoteFields.discountPercent = x }
                    if let x = op.paymentTerms?.nilIfEmpty { quoteFields.paymentTerms = x }
                    if let x = op.validUntil?.nilIfEmpty { quoteFields.validUntil = x }
                }
            default:
                continue
            }
        }
    }

    private func removeItem(_ item: SurveyItem) {
        _ = withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { items.removeAll { $0.id == item.id } }
    }

    private func removeNote(_ note: SurveyNote) {
        _ = withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { notes.removeAll { $0.id == note.id } }
    }

    private func add(_ item: SurveyItem) {
        withAnimation(.spring(response: 0.5, dampingFraction: 0.72)) {
            items.append(item)
            fresh.insert(item.id)
        }
        Task {
            try? await Task.sleep(for: .seconds(1.6))
            _ = withAnimation(.smooth(duration: 0.8)) { fresh.remove(item.id) }
        }
    }

    // MARK: Dimostrazione

    private func runDemo() {
        struct Step { let say: String; var item: SurveyItem? = nil; var note: String? = nil }
        let script: [Step] = [
            Step(say: "Siamo nell'alloggio di via Passo Buole 18, al secondo piano."),
            Step(say: "In bagno bisogna demolire le piastrelle del pavimento e dei rivestimenti, circa trenta metri quadri.",
                 item: SurveyItem(section: "Demolizioni", text: "Demolizione piastrelle pavimento e rivestimenti bagno", quantity: "30 m²")),
            Step(say: "Poi smaltimento dei calcinacci in discarica autorizzata.",
                 item: SurveyItem(section: "Demolizioni", text: "Trasporto e smaltimento calcinacci", quantity: "a corpo")),
            Step(say: "C'è umidità di risalita sulla parete nord, da controllare prima di posare.",
                 note: "Umidità di risalita sulla parete nord del bagno: verificare prima della posa."),
            Step(say: "Va tolto anche il vecchio box doccia in muratura, rifatto il massetto e impermeabilizzato con guaina liquida bicomponente prima della nuova pavimentazione.",
                 item: SurveyItem(section: "Demolizioni", text: "Rimozione del vecchio box doccia in muratura con piastrelle, rifacimento del massetto e impermeabilizzazione con guaina liquida bicomponente sotto la nuova pavimentazione, compresi sfridi e pulizia finale", quantity: "1 a corpo")),
            Step(say: "Nuovo piatto doccia ottanta per centoventi, filo pavimento.",
                 item: SurveyItem(section: "Impianti e sanitari", text: "Fornitura e posa piatto doccia 80×120 filo pavimento", quantity: "1 pz")),
            Step(say: "Rifacimento impianto idrico del bagno completo.",
                 item: SurveyItem(section: "Impianti e sanitari", text: "Rifacimento impianto idrico bagno", quantity: "a corpo")),
            Step(say: "Posa gres porcellanato sessanta per sessanta, sempre trenta metri quadri.",
                 item: SurveyItem(section: "Pavimenti e rivestimenti", text: "Posa gres porcellanato 60×60", quantity: "30 m²")),
        ]
        demoTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(1))
            for step in script {
                // Le parole arrivano una per volta, la sfera segue la "voce".
                let words = step.say.split(separator: " ").map(String.init)
                var spoken: [String] = []
                for word in words {
                    while demoPaused { try? await Task.sleep(for: .milliseconds(200)) }
                    if Task.isCancelled { return }
                    spoken.append(word)
                    demoVolatile = spoken.joined(separator: " ")
                    demoLevel = Double.random(in: 0.35...0.95)
                    try? await Task.sleep(for: .milliseconds(Int.random(in: 170...300)))
                    demoLevel *= 0.4
                }
                demoFinal = [demoFinal, demoVolatile].filter { !$0.isEmpty }.joined(separator: " ")
                demoVolatile = ""
                demoLevel = 0
                if step.item != nil || step.note != nil {
                    demoThinking = true
                    try? await Task.sleep(for: .milliseconds(900))
                    demoThinking = false
                    if let item = step.item { add(item) }
                    if let note = step.note {
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.75)) { notes.append(SurveyNote(text: note)) }
                    }
                }
                try? await Task.sleep(for: .milliseconds(700))
            }
        }
    }
}

// MARK: - Testo in diretta

struct LiveTranscript: View {
    let text: String

    var body: some View {
        // Il testo cresce verso l'alto: si vedono sempre le ultime parole.
        Text(text.isEmpty ? " " : text)
            .font(.system(.body, design: .rounded))
            .foregroundStyle(.primary.opacity(0.85))
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
            .frame(height: 70, alignment: .bottom)
            .clipped()
            // Le righe vecchie sfumano verso l'alto.
            .mask(LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .clear, location: 0.12),
                                         .init(color: .black, location: 0.62)],
                                 startPoint: .top, endPoint: .bottom))
            .accessibilityLabel(text.isEmpty ? "Nessun testo ancora" : text)
    }
}

// MARK: - Bozza del preventivo

private struct DraftSheet: View {
    let context: SurveyContext
    let title: String?
    var client: SurveyClient? = nil
    let items: [SurveyItem]
    let notes: [SurveyNote]
    let shots: [SurveyShot]
    let fresh: Set<UUID>
    let demo: Bool
    var sectionOrder: [String] = []
    var optionalSections: Set<String> = []
    var offline = false
    var onRemove: (SurveyItem) -> Void = { _ in }
    var onRemoveNote: (SurveyNote) -> Void = { _ in }

    private var sections: [(String, [SurveyItem])] {
        var order = sectionOrder
        for item in items where !order.contains(item.section) { order.append(item.section) }
        return order.map { title in (title, items.filter { $0.section == title }) }.filter { !$0.1.isEmpty }
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    if items.isEmpty && notes.isEmpty && shots.isEmpty {
                        placeholder
                    }
                    ForEach(sections, id: \.0) { section, rows in
                        VStack(alignment: .leading, spacing: 8) {
                            SectionLabel(section, optional: optionalSections.contains(section))
                            ForEach(rows) { item in
                                ItemRow(index: (items.firstIndex(of: item) ?? 0) + 1, item: item, fresh: fresh.contains(item.id),
                                        onRemove: demo ? nil : { onRemove(item) })
                                    .id(item.id)
                                    .transition(.asymmetric(
                                        insertion: .move(edge: .bottom).combined(with: .opacity).combined(with: .scale(scale: 0.94, anchor: .bottom)),
                                        removal: .opacity))
                            }
                        }
                        .transition(.opacity)
                    }
                    if !notes.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            SectionLabel("Note")
                            ForEach(notes) { note in
                                HStack(alignment: .top, spacing: 8) {
                                    Label(note.text, systemImage: "lightbulb")
                                        .font(.subheadline)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    if !demo {
                                        RemoveButton(label: "Togli la nota") { onRemoveNote(note) }
                                    }
                                }
                                    .padding(10)
                                    .background(Color.yellow.opacity(0.14), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                                    .transition(.move(edge: .leading).combined(with: .opacity))
                            }
                        }
                    }
                    if !shots.isEmpty {
                        ScrollView(.horizontal) {
                            HStack(spacing: 8) {
                                ForEach(shots) { shot in
                                    Image(uiImage: shot.image)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 72, height: 72)
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                        .transition(.scale(scale: 0.6).combined(with: .opacity))
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                    }
                    Color.clear.frame(height: 110).id("bottom")
                }
                .padding(18)
            }
            .scrollIndicators(.hidden)
            // Le card scorrono dentro il foglio: ritagliate dai suoi angoli e sfumate in alto.
            .mask {
                VStack(spacing: 0) {
                    LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom).frame(height: 18)
                    Rectangle()
                }
            }
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 30, topTrailingRadius: 30, style: .continuous))
            .onChange(of: items.count) {
                withAnimation(.smooth(duration: 0.5)) { proxy.scrollTo("bottom", anchor: .bottom) }
            }
        }
        .background(.regularMaterial, in: UnevenRoundedRectangle(topLeadingRadius: 30, topTrailingRadius: 30, style: .continuous))
        .overlay {
            UnevenRoundedRectangle(topLeadingRadius: 30, topTrailingRadius: 30, style: .continuous)
                .strokeBorder(.white.opacity(0.5), lineWidth: 0.5)
        }
        .shadow(color: .black.opacity(0.06), radius: 20, y: -4)
        .ignoresSafeArea(.container, edges: .bottom)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(context.parentQuoteID != nil ? "Lavoro extra" : "Bozza del preventivo")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.accentColor)
            Text(title?.isEmpty == false ? title! : (context.parentTitle ?? "Nuovo sopralluogo"))
                .contentTransition(.opacity)
                .font(.title3.weight(.bold))
                .lineLimit(2)
            if let client = client ?? context.client.map({ SurveyClient(id: $0.id, name: $0.name) }) {
                VStack(alignment: .leading, spacing: 1) {
                    Label(client.name, systemImage: client.id == nil ? "person.badge.plus" : "person")
                        .font(.subheadline)
                    if let details = client.details {
                        Text(details)
                            .font(.caption)
                            .lineLimit(2)
                            .padding(.leading, 26)
                    }
                }
                .foregroundStyle(.secondary)
                .contentTransition(.opacity)
            }
            if offline {
                Label("Senza rete: il testo è al sicuro e verrà elaborato appena torna la connessione.", systemImage: "wifi.slash")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .padding(.top, 4)
                    .transition(.opacity)
            }
        }
        .animation(.smooth, value: offline)
    }

    private var placeholder: some View {
        VStack(spacing: 8) {
            Image(systemName: "waveform")
                .font(.title2)
                .foregroundStyle(.secondary)
                .symbolEffect(.variableColor.iterative, options: .repeating)
            Text("Descrivi i lavori: le voci e le note compariranno qui mentre parli.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}

private struct SectionLabel: View {
    let title: String
    var optional = false
    init(_ title: String, optional: Bool = false) {
        self.title = title
        self.optional = optional
    }

    var body: some View {
        HStack(spacing: 6) {
            Text(title.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .kerning(0.8)
                // Colore pieno: sul vetro il grigio "secondario" diventerebbe quasi trasparente.
                .foregroundStyle(Color(uiColor: .secondaryLabel))
            if optional {
                Text("Opzionale")
                    .font(.system(size: 10, weight: .semibold))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Color.orange.opacity(0.16), in: Capsule())
                    .foregroundStyle(Color.orange)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.leading, 4)
        .accessibilityAddTraits(.isHeader)
    }
}

private struct RemoveButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.secondary)
                .frame(width: 26, height: 26)
                .background(Color.primary.opacity(0.06), in: Circle())
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(-9)
        .accessibilityLabel(label)
    }
}

private struct ItemRow: View {
    let index: Int
    let item: SurveyItem
    let fresh: Bool
    var onRemove: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(index)")
                .font(.caption.weight(.bold).monospacedDigit())
                .foregroundStyle(.white)
                .frame(width: 22, height: 22)
                .background(Color.accentColor, in: Circle())
            // Le voci lunghe vanno a capo; la quantità resta intera a destra, in alto.
            Text(item.text)
                .font(.subheadline.weight(.medium))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: 4) {
                if let quantity = item.quantity {
                    Text(quantity)
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .lineLimit(1)
                        .fixedSize()
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.primary.opacity(0.06), in: Capsule())
                }
                if let price = item.price {
                    Text(price, format: .currency(code: "EUR"))
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(Color.accentColor)
                        .lineLimit(1)
                        .fixedSize()
                }
            }
            if let onRemove {
                RemoveButton(label: "Togli la voce", action: onRemove)
            }
        }
        .padding(12)
        .background {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground).opacity(0.9))
                .overlay {
                    // Bagliore della voce appena arrivata, che si spegne piano.
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(LinearGradient(colors: [Color(red: 0.33, green: 0.70, blue: 0.89), Color(red: 0.44, green: 0.36, blue: 0.93)],
                                                     startPoint: .leading, endPoint: .trailing), lineWidth: 1.5)
                        .opacity(fresh ? 1 : 0)
                }
                .shadow(color: Color(red: 0.33, green: 0.70, blue: 0.89).opacity(fresh ? 0.45 : 0), radius: 12)
        }
    }
}

// MARK: - Revisione

/// Fine del sopralluogo: si rivede il testo (diventa le note del preventivo) e si salva.
/// Dopo il salvataggio il testo trascritto non resta da nessuna parte.
struct SurveyReviewView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let context: SurveyContext
    var title: String?
    let initialText: String
    let items: [SurveyItem]
    var aiNotes: [String] = []
    let shots: [SurveyShot]
    var sectionOrder: [String] = []
    var optionalSections: Set<String> = []
    var quoteFields = SurveyQuoteFields()
    var client: SurveyClient?

    @State private var editTitle = ""
    @State private var notes = ""
    @State private var saving = false
    @State private var progress = ""
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                if context.parentQuoteID == nil {
                    Section("Titolo") {
                        TextField("Titolo", text: $editTitle, prompt: Text("Es. Ristrutturazione bagno"), axis: .vertical)
                    }
                }
                Section {
                    TextEditor(text: $notes)
                        .frame(minHeight: 180)
                } header: {
                    Text("Note dal sopralluogo")
                } footer: {
                    Text("Correggi il testo se serve: va nelle note del preventivo. Il testo trascritto non viene conservato altrove.")
                }
                if let client {
                    Section("Cliente") {
                        Label(client.id == nil ? "\(client.name) — nuovo, va in rubrica" : client.name,
                              systemImage: client.id == nil ? "person.badge.plus" : "person")
                        if let details = client.details {
                            Text(details).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
                if !items.isEmpty {
                    Section {
                        Label("\(items.count) \(items.count == 1 ? "voce" : "voci") in \(Set(items.map(\.section)).count) sezioni", systemImage: "list.bullet.rectangle")
                        let optionalCount = Set(items.map(\.section)).intersection(optionalSections).count
                        if optionalCount > 0 {
                            Label("\(optionalCount) \(optionalCount == 1 ? "sezione opzionale" : "sezioni opzionali")", systemImage: "plus.square.dashed")
                        }
                        if !quoteFields.summary.isEmpty {
                            Label(quoteFields.summary.joined(separator: " · "), systemImage: "slider.horizontal.3")
                        }
                    } footer: {
                        Text("Le voci entrano nel preventivo con le loro sezioni; i prezzi non detti restano da completare nell'editor.")
                    }
                }
                if !shots.isEmpty {
                    Section("Foto (\(shots.count))") {
                        ScrollView(.horizontal) {
                            HStack(spacing: 8) {
                                ForEach(shots) { shot in
                                    Image(uiImage: shot.image).resizable().scaledToFill()
                                        .frame(width: 84, height: 84)
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                    }
                }
                if let error {
                    Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
                }
            }
            .navigationTitle("Rivedi")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Indietro", systemImage: "chevron.left") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        HStack(spacing: 6) { ProgressView(); Text(progress).font(.caption) }
                    } else {
                        Button("Salva") { save() }
                            .fontWeight(.semibold)
                    }
                }
            }
            .interactiveDismissDisabled(saving)
        }
        .onAppear {
            editTitle = title ?? context.title ?? ""
            // Con l'IA le note sono quelle che ha raccolto; senza, il testo dettato.
            notes = aiNotes.isEmpty ? initialText : aiNotes.map { "• " + $0 }.joined(separator: "\n")
        }
    }

    private func save() {
        if context.demo {
            // Prova: nessun preventivo creato.
            dismiss()
            model.survey = nil
            return
        }
        saving = true
        error = nil
        let note = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalTitle = editTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            defer { saving = false }
            do {
                // Cliente detto a voce: quello in rubrica con lo stesso nome, altrimenti nuovo.
                var clientId = context.client?.id
                if let c = client {
                    progress = "Cliente…"
                    if let existing = c.id {
                        if c.changed { let _: ClientRef = try await APIClient.shared.send("PATCH", "/api/clients/\(existing)", json: c.payload) }
                        clientId = existing
                    } else if context.parentQuoteID == nil {
                        let query = c.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? c.name
                        let found: [ClientRef] = (try? await APIClient.shared.get("/api/clients?search=\(query)")) ?? []
                        if let match = found.first(where: { $0.name.caseInsensitiveCompare(c.name) == .orderedSame }) {
                            if c.payload.count > 1 { let _: ClientRef = try await APIClient.shared.send("PATCH", "/api/clients/\(match.id)", json: c.payload) }
                            clientId = match.id
                        } else {
                            let created: CreatedID = try await APIClient.shared.send("POST", "/api/clients", json: c.payload)
                            clientId = created.id
                        }
                    }
                }
                progress = "Creo il preventivo…"
                let id: String
                if let parent = context.parentQuoteID {
                    let created: CreatedID = try await APIClient.shared.send("POST", "/api/quotes/\(parent)/extras")
                    id = created.id
                    if !note.isEmpty {
                        let _: OKResponse = try await APIClient.shared.send("PATCH", "/api/quotes/\(id)", json: ["notes": note])
                    }
                } else {
                    let fallback = "Sopralluogo del " + Date.now.formatted(.dateTime.day().month(.wide).year())
                    let created: CreatedID = try await APIClient.shared.send("POST", "/api/quotes", json: [
                        "title": finalTitle.isEmpty ? fallback : finalTitle,
                        "clientId": clientId,
                        "projectAddress": context.address,
                        "notes": note.isEmpty ? nil : note,
                    ])
                    id = created.id
                }
                // Sezioni e voci dettate (D1b), nell'ordine in cui sono comparse.
                var order = sectionOrder.filter { title in items.contains { $0.section == title } }
                for item in items where !order.contains(item.section) { order.append(item.section) }
                let letters = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
                for (sIndex, section) in order.enumerated() {
                    progress = "Sezione \(sIndex + 1) di \(order.count)…"
                    let createdSection: CreatedID = try await APIClient.shared.send("POST", "/api/quotes/\(id)/sections", json: [
                        "code": sIndex < letters.count ? String(letters[sIndex]) : "\(sIndex + 1)",
                        "title": section,
                        "orderIndex": sIndex,
                        "isOptional": optionalSections.contains(section),
                    ])
                    for (iIndex, item) in items.filter({ $0.section == section }).enumerated() {
                        let _: CreatedID = try await APIClient.shared.send("POST", "/api/quotes/\(id)/items", json: [
                            "sectionId": createdSection.id,
                            "description": item.text,
                            "unitOfMeasure": item.unit ?? "a corpo",
                            "quantity": item.qty ?? 1,
                            "unitPrice": item.price ?? 0,
                            "discount": 0,
                            "orderIndex": iIndex,
                        ])
                    }
                }
                // IVA, sconto, pagamenti e validità detti a voce.
                var fields: [String: Any] = [:]
                if let x = quoteFields.vatRate { fields["vatRate"] = x }
                if let x = quoteFields.discountPercent { fields["discountType"] = x > 0 ? "percent" : NSNull(); fields["discountValue"] = x > 0 ? x : NSNull() }
                if let x = quoteFields.paymentTerms { fields["paymentTerms"] = x }
                if let x = quoteFields.validUntil { fields["validUntil"] = x }
                if !fields.isEmpty {
                    let _: OKResponse = try await APIClient.shared.send("PATCH", "/api/quotes/\(id)", json: fields)
                }
                for (index, shot) in shots.enumerated() {
                    progress = "Foto \(index + 1) di \(shots.count)…"
                    guard let raw = shot.image.jpegData(compressionQuality: 0.95),
                          let jpeg = await Task.detached(priority: .userInitiated, operation: { SitePhotoPrep.jpeg(from: raw) }).value
                    else { continue }
                    _ = try? await APIClient.shared.upload("/api/quotes/\(id)/photos", data: jpeg,
                                                           filename: "sopralluogo-\(index + 1).jpg", mimeType: "image/jpeg", fields: [:])
                }
                model.quoteToOpen = id
                dismiss()
                model.survey = nil
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

private struct OKResponse: Decodable {}

private extension String {
    var nilIfEmpty: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
