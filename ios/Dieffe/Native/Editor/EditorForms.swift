import SwiftUI

/// Collegamento di un campo del preventivo: le modifiche vanno nel modello,
/// che le salva da solo.
@MainActor
func headerBinding<T>(_ editor: QuoteEditorModel, _ key: WritableKeyPath<QuoteDetail, T>, default value: T) -> Binding<T> {
    Binding(
        get: { editor.quote?[keyPath: key] ?? value },
        set: { newValue in editor.updateHeader { $0[keyPath: key] = newValue } }
    )
}

/// Testo facoltativo: stringa vuota ↔ nil.
@MainActor
func optionalText(_ binding: Binding<String?>) -> Binding<String> {
    Binding(get: { binding.wrappedValue ?? "" }, set: { binding.wrappedValue = $0.isEmpty ? nil : $0 })
}

/// Intestazione: titolo, cliente, cantiere, validità, IVA, note e pagamento.
struct HeaderEditView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let editor: QuoteEditorModel

    var body: some View {
        let quote = editor.quote
        NavigationStack {
            Form {
                Section("Titolo") {
                    TextField("Titolo", text: headerBinding(editor, \.title, default: ""), axis: .vertical)
                }
                if let code = quote?.code {
                    LabeledContent("Codice", value: code)
                        .monospaced()
                }

                Section("Cliente e cantiere") {
                    NavigationLink {
                        ClientPickerView(selection: Binding(
                            get: { quote?.client.map { ClientRef(id: $0.id, name: $0.name) } },
                            set: { ref in
                                editor.updateHeader {
                                    $0.clientId = ref?.id
                                    $0.client = ref.map { QuoteDetail.Party(id: $0.id, name: $0.name) }
                                }
                            }
                        ))
                    } label: {
                        LabeledContent("Cliente", value: quote?.client?.name ?? "Nessuno")
                    }
                    if quote?.client != nil {
                        Button("Togli il cliente", role: .destructive) {
                            editor.updateHeader { $0.clientId = nil; $0.client = nil }
                        }
                    }
                    TextField("Indirizzo del cantiere", text: optionalText(headerBinding(editor, \.projectAddress, default: nil)),
                              prompt: Text("Via e numero civico, città"), axis: .vertical)
                        .textContentType(.fullStreetAddress)
                }

                Section("Condizioni") {
                    Toggle("Data di validità", isOn: Binding(
                        get: { quote?.validUntil != nil },
                        set: { on in
                            editor.updateHeader {
                                $0.validUntil = on ? Self.isoDay(Calendar.current.date(byAdding: .day, value: 30, to: .now)!) : nil
                            }
                        }
                    ))
                    if let valid = quote?.validUntil {
                        DatePicker("Valido fino al", selection: Binding(
                            get: { Self.date(valid) ?? .now },
                            set: { day in editor.updateHeader { $0.validUntil = Self.isoDay(day) } }
                        ), displayedComponents: .date)
                    }
                    Picker("IVA", selection: headerBinding(editor, \.vatRate, default: 22)) {
                        ForEach(QuoteOptions.vatRates, id: \.0) { Text($0.1).tag($0.0) }
                    }
                }

                Section {
                    TextField("Condizioni di pagamento", text: optionalText(headerBinding(editor, \.paymentTerms, default: nil)),
                              prompt: Text("Es. 50% inizio lavori, 50% fine lavori"), axis: .vertical)
                        .lineLimit(2...6)
                    Menu("Usa un modello") {
                        ForEach(QuoteOptions.paymentTerms, id: \.self) { text in
                            Button(text) { editor.updateHeader { $0.paymentTerms = text } }
                        }
                    }
                } header: {
                    Text("Pagamento")
                }

                Section("Note generali") {
                    TextField("Note", text: optionalText(headerBinding(editor, \.notes, default: nil)),
                              prompt: Text("Note aggiuntive per il preventivo…"), axis: .vertical)
                        .lineLimit(3...10)
                }
            }
            .disabled(!editor.isEditable)
            .navigationTitle("Intestazione")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", systemImage: "checkmark") { dismiss() }
                }
            }
        }
    }

    static func isoDay(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    static func date(_ iso: String) -> Date? {
        let parts = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}

/// Sezione: titolo, descrizione, nota, opzionale, prezzo a corpo.
struct SectionEditView: View {
    @Environment(\.dismiss) private var dismiss
    let editor: QuoteEditorModel
    let sectionID: String

    private var section: QuoteSection? { editor.quote?.sections.first { $0.id == sectionID } }

    private func binding<T>(_ key: WritableKeyPath<QuoteSection, T>, _ fallback: T) -> Binding<T> {
        Binding(
            get: { section?[keyPath: key] ?? fallback },
            set: { value in editor.updateSection(sectionID) { $0[keyPath: key] = value } }
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Titolo") {
                    TextField("Titolo della sezione", text: binding(\.title, ""), axis: .vertical)
                    LabeledContent("Lettera", value: section?.code ?? "")
                }
                Section {
                    TextField("Descrizione", text: optionalText(binding(\.description, nil)),
                              prompt: Text("Descrizione della sezione (facoltativa)"), axis: .vertical)
                        .lineLimit(2...6)
                    TextField("Nota", text: optionalText(binding(\.sectionNote, nil)),
                              prompt: Text("Nota in fondo alla sezione (facoltativa)"), axis: .vertical)
                        .lineLimit(1...4)
                }
                Section {
                    Toggle("Prezzo a corpo", isOn: binding(\.lumpSum, false))
                    if section?.lumpSum == true {
                        LabeledContent("Prezzo a corpo") {
                            TextField("0,00", value: Binding(
                                get: { section?.lumpSumPrice ?? 0 },
                                set: { value in editor.updateSection(sectionID) { $0.lumpSumPrice = max(0, value) } }
                            ), format: .number.precision(.fractionLength(2)).locale(Locale(identifier: "it_IT")))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                        }
                    }
                } footer: {
                    Text("A corpo, il subtotale della sezione è questo prezzo: gli importi delle singole voci non si sommano.")
                }
                Section {
                    Toggle("Sezione opzionale", isOn: binding(\.isOptional, false))
                    if section?.isOptional == true {
                        Toggle("Inclusa nel totale", isOn: binding(\.isOptionalIncluded, false))
                    }
                } footer: {
                    Text("Le sezioni opzionali compaiono a parte nel preventivo e contano nel totale solo se incluse.")
                }
            }
            .disabled(!editor.isEditable)
            .navigationTitle("Sezione \(section?.code ?? "")")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", systemImage: "checkmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
    }
}
