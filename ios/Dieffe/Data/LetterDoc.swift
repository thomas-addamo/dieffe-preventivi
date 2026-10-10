import Foundation

/// Testo delle comunicazioni: sul sito è un documento Tiptap (JSON
/// ProseMirror, src/lib/communications.ts). Nell'app si modifica con lo stesso
/// "markdown leggero" delle voci (RichText): paragrafi, grassetto, corsivo,
/// sottolineato, barrato, elenchi. Le lettere con formattazione che qui non
/// esiste (colori, dimensioni, allineamenti, titoli, a capo forzati…) si
/// modificano dal sito, così non si perde nulla.
enum LetterDoc {
    private static let markTokens: [(String, String)] = [("bold", "**"), ("italic", "*"), ("underline", "__"), ("strike", "~~")]

    /// Vero se il documento si può modificare nell'app senza perdere formattazione.
    static func isEditableNatively(_ doc: [String: Any]) -> Bool {
        func attrsAreDefault(_ node: [String: Any]) -> Bool {
            guard let attrs = node["attrs"] as? [String: Any] else { return true }
            return attrs.allSatisfy { key, value in
                if value is NSNull { return true }
                if key == "textAlign", let v = value as? String { return v == "left" }
                if key == "start", let n = value as? Int { return node["type"] as? String == "orderedList" && n >= 1 }
                if key == "type", value is NSNull { return true }
                return false
            }
        }
        func inline(_ node: [String: Any]) -> Bool {
            guard node["type"] as? String == "text" else { return false }
            let marks = node["marks"] as? [[String: Any]] ?? []
            return marks.allSatisfy { mark in
                guard let type = mark["type"] as? String, markTokens.contains(where: { $0.0 == type }) else { return false }
                return attrsAreDefault(mark)
            }
        }
        func paragraph(_ node: [String: Any]) -> Bool {
            node["type"] as? String == "paragraph" && attrsAreDefault(node)
                && (node["content"] as? [[String: Any]] ?? []).allSatisfy(inline)
        }
        func list(_ node: [String: Any]) -> Bool {
            guard ["bulletList", "orderedList"].contains(node["type"] as? String ?? ""), attrsAreDefault(node) else { return false }
            return (node["content"] as? [[String: Any]] ?? []).allSatisfy { item in
                let children = item["content"] as? [[String: Any]] ?? []
                return item["type"] as? String == "listItem" && children.count == 1 && paragraph(children[0])
            }
        }
        guard doc["type"] as? String == "doc" else { return false }
        return (doc["content"] as? [[String: Any]] ?? []).allSatisfy { paragraph($0) || list($0) }
    }

    // MARK: Documento → testo

    static func toText(_ doc: [String: Any]) -> String {
        var lines: [String] = []
        for block in doc["content"] as? [[String: Any]] ?? [] {
            switch block["type"] as? String {
            case "paragraph":
                lines.append(inlineText(block))
            case "bulletList":
                for item in listItems(block) { lines.append("- " + inlineText(item)) }
            case "orderedList":
                let start = (block["attrs"] as? [String: Any])?["start"] as? Int ?? 1
                for (i, item) in listItems(block).enumerated() { lines.append("\(start + i). " + inlineText(item)) }
            default:
                break
            }
        }
        // Un documento vuoto ha un solo paragrafo vuoto.
        return lines == [""] ? "" : lines.joined(separator: "\n")
    }

    private static func listItems(_ list: [String: Any]) -> [[String: Any]] {
        (list["content"] as? [[String: Any]] ?? []).compactMap { ($0["content"] as? [[String: Any]])?.first }
    }

    private static func inlineText(_ paragraph: [String: Any]) -> String {
        (paragraph["content"] as? [[String: Any]] ?? []).map { node in
            var text = escape(node["text"] as? String ?? "")
            let types = Set((node["marks"] as? [[String: Any]] ?? []).compactMap { $0["type"] as? String })
            for (type, token) in markTokens.reversed() where types.contains(type) {
                text = token + text + token
            }
            return text
        }.joined()
    }

    private static func escape(_ text: String) -> String {
        var out = ""
        for ch in text {
            if "\\*_~".contains(ch) { out.append("\\") }
            out.append(ch)
        }
        return out
    }

    // MARK: Testo → documento

    static func toDoc(_ text: String) -> [String: Any] {
        var blocks: [[String: Any]] = []
        var bullet: [[String: Any]] = []
        var ordered: [[String: Any]] = []
        var orderedStart = 1

        func flush() {
            if !bullet.isEmpty { blocks.append(["type": "bulletList", "content": bullet]); bullet = [] }
            if !ordered.isEmpty {
                blocks.append(["type": "orderedList", "attrs": ["start": orderedStart], "content": ordered])
                ordered = []
            }
        }
        func listItem(_ line: Substring) -> [String: Any] {
            ["type": "listItem", "content": [paragraph(line)]]
        }

        for raw in text.components(separatedBy: "\n") {
            if let m = raw.wholeMatch(of: /\s*[-•]\s+(.*)/) {
                if !ordered.isEmpty { flush() }
                bullet.append(listItem(m.1))
            } else if let m = raw.wholeMatch(of: /\s*(\d{1,3})\.\s+(.*)/) {
                if !bullet.isEmpty { flush() }
                if ordered.isEmpty { orderedStart = Int(m.1) ?? 1 }
                ordered.append(listItem(m.2))
            } else {
                flush()
                blocks.append(paragraph(Substring(raw)))
            }
        }
        flush()
        if blocks.isEmpty { blocks = [["type": "paragraph"]] }
        return ["type": "doc", "content": blocks]
    }

    private static func paragraph(_ line: Substring) -> [String: Any] {
        let nodes = inlineNodes(line)
        return nodes.isEmpty ? ["type": "paragraph"] : ["type": "paragraph", "content": nodes]
    }

    /// Stessa lettura dei marcatori di RichText.inline, ma in nodi di testo.
    private static func inlineNodes(_ text: Substring) -> [[String: Any]] {
        var nodes: [[String: Any]] = []
        var active: [String] = []
        var buffer = ""

        func flush() {
            guard !buffer.isEmpty else { return }
            var node: [String: Any] = ["type": "text", "text": buffer]
            let ordered = markTokens.map(\.0).filter(active.contains)
            if !ordered.isEmpty { node["marks"] = ordered.map { ["type": $0] } }
            nodes.append(node)
            buffer = ""
        }

        let tokens: [(String, String)] = [("**", "bold"), ("__", "underline"), ("~~", "strike"), ("*", "italic")]
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
                let after = text.index(i, offsetBy: token.count)
                if active.contains(mark) || text[after...].contains(token) {
                    flush()
                    if let index = active.firstIndex(of: mark) { active.remove(at: index) } else { active.append(mark) }
                    i = after
                    continue scan
                }
            }
            buffer.append(ch)
            i = text.index(after: i)
        }
        flush()
        return nodes
    }
}
