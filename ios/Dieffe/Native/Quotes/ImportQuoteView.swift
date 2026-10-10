import SwiftUI
import UniformTypeIdentifiers

/// Importa un preventivo da file (PDF, Word, Excel, CSV, testo): il sito lo
/// analizza con l'AI (POST /api/quotes/import), qui si controlla e si crea.
/// Stesso flusso di src/components/quote-editor/ImportQuoteModal.tsx.
struct ImportQuoteView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    private enum Step { case pick, analyzing(String), preview }

    @State private var step: Step = .pick
    @State private var showPicker = false
    @State private var result: ImportResult?
    @State private var title = ""
    @State private var clientMode: ImportResult.ClientMode = .none
    @State private var creating = false
    @State private var error: String?

    private static let maxSize = 8 * 1024 * 1024
    private static let types: [UTType] = [
        .pdf, .commaSeparatedText, .plainText,
        UTType("org.openxmlformats.wordprocessingml.document"),
        UTType("org.openxmlformats.spreadsheetml.sheet"),
        UTType("com.microsoft.excel.xls"),
    ].compactMap { $0 }

    var body: some View {
        NavigationStack {
            Group {
                switch step {
                case .pick: pick
                case .analyzing(let name): analyzing(name)
                case .preview: if let result { preview(result) }
                }
            }
            .navigationTitle("Importa da file")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", systemImage: "xmark") { dismiss() }
                        .disabled(isBusy)
                }
                if case .preview = step {
                    ToolbarItem(placement: .confirmationAction) {
                        if creating {
                            ProgressView()
                        } else {
                            Button("Crea", systemImage: "checkmark") { create() }
                        }
                    }
                }
            }
            .interactiveDismissDisabled(isBusy)
            .fileImporter(isPresented: $showPicker, allowedContentTypes: Self.types) { picked in
                if case .success(let url) = picked { analyze(url) }
            }
        }
    }

    private var isBusy: Bool {
        if case .analyzing = step { return true }
        return creating
    }

    // MARK: Passi

    private var pick: some View {
        ContentUnavailableView {
            Label("Importa un preventivo", systemImage: "doc.viewfinder")
        } description: {
            Text("PDF, Word, Excel, CSV o testo, fino a 8 MB. L'AI riconosce sezioni, voci, prezzi e cliente; prima di creare puoi controllare tutto.")
            if let error {
                Text(error).foregroundStyle(.red)
            }
        } actions: {
            Button("Scegli file", systemImage: "folder") { showPicker = true }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
        }
    }

    private func analyzing(_ name: String) -> some View {
        VStack(spacing: 16) {
            ProgressView()
                .controlSize(.large)
            Text("Analisi di \(name)")
                .font(.headline)
                .multilineTextAlignment(.center)
            Text("Può richiedere fino a un minuto.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func preview(_ result: ImportResult) -> some View {
        Form {
            Section("Titolo") {
                TextField("Titolo", text: $title, axis: .vertical)
            }

            Section {
                Picker("Cliente", selection: $clientMode) {
                    if let matched = result.matchedClient {
                        Text("Esistente: \(matched.name)").tag(ImportResult.ClientMode.existing)
                    }
                    if let name = result.clientName {
                        Text("Nuovo: \(name)").tag(ImportResult.ClientMode.new)
                    }
                    Text("Nessun cliente").tag(ImportResult.ClientMode.none)
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } header: {
                Text("Cliente")
            } footer: {
                if result.matchedClient != nil {
                    Text("Il cliente del documento corrisponde a uno già in archivio.")
                }
            }

            if let address = result.projectAddress {
                Section("Cantiere") { Text(address) }
            }

            Section {
                ForEach(result.sections) { section in
                    LabeledContent {
                        Text(Format.currency(section.subtotal)).monospacedDigit()
                    } label: {
                        Text(section.title)
                        Text(Format.count(section.itemCount, "voce", "voci") + (section.isLumpSum ? " · a corpo" : ""))
                    }
                }
            } header: {
                Text(Format.count(result.sections.count, "sezione", "sezioni") + ", " + Format.count(result.itemCount, "voce", "voci"))
            }

            Section("Totali") {
                LabeledContent("Imponibile") { Text(Format.currency(result.subtotal)).monospacedDigit() }
                LabeledContent("IVA \(result.vatRate.formatted())%") { Text(Format.currency(result.vatAmount)).monospacedDigit() }
                LabeledContent("Totale") {
                    Text(Format.currency(result.subtotal + result.vatAmount))
                        .monospacedDigit()
                        .fontWeight(.semibold)
                }
                if result.totalMismatch {
                    Label("Il totale indicato nel documento non coincide: controlla le voci nell'editor dopo l'importazione.",
                          systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            }

            if let error {
                Section {
                    Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red)
                }
            }
        }
    }

    // MARK: Azioni

    private func analyze(_ url: URL) {
        error = nil
        let access = url.startAccessingSecurityScopedResource()
        // Copia temporanea: il file scelto resta accessibile solo durante l'accesso.
        let copy = FileManager.default.temporaryDirectory.appendingPathComponent(url.lastPathComponent)
        try? FileManager.default.removeItem(at: copy)
        let copied = (try? FileManager.default.copyItem(at: url, to: copy)) != nil
        if access { url.stopAccessingSecurityScopedResource() }

        guard copied else {
            error = "Impossibile leggere il file."
            return
        }
        let size = (try? copy.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard size <= Self.maxSize else {
            error = "File troppo grande (massimo 8 MB)."
            return
        }

        step = .analyzing(url.lastPathComponent)
        let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        Task {
            defer { try? FileManager.default.removeItem(at: copy) }
            do {
                let json = try await APIClient.shared.upload("/api/quotes/import", file: copy, mimeType: mime)
                guard let parsed = ImportResult(json) else { throw APIError.server("Risposta non valida dal server.") }
                result = parsed
                title = parsed.title
                clientMode = parsed.defaultClientMode
                step = .preview
            } catch {
                self.error = error.localizedDescription
                step = .pick
            }
        }
    }

    private func create() {
        guard let result else { return }
        creating = true
        error = nil
        Task {
            defer { creating = false }
            do {
                let response = try await APIClient.shared.sendRaw("POST", "/api/quotes/import",
                                                                  json: result.createBody(title: title, clientMode: clientMode))
                guard let id = response["id"] as? String else { throw APIError.server("Risposta non valida dal server.") }
                model.quoteToOpen = id
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

/// Risultato dell'analisi: i dati restano JSON grezzo per rimandarli al server
/// tali e quali; qui se ne ricava solo il riepilogo da mostrare.
struct ImportResult {
    enum ClientMode: String { case existing, new, none }

    struct Section: Identifiable {
        let id: Int
        let title: String
        let itemCount: Int
        let subtotal: Double
        let isLumpSum: Bool
    }

    let parsed: [String: Any]
    let matchedClient: ClientRef?
    let title: String
    let clientName: String?
    let projectAddress: String?
    let sections: [Section]
    let vatRate: Double
    let totalMismatch: Bool

    var subtotal: Double { sections.reduce(0) { $0 + $1.subtotal } }
    var vatAmount: Double { subtotal * vatRate / 100 }
    var itemCount: Int { sections.reduce(0) { $0 + $1.itemCount } }

    var defaultClientMode: ClientMode {
        matchedClient != nil ? .existing : clientName != nil ? .new : .none
    }

    init?(_ json: [String: Any]) {
        guard let parsed = json["parsed"] as? [String: Any] else { return nil }
        self.parsed = parsed
        if let m = json["matchedClient"] as? [String: Any], let id = m["id"] as? String, let name = m["name"] as? String {
            matchedClient = ClientRef(id: id, name: name)
        } else {
            matchedClient = nil
        }
        title = parsed["title"] as? String ?? "Preventivo importato"
        clientName = (parsed["client"] as? [String: Any])?["name"] as? String
        projectAddress = parsed["projectAddress"] as? String
        vatRate = Self.number(parsed["vatRate"]) ?? 22

        let rawSections = parsed["sections"] as? [[String: Any]] ?? []
        sections = rawSections.enumerated().map { index, s in
            let items = s["items"] as? [[String: Any]] ?? []
            let lumpSum = Self.number(s["lumpSumPrice"]).flatMap { $0 > 0 ? $0 : nil }
            let sum = items.reduce(0.0) { acc, i in
                let qty = Self.number(i["quantity"]) ?? 0
                let price = Self.number(i["unitPrice"]) ?? 0
                let discount = Self.number(i["discount"]) ?? 0
                return acc + qty * price * (1 - discount / 100)
            }
            return Section(id: index, title: s["title"] as? String ?? "Sezione \(index + 1)",
                           itemCount: items.count, subtotal: lumpSum ?? sum, isLumpSum: lumpSum != nil)
        }

        // Il totale dichiarato può essere imponibile o IVA inclusa: segnala solo
        // se non combacia con nessuno dei due (tolleranza 2%), come sul sito.
        let subtotal = sections.reduce(0) { $0 + $1.subtotal }
        let total = subtotal * (1 + vatRate / 100)
        let declared = [Self.number(parsed["declaredTotal"]), Self.number(parsed["declaredSubtotal"])]
            .compactMap { $0 }.filter { $0 > 0 }
        totalMismatch = !declared.isEmpty && declared.allSatisfy {
            abs($0 - total) / $0 > 0.02 && abs($0 - subtotal) / $0 > 0.02
        }
    }

    func createBody(title: String, clientMode: ClientMode) -> [String: Any] {
        var body: [String: Any] = [
            "title": title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? self.title : title,
            "clientMode": clientMode.rawValue,
            "sections": parsed["sections"] ?? [],
        ]
        if clientMode == .existing, let id = matchedClient?.id { body["clientId"] = id }
        if clientMode == .new, let client = parsed["client"] { body["client"] = client }
        for key in ["projectAddress", "notes", "paymentTerms", "validUntil"] {
            if let value = parsed[key], !(value is NSNull) { body[key] = value }
        }
        if let vat = Self.number(parsed["vatRate"]) { body["vatRate"] = vat }
        return body
    }

    private static func number(_ value: Any?) -> Double? {
        (value as? NSNumber)?.doubleValue
    }
}
