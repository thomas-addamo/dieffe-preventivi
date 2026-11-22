@preconcurrency import AVFoundation
import Observation
import Speech

// ─────────────────────────────────────────────────────────────────────────────
// Sopralluogo (D1): trascrizione sul telefono con SpeechAnalyzer (iOS 26).
// Italiano, senza rete, gratis; l'audio non lascia mai l'iPhone e non viene
// salvato. Espone il testo definitivo, quello provvisorio (le parole che si
// stanno ancora riconoscendo) e il livello della voce per animare la sfera.
// ─────────────────────────────────────────────────────────────────────────────

@MainActor
@Observable
final class SurveySpeech {
    enum State: Equatable { case idle, preparing, listening, paused, finished, failed(String) }

    private(set) var state: State = .idle
    /// Frasi già riconosciute in modo definitivo.
    private(set) var finalText = ""
    /// La frase in corso (cambia mentre si parla).
    private(set) var volatileText = ""
    /// Livello della voce 0…1, smussato (per la sfera).
    private(set) var level: Double = 0

    var fullText: String {
        [finalText, volatileText].filter { !$0.isEmpty }.joined(separator: " ")
    }

    private let engine = AVAudioEngine()
    private var analyzer: SpeechAnalyzer?
    private var input: AsyncStream<AnalyzerInput>.Continuation?
    private var resultsTask: Task<Void, Never>?
    private let feeder = AudioFeeder()

    // MARK: Comandi

    func start() async {
        guard state == .idle || state == .finished else { return }
        state = .preparing
        do {
            guard await AVAudioApplication.requestRecordPermission() else {
                throw SpeechError("Serve il permesso del microfono: Impostazioni › Dieffe › Microfono.")
            }
            let italian = Locale(identifier: "it-IT")
            // Prima il trascrittore di iOS 26 (il migliore per il parlato lungo); dove non
            // c'è o non supporta l'italiano (simulatore, iPhone meno recenti) la dettatura.
            let module: any SpeechModule
            let results: AsyncThrowingStream<(String, Bool), Error>
            if SpeechTranscriber.isAvailable,
               let locale = await SpeechTranscriber.supportedLocale(equivalentTo: italian) {
                let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [],
                                                    reportingOptions: [.volatileResults], attributeOptions: [])
                module = transcriber
                results = Self.texts(transcriber.results.map { (String($0.text.characters), $0.isFinal) })
            } else if let locale = await DictationTranscriber.supportedLocale(equivalentTo: italian) {
                let dictation = DictationTranscriber(locale: locale, preset: .progressiveLongDictation)
                module = dictation
                results = Self.texts(dictation.results.map { (String($0.text.characters), $0.isFinal) })
            } else {
                throw SpeechError("La trascrizione in italiano non è disponibile su questo iPhone.")
            }
            // Il modello italiano si scarica una volta sola (poi funziona senza rete).
            if let request = try await AssetInventory.assetInstallationRequest(supporting: [module]) {
                try await request.downloadAndInstall()
            }
            let analyzer = SpeechAnalyzer(modules: [module])
            guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [module]) else {
                throw SpeechError("Riconoscimento vocale non disponibile su questo iPhone.")
            }
            let (stream, continuation) = AsyncStream.makeStream(of: AnalyzerInput.self)
            try await analyzer.start(inputSequence: stream)
            self.analyzer = analyzer
            self.input = continuation

            resultsTask = Task { [weak self] in
                do {
                    for try await (raw, isFinal) in results {
                        let text = raw.trimmingCharacters(in: .whitespaces)
                        guard let self else { return }
                        if isFinal {
                            if !text.isEmpty {
                                self.finalText = self.finalText.isEmpty ? text : self.finalText + " " + text
                            }
                            self.volatileText = ""
                        } else {
                            self.volatileText = text
                        }
                    }
                } catch {
                    self?.state = .failed(Self.friendly(error))
                }
            }

