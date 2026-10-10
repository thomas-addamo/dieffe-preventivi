import SwiftUI

/// Descrizioni delle voci in "markdown leggero", lo stesso formato del sito
/// (src/lib/rich-text.ts): **grassetto** *corsivo* __sottolineato__ ~~barrato~~,
/// righe "- " per gli elenchi puntati e "1. " per quelli numerati, `\` per i
/// caratteri letterali. Qui serve a mostrarle formattate e a stamparle in chiaro.
enum RichText {
    private enum Mark: CaseIterable { case bold, underline, strike, italic }

    private static let tokens: [(String, Mark)] = [("**", .bold), ("__", .underline), ("~~", .strike), ("*", .italic)]

    /// Testo formattato per la visualizzazione.
    static func attributed(_ source: String) -> AttributedString {
        var result = AttributedString()
        let lines = source.components(separatedBy: "\n")
        for (index, rawLine) in lines.enumerated() {
            var line = Substring(rawLine)
            if let match = rawLine.wholeMatch(of: /\s*[-•]\s+(.*)/) {
                result += AttributedString("•  ")
                line = match.1
            } else if let match = rawLine.wholeMatch(of: /\s*(\d{1,3})\.\s+(.*)/) {
                result += AttributedString("\(match.1).  ")
                line = match.2
            }
            result += inline(line)
            if index < lines.count - 1 { result += AttributedString("\n") }
        }
        return result
    }

    /// Testo senza marcatori (anteprime, ricerche, AI).
    static func plain(_ source: String) -> String {
        String(attributed(source).characters)
    }

    private static func inline(_ text: Substring) -> AttributedString {
        var output = AttributedString()
        var active: Set<Mark> = []
        var buffer = ""

        func flush() {
            guard !buffer.isEmpty else { return }
            var run = AttributedString(buffer)
            var intent: InlinePresentationIntent = []
            if active.contains(.bold) { intent.insert(.stronglyEmphasized) }
            if active.contains(.italic) { intent.insert(.emphasized) }
            if !intent.isEmpty { run.inlinePresentationIntent = intent }
            if active.contains(.underline) { run.underlineStyle = .single }
            if active.contains(.strike) { run.strikethroughStyle = .single }
            output += run
            buffer = ""
        }

        var i = text.startIndex
        scan: while i < text.endIndex {
            let ch = text[i]
            if ch == "\\", let next = text.index(i, offsetBy: 1, limitedBy: text.endIndex), next < text.endIndex,
               "\\*_~".contains(text[next]) {
                buffer.append(text[next])
                i = text.index(after: next)
                continue
            }
            for (token, mark) in tokens where text[i...].hasPrefix(token) {
                // Un marcatore apre solo se più avanti c'è quello che lo chiude.
                let after = text.index(i, offsetBy: token.count)
                if active.contains(mark) || text[after...].contains(token) {
                    flush()
                    if active.contains(mark) { active.remove(mark) } else { active.insert(mark) }
                    i = after
                    continue scan
                }
            }
            buffer.append(ch)
            i = text.index(after: i)
        }
        flush()
        return output
    }

    // MARK: Modifica

    enum Style: String, CaseIterable, Identifiable {
        case bold, italic, underline, strike
        var id: String { rawValue }

        var token: String {
            switch self {
            case .bold: "**"
            case .italic: "*"
            case .underline: "__"
            case .strike: "~~"
            }
        }

        var symbol: String {
            switch self {
            case .bold: "bold"
            case .italic: "italic"
            case .underline: "underline"
            case .strike: "strikethrough"
            }
        }

        var label: String {
            switch self {
            case .bold: "Grassetto"
            case .italic: "Corsivo"
            case .underline: "Sottolineato"
            case .strike: "Barrato"
            }
        }
    }

    /// Applica (o toglie) uno stile alla parte selezionata del testo.
    static func toggle(_ style: Style, in text: inout String, range: Range<String.Index>?) -> Range<String.Index>? {
        let token = style.token
        guard let range, !range.isEmpty else {
            // Nessuna selezione: inserisce i marcatori, il cursore va in mezzo.
            let at = range?.lowerBound ?? text.endIndex
            let offset = text.distance(from: text.startIndex, to: at)
            text.insert(contentsOf: token + token, at: at)
            let cursor = text.index(text.startIndex, offsetBy: offset + token.count)
            return cursor..<cursor
        }
        let selected = String(text[range])
        let lower = text.distance(from: text.startIndex, to: range.lowerBound)
        if selected.hasPrefix(token), selected.hasSuffix(token), selected.count >= token.count * 2 {
            let inner = String(selected.dropFirst(token.count).dropLast(token.count))
            text.replaceSubrange(range, with: inner)
            return text.index(text.startIndex, offsetBy: lower)..<text.index(text.startIndex, offsetBy: lower + inner.count)
        }
        let wrapped = token + selected + token
        text.replaceSubrange(range, with: wrapped)
        return text.index(text.startIndex, offsetBy: lower)..<text.index(text.startIndex, offsetBy: lower + wrapped.count)
    }

    /// Trasforma in elenco puntato (o toglie l'elenco) le righe selezionate.
    static func toggleList(in text: inout String, range: Range<String.Index>?) {
        let anchor = range ?? text.endIndex..<text.endIndex
        let start = text[..<anchor.lowerBound].lastIndex(of: "\n").map { text.index(after: $0) } ?? text.startIndex
        let end = text[anchor.upperBound...].firstIndex(of: "\n") ?? text.endIndex
        let lines = text[start..<end].components(separatedBy: "\n")
        let allBullets = lines.allSatisfy { $0.hasPrefix("- ") }
        let changed = lines.map { allBullets ? String($0.dropFirst(2)) : ($0.hasPrefix("- ") ? $0 : "- " + $0) }
        text.replaceSubrange(start..<end, with: changed.joined(separator: "\n"))
    }
}
