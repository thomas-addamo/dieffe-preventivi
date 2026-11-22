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
    var quantity: String?
}

struct SurveyNote: Identifiable, Equatable {
    let id = UUID()
    var text: String
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
        if isDemo ? demoThinking : speech.state == .preparing { return .thinking }
        if paused { return .idle }
        return (isDemo || speech.state == .listening) ? .listening : .idle
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            background

            VStack(spacing: 0) {
                topBar
                SurveyOrb(mood: mood, level: level, size: 150)
                    .padding(.top, 6)
                statusLine
                    .padding(.top, 14)
                LiveTranscript(text: text)
                    .padding(.horizontal, 24)
                    .padding(.top, 10)
                DraftSheet(context: context, items: items, notes: notes, shots: shots, fresh: fresh, demo: isDemo)
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
            if isDemo { runDemo() } else { await speech.start() }
        }
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
            SurveyReviewView(context: context, initialText: text, items: items, shots: shots)
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
            if isDemo { demoTask?.cancel(); demoLevel = 0 } else { await speech.finish() }
            showReview = true
        }
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

private struct LiveTranscript: View {
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
            .mask(LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.55)],
                                 startPoint: .top, endPoint: .bottom))
            .accessibilityLabel(text.isEmpty ? "Nessun testo ancora" : text)
    }
}

// MARK: - Bozza del preventivo

private struct DraftSheet: View {
    let context: SurveyContext
    let items: [SurveyItem]
    let notes: [SurveyNote]
    let shots: [SurveyShot]
    let fresh: Set<UUID>
    let demo: Bool

    private var sections: [(String, [SurveyItem])] {
        var order: [String] = []
        var groups: [String: [SurveyItem]] = [:]
        for item in items {
            if groups[item.section] == nil { order.append(item.section) }
            groups[item.section, default: []].append(item)
        }
        return order.map { ($0, groups[$0] ?? []) }
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
                            SectionLabel(section)
                            ForEach(rows) { item in
                                ItemRow(index: (items.firstIndex(of: item) ?? 0) + 1, item: item, fresh: fresh.contains(item.id))
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
                                Label(note.text, systemImage: "lightbulb")
                                    .font(.subheadline)
                                    .padding(10)
                                    .frame(maxWidth: .infinity, alignment: .leading)
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
            Text(context.title?.isEmpty == false ? context.title! : (context.parentTitle ?? "Nuovo sopralluogo"))
                .font(.title3.weight(.bold))
                .lineLimit(2)
            if let client = context.client?.name {
                Label(client, systemImage: "person")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var placeholder: some View {
        VStack(spacing: 8) {
            Image(systemName: "waveform")
                .font(.title2)
                .foregroundStyle(.secondary)
                .symbolEffect(.variableColor.iterative, options: .repeating)
            Text(demo ? "Le voci compariranno qui mentre parli." : "Parla liberamente: il testo diventerà le note del preventivo, che potrai rivedere alla fine.")
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
    init(_ title: String) { self.title = title }

    var body: some View {
        Text(title.uppercased())
            .font(.system(size: 12, weight: .semibold))
            .kerning(0.8)
            // Colore pieno: sul vetro il grigio "secondario" diventerebbe quasi trasparente.
            .foregroundStyle(Color(uiColor: .secondaryLabel))
            .padding(.leading, 4)
            .accessibilityAddTraits(.isHeader)
    }
}

private struct ItemRow: View {
    let index: Int
    let item: SurveyItem
    let fresh: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(index)")
                .font(.caption.weight(.bold).monospacedDigit())
                .foregroundStyle(.white)
                .frame(width: 22, height: 22)
                .background(Color.accentColor, in: Circle())
            Text(item.text)
                .font(.subheadline.weight(.medium))
                .frame(maxWidth: .infinity, alignment: .leading)
            if let quantity = item.quantity {
                Text(quantity)
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.primary.opacity(0.06), in: Capsule())
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
    let initialText: String
    let items: [SurveyItem]
    let shots: [SurveyShot]

    @State private var title = ""
    @State private var notes = ""
    @State private var saving = false
    @State private var progress = ""
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                if context.parentQuoteID == nil {
                    Section("Titolo") {
                        TextField("Titolo", text: $title, prompt: Text("Es. Ristrutturazione bagno"), axis: .vertical)
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
            title = context.title ?? ""
            notes = initialText
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
        let finalTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            defer { saving = false }
            do {
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
                        "clientId": context.client?.id,
                        "projectAddress": context.address,
                        "notes": note.isEmpty ? nil : note,
                    ])
                    id = created.id
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