            try startAudio(format: format, continuation: continuation)
            state = .listening
        } catch {
            stopAudio()
            state = .failed(Self.friendly(error))
        }
    }

    func pause() {
        guard state == .listening else { return }
        engine.pause()
        feeder.paused = true
        level = 0
        state = .paused
    }

    func resume() {
        guard state == .paused else { return }
        feeder.paused = false
        try? engine.start()
        state = .listening
    }

    /// Ferma l'ascolto e aspetta le ultime parole.
    func finish() async {
        guard state == .listening || state == .paused else { return }
        stopAudio()
        input?.finish()
        try? await analyzer?.finalizeAndFinishThroughEndOfInput()
        resultsTask = nil
        if !volatileText.isEmpty {
            finalText = finalText.isEmpty ? volatileText : finalText + " " + volatileText
            volatileText = ""
        }
        level = 0
        state = .finished
    }

    func cancel() {
        stopAudio()
        input?.finish()
        resultsTask?.cancel()
        analyzer = nil
        state = .idle
    }

    /// I risultati dei due motori come (testo, definitivo).
    private static func texts<S: AsyncSequence & Sendable>(_ sequence: S) -> AsyncThrowingStream<(String, Bool), Error>
    where S.Element == (String, Bool) {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await item in sequence { continuation.yield(item) }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// Messaggi in italiano: gli errori del sistema arrivano in inglese.
    private static func friendly(_ error: Error) -> String {
        if let error = error as? SpeechError { return error.message }
        return "Non riesco ad ascoltare su questo dispositivo. Puoi scattare foto e scrivere le note nella revisione."
    }

    // MARK: Audio

    private func startAudio(format: AVAudioFormat, continuation: AsyncStream<AnalyzerInput>.Continuation) throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let node = engine.inputNode
        let inputFormat = node.outputFormat(forBus: 0)
        feeder.configure(from: inputFormat, to: format, continuation: continuation) { [weak self] rms in
            Task { @MainActor in
                guard let self else { return }
                // Risposta veloce in salita, lenta in discesa: la sfera "respira" con la voce.
                let target = min(1, Double(rms) * 9)
                self.level = target > self.level ? self.level * 0.4 + target * 0.6 : self.level * 0.85 + target * 0.15
            }
        }
        node.removeTap(onBus: 0)
        node.installTap(onBus: 0, bufferSize: 2048, format: inputFormat) { [feeder] buffer, _ in
            feeder.feed(buffer)
        }
        engine.prepare()
        try engine.start()
    }

    private func stopAudio() {
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

private struct SpeechError: Error {
    let message: String
    init(_ message: String) { self.message = message }
}

/// Converte i blocchi del microfono nel formato del riconoscitore e li passa
/// all'analizzatore. Gira sul thread audio, non sull'interfaccia.
private final class AudioFeeder: @unchecked Sendable {
    var paused = false
    private var converter: AVAudioConverter?
    private var outFormat: AVAudioFormat?
    private var continuation: AsyncStream<AnalyzerInput>.Continuation?
    private var onLevel: ((Float) -> Void)?

    func configure(from input: AVAudioFormat, to output: AVAudioFormat,
                   continuation: AsyncStream<AnalyzerInput>.Continuation, onLevel: @escaping (Float) -> Void) {
        converter = AVAudioConverter(from: input, to: output)
        outFormat = output
        self.continuation = continuation
        self.onLevel = onLevel
        paused = false
    }

    func feed(_ buffer: AVAudioPCMBuffer) {
        guard !paused else { return }
        onLevel?(Self.rms(buffer))
        guard let converter, let outFormat else { return }
        let ratio = outFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 32
        guard let out = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: capacity) else { return }
        var consumed = false
        var error: NSError?
        converter.convert(to: out, error: &error) { _, status in
            if consumed {
                status.pointee = .noDataNow
                return nil
            }
            consumed = true
            status.pointee = .haveData
            return buffer
        }
        if error == nil, out.frameLength > 0 {
            continuation?.yield(AnalyzerInput(buffer: out))
        }
    }

    private static func rms(_ buffer: AVAudioPCMBuffer) -> Float {
        guard let data = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
        let n = Int(buffer.frameLength)
        var sum: Float = 0
        for i in stride(from: 0, to: n, by: 4) { sum += data[i] * data[i] }
        return (sum / Float(max(1, n / 4))).squareRoot()
    }
}
