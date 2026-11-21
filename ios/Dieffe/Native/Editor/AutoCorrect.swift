import SwiftUI

// Correzione automatica (B2), come src/hooks/use-auto-correct.ts sul sito:
// dopo qualche secondo senza scrivere sistema maiuscole, spazi e punteggiatura
// in locale e i refusi con l'IA (/api/ai/proofread, solo con almeno tre
// parole e testi mai controllati). Non tocca i testi già salvati all'apertura,
// scarta la correzione se nel frattempo si è scritto ancora e offre "Annulla".

enum AutoCorrectField: String, CaseIterable {
    case title, descriptions, notes

    var key: String { "autocorrect.\(rawValue)" }
    var label: String {
        switch self {
        case .title: "Titolo del preventivo"
        case .descriptions: "Descrizioni delle voci"
        case .notes: "Note"
        }
    }
}

enum AutoCorrect {
    static let delayKey = "autocorrect.delay"
    static let delays = [1, 2, 3, 5, 10]

    static func isEnabled(_ field: AutoCorrectField) -> Bool {
        UserDefaults.standard.object(forKey: field.key) as? Bool ?? true
    }

    static var delay: Int {
        let v = UserDefaults.standard.integer(forKey: delayKey)
        return (1...30).contains(v) ? v : 3
    }

    /// Testi già controllati dall'IA e testi da lasciare così ("Annulla").
    @MainActor static var checked: Set<String> = []
    @MainActor static var kept: Set<String> = []
    @MainActor static var aiUnavailable = false

    /// Correzioni sicure, riga per riga (identiche a localFix del sito).
    static func localFix(_ text: String) -> String {
        text.components(separatedBy: "\n").map { line -> String in
            let prefixRegex = try! NSRegularExpression(pattern: #"^(\s*(?:[-•]\s+|\d{1,3}\.\s+)?)"#)
            let ns = line as NSString
            let pLen = prefixRegex.firstMatch(in: line, range: NSRange(location: 0, length: ns.length))?.range.length ?? 0
            let prefix = ns.substring(to: pLen)
            var body = ns.substring(from: pLen)
            body = body.replacingOccurrences(of: #"(\S) {2,}(?=\S)"#, with: "$1 ", options: .regularExpression)
            body = body.replacingOccurrences(of: #"(\S) +([,;:!?]|\.(?!\.))(?=\s|$)"#, with: "$1$2", options: .regularExpression)
            body = body.replacingOccurrences(of: #"([,;])(?=[A-Za-zÀ-ÿ])"#, with: "$1 ", options: .regularExpression)
            if let r = body.range(of: #"^[*_~]*[a-zà-ÿ]"#, options: .regularExpression) {
                let last = body.index(before: r.upperBound)
                body.replaceSubrange(last...last, with: String(body[last]).uppercased())
            }
            return prefix + body
        }.joined(separator: "\n")
    }

    static func worthAi(_ text: String) -> Bool {
        text.split(whereSeparator: \.isWhitespace).filter { $0.range(of: #"[A-Za-zÀ-ÿ]{2,}"#, options: .regularExpression) != nil }.count >= 3
    }

    private struct Proofread: Decodable {
        let corrected: String
        let changes: [Change]
        struct Change: Decodable {}
    }

    @MainActor static func correct(_ text: String) async -> String {
        let local = localFix(text)
        guard !aiUnavailable, worthAi(local), !checked.contains(local) else { return local }
        do {
            let r: Proofread = try await APIClient.shared.send("POST", "/api/ai/proofread", json: ["text": local], as: Proofread.self)
            let out = r.changes.isEmpty ? local : r.corrected
            checked.insert(out)
            checked.insert(local)
            return out
        } catch {
            if case APIError.server(let message) = error, message.localizedCaseInsensitiveContains("disattivat") || message.contains("non configurata") {
                aiUnavailable = true
            }
            return local
        }
    }
}

private struct AutoCorrectModifier: ViewModifier {
    @Binding var text: String
    let field: AutoCorrectField
    let active: Bool

    @State private var initial: String?
    @State private var applied: String?
    @State private var undo: String?

    func body(content: Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            content
            if let before = undo {
                HStack(spacing: 6) {
                    Image(systemName: "wand.and.stars").foregroundStyle(.purple)
                    Text("Corretto automaticamente").foregroundStyle(.secondary)
                    Spacer()
                    Button("Annulla") {
                        AutoCorrect.kept.insert(before)
                        applied = before
                        text = before
                        undo = nil
                    }
                    .buttonStyle(.borderless)
                    .fontWeight(.semibold)
                }
                .font(.caption)
                .transition(.opacity)
            }
        }
        .animation(.default, value: undo)
        .onAppear { if initial == nil { initial = text } }
        .task(id: text) {
            let original = text
            guard active, AutoCorrect.isEnabled(field), !original.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  original != initial, original != applied, !AutoCorrect.kept.contains(original) else { return }
            try? await Task.sleep(for: .seconds(AutoCorrect.delay))
            guard !Task.isCancelled else { return }
            let next = await AutoCorrect.correct(original)
            guard !Task.isCancelled, text == original, next != original else { return }
            applied = next
            text = next
            undo = original
            try? await Task.sleep(for: .seconds(6))
            if undo == original { undo = nil }
        }
    }
}

extension View {
    /// Correzione automatica del campo (B2), se attiva nelle impostazioni.
    func autoCorrect(_ text: Binding<String>, _ field: AutoCorrectField, active: Bool = true) -> some View {
        modifier(AutoCorrectModifier(text: text, field: field, active: active))
    }
}

/// Impostazioni della correzione automatica (Profilo → Correzione automatica).
struct AutoCorrectSettingsSection: View {
    @AppStorage("autocorrect.title") private var title = true
    @AppStorage("autocorrect.descriptions") private var descriptions = true
    @AppStorage("autocorrect.notes") private var notes = true
    @AppStorage(AutoCorrect.delayKey) private var delay = 3

    var body: some View {
        Section {
            Toggle(AutoCorrectField.title.label, isOn: $title)
            Toggle(AutoCorrectField.descriptions.label, isOn: $descriptions)
            Toggle(AutoCorrectField.notes.label, isOn: $notes)
            Picker("Attesa", selection: $delay) {
                ForEach(AutoCorrect.delays, id: \.self) { s in Text(s == 1 ? "1 secondo" : "\(s) secondi").tag(s) }
            }
        } header: {
            Text("Correzione automatica")
        } footer: {
            Text("Quando smetti di scrivere sistema maiuscole, punteggiatura e refusi. Non cambia significato né cifre; ogni correzione si può annullare.")
        }
    }
}
