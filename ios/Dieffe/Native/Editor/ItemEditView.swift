import PhotosUI
import SwiftUI

/// Scheda di una voce: descrizione formattata, quantità, unità, prezzo,
/// sconto, note, suggerimenti dell'AI e foto. Ogni modifica si salva da sola.
struct ItemEditView: View {
    @Environment(\.dismiss) private var dismiss
    let editor: QuoteEditorModel
    let itemID: String

    @State private var selection: TextSelection?
    @State private var aiWorking: AIAction?
    @State private var suggestion: PriceSuggestion?
    @State private var aiError: String?
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var uploading = 0
    @State private var confirmDelete = false
    @State private var customUnit = false
    @FocusState private var descriptionFocused: Bool

    private enum AIAction { case improve, price }

    private var item: QuoteItem? { editor.item(itemID) }
    private var editable: Bool { editor.isEditable }
    private static let italian = Locale(identifier: "it_IT")

    private func binding<T>(_ key: WritableKeyPath<QuoteItem, T>, _ fallback: T) -> Binding<T> {
        Binding(
            get: { item?[keyPath: key] ?? fallback },
            set: { value in editor.updateItem(itemID) { $0[keyPath: key] = value } }
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                if let item {
                    descriptionSection
                    aiSection(item)
                    amountSection(item)
                    Section("Note della voce") {
                        TextField("Note", text: optionalText(binding(\.notes, nil)),
                                  prompt: Text("Note interne o per il cliente (facoltative)"), axis: .vertical)
                            .lineLimit(1...5)
                    }
                    photoSection(item)
                    if editable {
                        Section {
                            Button("Elimina voce", systemImage: "trash", role: .destructive) { confirmDelete = true }
                        }
                    }
                } else {
                    ContentUnavailableView("Voce eliminata", systemImage: "trash")
                }
            }
            .disabled(!editable && aiWorking == nil)
            .navigationTitle("Voce")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", systemImage: "checkmark") { dismiss() }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    if descriptionFocused { formatBar }
                }
            }
            .confirmationDialog("Eliminare questa voce?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Elimina voce", role: .destructive) {
                    dismiss()
                    Task { await editor.deleteItem(itemID) }
                }
            }
            .onChange(of: photoItems) { _, items in upload(items) }
        }
        .onAppear {
            if let item {
                customUnit = !QuoteOptions.units.contains(item.unitOfMeasure)
                if item.description.isEmpty && editable { descriptionFocused = true }
            }
        }
    }

    // MARK: Descrizione

    private var descriptionSection: some View {
        Section {
            TextEditor(text: binding(\.description, ""), selection: $selection)
                .focused($descriptionFocused)
                .frame(minHeight: 110)
                .font(.body)
            if let text = item?.description, text.contains(where: { "*_~-".contains($0) }) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Anteprima")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(RichText.attributed(text))
                        .font(.subheadline)
                }
            }
        } header: {
            Text("Descrizione")
        } footer: {
            Text("Seleziona del testo e usa la barra sopra la tastiera per grassetto, corsivo, sottolineato, barrato ed elenchi.")
        }
    }

    private var formatBar: some View {
        HStack(spacing: 18) {
            ForEach(RichText.Style.allCases) { style in
                Button(style.label, systemImage: style.symbol) { apply(style) }
                    .labelStyle(.iconOnly)
            }
            Button("Elenco", systemImage: "list.bullet") { applyList() }
                .labelStyle(.iconOnly)
            Spacer()
            Button("Fine", systemImage: "keyboard.chevron.compact.down") { descriptionFocused = false }
                .labelStyle(.iconOnly)
        }
    }

    private func selectedRange(in text: String) -> Range<String.Index>? {
        guard case .selection(let range) = selection?.indices else { return nil }
        guard range.lowerBound >= text.startIndex, range.upperBound <= text.endIndex else { return nil }
        return range
    }

    private func apply(_ style: RichText.Style) {
        guard var text = item?.description else { return }
        let range = selectedRange(in: text)
        let newRange = RichText.toggle(style, in: &text, range: range)
        editor.updateItem(itemID) { $0.description = text }
        if let newRange { selection = TextSelection(range: newRange) }
    }

    private func applyList() {
        guard var text = item?.description else { return }
        RichText.toggleList(in: &text, range: selectedRange(in: text))
        editor.updateItem(itemID) { $0.description = text }
        selection = nil
    }

    // MARK: AI

    @ViewBuilder
    private func aiSection(_ item: QuoteItem) -> some View {
        let plain = RichText.plain(item.description).trimmingCharacters(in: .whitespacesAndNewlines)
        if editable && plain.count >= 3 {
            Section {
                HStack {
                    Button {
                        improve(plain)
                    } label: {
                        Label("Migliora testo", systemImage: "wand.and.stars")
                    }
                    Spacer()
                    Button {
                        suggestPrice(plain)
                    } label: {
                        Label("Suggerisci prezzo", systemImage: "eurosign.circle")
                    }
                }
                .buttonStyle(.borderless)
                .disabled(aiWorking != nil)
                .overlay {
                    if aiWorking != nil { ProgressView() }
                }

                if let suggestion {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("\(Format.currency(suggestion.unitPrice)) / \(suggestion.unitOfMeasure)")
                                .font(.headline)
                                .monospacedDigit()
                            Spacer()
                            Text(suggestion.priceSource.capitalized)
                                .font(.caption2.weight(.semibold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(.purple.opacity(0.14), in: Capsule())
                                .foregroundStyle(.purple)
                        }
                        Text(suggestion.reasoning)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        HStack {
                            Button("Applica prezzo") { applySuggestion(suggestion, text: false) }
                            Spacer()
                            Button("Prezzo e testo") { applySuggestion(suggestion, text: true) }
                        }
                        .buttonStyle(.borderless)
                        .font(.subheadline.weight(.semibold))
                    }
                }
                if let aiError {
                    Label(aiError, systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            } header: {
                Label("Assistente AI", systemImage: "sparkles")
            }
        }
    }

    private func improve(_ text: String) {
        aiWorking = .improve
        aiError = nil
        Task {
            defer { aiWorking = nil }
            struct Response: Decodable { let improvedDescription: String }
            do {
                let r: Response = try await APIClient.shared.send("POST", "/api/ai/improve-description", json: ["description": text])
                editor.updateItem(itemID) { $0.description = r.improvedDescription }
            } catch {
                aiError = error.localizedDescription
            }
        }
    }

    private func suggestPrice(_ text: String) {
        aiWorking = .price
        aiError = nil
        Task {
            defer { aiWorking = nil }
            struct Response: Decodable { let suggestion: PriceSuggestion? }
            do {
                let r: Response = try await APIClient.shared.send("POST", "/api/ai/suggest-price", json: ["description": text])
                suggestion = r.suggestion
                if r.suggestion == nil { aiError = "Nessun suggerimento disponibile per questa descrizione." }
            } catch {
                aiError = error.localizedDescription
            }
        }
    }

    private func applySuggestion(_ s: PriceSuggestion, text: Bool) {
        editor.updateItem(itemID) {
            $0.unitPrice = s.unitPrice
            $0.unitOfMeasure = s.unitOfMeasure
            if let q = s.suggestedQuantity, q > 0, $0.quantity <= 1 { $0.quantity = q }
            if text { $0.description = s.improvedDescription }
        }
        customUnit = !QuoteOptions.units.contains(s.unitOfMeasure)
        suggestion = nil
    }

    // MARK: Importi

    private func amountSection(_ item: QuoteItem) -> some View {
        Section {
            LabeledContent("Quantità") {
                TextField("1", value: binding(\.quantity, 1), format: .number.locale(Self.italian))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
            }
            if customUnit {
                LabeledContent("Unità") {
                    TextField("es. cad", text: binding(\.unitOfMeasure, "n°"))
                        .multilineTextAlignment(.trailing)
                        .textInputAutocapitalization(.never)
                }
            }
            Picker("Unità di misura", selection: Binding(
                get: { customUnit ? "__altro" : item.unitOfMeasure },
                set: { value in
                    if value == "__altro" {
                        customUnit = true
                    } else {
                        customUnit = false
                        editor.updateItem(itemID) { $0.unitOfMeasure = value }
                    }
                }
            )) {
                ForEach(QuoteOptions.units, id: \.self) { Text($0).tag($0) }
                Text("Altra…").tag("__altro")
            }
            LabeledContent("Prezzo unitario") {
                TextField("0,00", value: binding(\.unitPrice, 0),
                          format: .number.precision(.fractionLength(2)).locale(Self.italian))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
            }
            LabeledContent("Sconto %") {
                TextField("0", value: Binding(
                    get: { item.discount },
                    set: { value in editor.updateItem(itemID) { $0.discount = min(100, max(0, value)) } }
                ), format: .number.locale(Self.italian))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
            }
            LabeledContent("Totale voce") {
                Text(Format.currency(item.total))
                    .fontWeight(.semibold)
                    .monospacedDigit()
                    .foregroundStyle(Color.primary)
            }
        } header: {
            Text("Importi")
        } footer: {
            if editor.sectionID(ofItem: itemID).flatMap({ id in editor.quote?.sections.first { $0.id == id } })?.lumpSum == true {
                Text("La sezione è a corpo: il totale della voce non si somma.")
            }
        }
    }

    // MARK: Foto

    private func photoSection(_ item: QuoteItem) -> some View {
        Section {
            if !item.images.isEmpty {
                ScrollView(.horizontal) {
                    HStack(spacing: 10) {
                        ForEach(item.images) { image in
                            AsyncImage(url: URL(string: image.cloudinaryUrl)) { phase in
                                if let img = phase.image {
                                    img.resizable().scaledToFill()
                                } else {
                                    Rectangle().fill(.quaternary).overlay { ProgressView() }
                                }
                            }
                            .frame(width: 96, height: 96)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .contextMenu {
                                if editable {
                                    Button("Elimina foto", systemImage: "trash", role: .destructive) {
                                        Task { await editor.deleteImage(image.id, from: itemID) }
                                    }
                                }
                            }
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
            if editable {
                PhotosPicker(selection: $photoItems, maxSelectionCount: 6, matching: .images) {
                    if uploading > 0 {
                        HStack { ProgressView(); Text("Caricamento di \(uploading) foto…") }
                    } else {
                        Label("Aggiungi foto", systemImage: "photo.badge.plus")
                    }
                }
                .disabled(uploading > 0)
            }
        } header: {
            Text("Foto")
        } footer: {
            if !item.images.isEmpty && editable { Text("Tieni premuta una foto per eliminarla.") }
        }
    }

    private func upload(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        photoItems = []
        uploading = items.count
        Task {
            for pick in items {
                defer { uploading -= 1 }
                guard let data = try? await pick.loadTransferable(type: Data.self),
                      let jpeg = UIImage(data: data)?.resizedForUpload().jpegData(compressionQuality: 0.8) else { continue }
                await editor.addImage(to: itemID, data: jpeg)
            }
        }
    }
}

private extension UIImage {
    /// Il sito accetta al massimo 5 MB: 2400 px sul lato lungo bastano per il PDF.
    func resizedForUpload(maxSide: CGFloat = 2400) -> UIImage {
        let longest = max(size.width, size.height)
        guard longest > maxSide else { return self }
        let scale = maxSide / longest
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in draw(in: CGRect(origin: .zero, size: target)) }
    }
}
