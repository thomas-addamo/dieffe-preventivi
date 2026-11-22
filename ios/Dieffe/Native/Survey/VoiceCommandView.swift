import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// Comando vocale sul preventivo (D1c, solo iPhone). Dall'editor si tocca il
// microfono e si dice cosa cambiare ("la posa mettila a 45 euro", "aggiungi in
// opzione il box doccia", "IVA al 10"): l'IA capisce a quale voce o sezione ci
// si riferisce e applica le modifiche subito. Ogni comando si può annullare.
// Una sola richiesta all'IA per comando, quando si tocca Fatto.
// ─────────────────────────────────────────────────────────────────────────────

private struct VoiceResult: Decodable {
    let changes: [String]
    let undoId: String?
}

private struct VoiceOK: Decodable {}

struct VoiceCommandView: View {
    @Environment(\.dismiss) private var dismiss
    let editor: QuoteEditorModel

    private enum Phase: Equatable { case listening, typing, working, done, failed(String) }

    @State private var speech = SurveySpeech()
    @State private var phase: Phase = .listening
    @State private var typed = ""
    @State private var changes: [String] = []
    @State private var undoId: String?
    @State private var undone = false
    @State private var undoing = false
    @FocusState private var typingFocused: Bool

    private var mood: OrbMood {
        switch phase {
        case .working: return .thinking
        case .listening: return speech.state == .listening ? .listening : (speech.state == .preparing ? .thinking : .idle)
        default: return .idle
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SurveyOrb(mood: mood, level: phase == .listening ? speech.level : 0, size: 96)
                    .padding(.top, 30)
                status
                    .padding(.top, 22)
                content
                    .padding(.horizontal, 22)
                    .padding(.top, 12)
                Spacer(minLength: 12)
                actions
                    .padding(.horizontal, 20)
                    .padding(.bottom, 12)
            }
            .frame(maxWidth: .infinity)
            .navigationTitle("Comando vocale")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Chiudi", systemImage: "xmark") { close() }
                        .disabled(phase == .working || undoing)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(phase == .working || undoing)
        .sensoryFeedback(.success, trigger: changes.count)
        .task { await begin() }
        .onChange(of: speech.state) { _, state in
            // Senza riconoscimento vocale (simulatore, permesso negato) si scrive.
            if case .failed = state, phase == .listening { phase = .typing; typingFocused = true }
        }
        .onDisappear { speech.cancel() }
    }

    // MARK: Parti

    @ViewBuilder private var status: some View {
        Group {
            switch phase {
            case .listening:
                Text(speech.state == .preparing ? "Preparo l'ascolto…" : "Dimmi cosa cambiare")
            case .typing:
                Text("Scrivi cosa cambiare")
            case .working:
                Text("Sto modificando il preventivo…")
            case .done:
                Text(undone ? "Modifiche annullate" : (changes.isEmpty ? "Non ho trovato nulla da cambiare" : "Fatto"))
            case .failed:
                Text("Qualcosa non è andato")
            }
        }
        .font(.headline)
        .contentTransition(.opacity)
        .animation(.smooth, value: phase)
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .listening:
            LiveTranscript(text: speech.fullText)
                .frame(maxHeight: 140)
            if speech.fullText.isEmpty {
                Text("Es. «la posa mettila a 45 euro al metro», «aggiungi in opzione il box doccia», «togli la seconda voce», «IVA al 10»")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)
            }
        case .typing:
            TextField("Es. aggiungi in opzione il box doccia", text: $typed, axis: .vertical)
                .lineLimit(2...5)
                .focused($typingFocused)
                .padding(12)
                .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        case .working:
            Text(commandText)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .lineLimit(4)
        case .done:
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(changes.enumerated()), id: \.offset) { index, change in
                        Label {
                            Text(change).strikethrough(undone)
                        } icon: {
                            Image(systemName: undone ? "arrow.uturn.backward.circle.fill" : "checkmark.circle.fill")
                                .foregroundStyle(undone ? Color.secondary : Color.green)
                        }
                        .font(.callout)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .animation(.spring(response: 0.45, dampingFraction: 0.8).delay(Double(index) * 0.06), value: changes)
                    }
                    if changes.isEmpty {
                        Text("Prova a dirlo in un altro modo, indicando la voce o la sezione.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollBounceBehavior(.basedOnSize)
        case .failed(let message):
            Label(message, systemImage: "exclamationmark.triangle.fill")
                .font(.callout)
                .foregroundStyle(.red)
                .multilineTextAlignment(.center)
        }
    }

    @ViewBuilder private var actions: some View {
        HStack(spacing: 10) {
            switch phase {
            case .listening, .typing:
                Button { Task { await send() } } label: {
                    Label("Fatto", systemImage: "arrow.up").frame(maxWidth: .infinity).frame(height: 30)
                }
                .buttonStyle(.glassProminent)
                .disabled(commandText.count < 3 && phase == .typing)
            case .working:
                ProgressView().frame(height: 50)
            case .done, .failed:
                if undoId != nil, !undone, phase == .done {
                    Button { Task { await undo() } } label: {
                        Label("Annulla", systemImage: "arrow.uturn.backward").frame(maxWidth: .infinity).frame(height: 30)
                    }
                    .buttonStyle(.glass)
                    .disabled(undoing)
                }
                if case .failed = phase, typed.count >= 3 {
                    Button { Task { phase = .typing; await send() } } label: {
                        Label("Riprova", systemImage: "arrow.clockwise").frame(maxWidth: .infinity).frame(height: 30)
                    }
                    .buttonStyle(.glass)
                }
                Button { Task { await again() } } label: {
                    Label("Altro comando", systemImage: "mic.fill").frame(maxWidth: .infinity).frame(height: 30)
                }
                .buttonStyle(.glassProminent)
                .disabled(undoing)
            }
        }
        .controlSize(.large)
    }

    // MARK: Azioni

    private var commandText: String {
        (phase == .typing ? typed : speech.fullText).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func begin() async {
        await editor.flush()
        await speech.start()
    }

    private func send() async {
        let wasTyping = phase == .typing
        if !wasTyping { await speech.finish() }
        let text = wasTyping ? typed.trimmingCharacters(in: .whitespacesAndNewlines) : speech.finalText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count >= 3 else {
            phase = .typing
            typingFocused = true
            return
        }
        typed = text
        withAnimation(.smooth) { phase = .working }
        do {
            let result: VoiceResult = try await APIClient.shared.send("POST", "/api/quotes/\(editor.quoteID)/voice", json: ["text": text])
            await editor.load()
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                changes = result.changes
                undoId = result.undoId
                undone = false
                phase = .done
            }
        } catch {
            withAnimation(.smooth) { phase = .failed(error.localizedDescription) }
        }
    }

    private func undo() async {
        guard let undoId else { return }
        undoing = true
        defer { undoing = false }
        do {
            try await APIClient.shared.delete("/api/quotes/\(editor.quoteID)/voice?undo=\(undoId)")
            await editor.load()
            withAnimation(.smooth) { undone = true }
        } catch {
            withAnimation(.smooth) { phase = .failed(error.localizedDescription) }
        }
    }

    private func again() async {
        speech.cancel()
        speech = SurveySpeech()
        typed = ""
        changes = []
        undoId = nil
        undone = false
        withAnimation(.smooth) { phase = .listening }
        await speech.start()
    }

    private func close() {
        speech.cancel()
        dismiss()
    }
}
