import SwiftUI

/// Editor nativo del preventivo: intestazione, sezioni con le loro voci,
/// totali e azioni (stato, PDF, link per il cliente, lavori extra, cestino).
struct QuoteEditorView: View {
    @Environment(AppModel.self) private var model
    @State private var editor: QuoteEditorModel
    @State private var editingItem: String?
    @State private var editingSection: String?
    @State private var addingFromList: String?
    @State private var showHeader = false
    @State private var showLink = false
    @State private var confirmTrash = false
    @State private var pendingDeleteSection: QuoteSection?
    @State private var working = false
    @State private var reordering = false
    @State private var orderingSections = false

    init(quoteID: String) {
        _editor = State(initialValue: QuoteEditorModel(quoteID: quoteID))
    }

    var body: some View {
        NavigationStack {
            Group {
                if let quote = editor.quote {
                    content(quote)
                } else if let error = editor.loadError {
                    ContentUnavailableView {
                        Label("Impossibile aprire il preventivo", systemImage: "doc.questionmark")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Riprova") { Task { await editor.load() } }
                            .buttonStyle(.glassProminent)
                    }
                } else {
                    ProgressView().controlSize(.large)
                }
            }
            .toolbar { toolbar }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            editor.canEdit = model.canEdit
            editor.role = model.currentUser?.role ?? "viewer"
            await editor.load()
        }
        .onChange(of: model.canEdit) { _, value in editor.canEdit = value }
        .sheet(item: Binding(get: { editingItem.map(IDBox.init) }, set: { editingItem = $0?.id })) { box in
            ItemEditView(editor: editor, itemID: box.id)
        }
        .sheet(item: Binding(get: { editingSection.map(IDBox.init) }, set: { editingSection = $0?.id })) { box in
            SectionEditView(editor: editor, sectionID: box.id)
        }
        .sheet(item: Binding(get: { addingFromList.map(IDBox.init) }, set: { addingFromList = $0?.id })) { box in
            PriceListPicker { picked in
                Task {
                    if let id = await editor.addItem(to: box.id, from: picked) { editingItem = id }
                }
            }
        }
        .sheet(isPresented: $showHeader) {
            HeaderEditView(editor: editor)
        }
        .sheet(isPresented: $showLink) {
            PublicLinkView(editor: editor)
        }
        .sheet(isPresented: $orderingSections) {
            SectionsOrderView(editor: editor)
        }
        .confirmationDialog("Spostare il preventivo nel cestino?", isPresented: $confirmTrash, titleVisibility: .visible) {
            Button("Sposta nel cestino", role: .destructive) { trash() }
        } message: {
            Text("Si può recuperare da Altro › Cestino.")
        }
        .confirmationDialog(
            "Eliminare la sezione \(pendingDeleteSection?.code ?? "")?",
            isPresented: Binding(get: { pendingDeleteSection != nil }, set: { if !$0 { pendingDeleteSection = nil } }),
            titleVisibility: .visible,
            presenting: pendingDeleteSection
        ) { section in
            Button("Elimina sezione e voci", role: .destructive) { Task { await editor.deleteSection(section.id) } }
        } message: { section in
            Text(section.items.isEmpty ? "La sezione è vuota." : "Verranno eliminate anche \(Format.count(section.items.count, "voce", "voci")).")
        }
    }

    // MARK: Contenuto

    private func content(_ quote: QuoteDetail) -> some View {
        let totals = quote.totals
        return List {
            banners(quote)

            Section {
                Button { showHeader = true } label: {
                    HeaderSummary(quote: quote)
                }
                .tint(.primary)
            }

            ForEach(quote.sections) { section in
                sectionView(section)
            }

            if editor.isEditable {
                Section {
                    Button("Aggiungi sezione", systemImage: "rectangle.stack.badge.plus") {
                        Task { _ = await editor.addSection(optional: false) }
                    }
                    Button("Aggiungi sezione opzionale", systemImage: "rectangle.dashed.badge.record") {
                        Task { _ = await editor.addSection(optional: true) }
                    }
                }
            }

            TotalsSection(editor: editor, quote: quote, totals: totals)
        }
        .listStyle(.insetGrouped)
        .environment(\.editMode, .constant(reordering ? .active : .inactive))
        .refreshable { await editor.flush(); await editor.load() }
        .safeAreaInset(edge: .bottom) {
            TotalBar(total: totals.total, taxable: totals.taxable, state: editor.saveState)
        }
        .navigationTitle(quote.code)
        .navigationSubtitle(quote.title)
    }

    @ViewBuilder
    private func banners(_ quote: QuoteDetail) -> some View {
        if quote.isLocked {
            Section {
                Label(editor.role == "admin"
                      ? "Preventivo bloccato: solo gli amministratori possono modificarlo."
                      : "Preventivo bloccato dall'amministratore: puoi solo consultarlo.",
                      systemImage: "lock.fill")
                    .font(.subheadline)
                    .foregroundStyle(.orange)
            }
        } else if !editor.canEdit {
            Section {
                Label("Il tuo profilo può consultare i preventivi ma non modificarli.", systemImage: "eye")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        if quote.isExtra || !editor.extras.isEmpty {
            Section {
                if quote.isExtra, let parent = quote.parentQuoteId {
                    Button {
                        open(parent)
                    } label: {
                        Label("Lavoro extra del preventivo principale", systemImage: "arrow.turn.left.up")
                    }
                }
                ForEach(editor.extras.filter { $0.id != quote.id }) { extra in
                    Button { open(extra.id) } label: {
                        HStack {
                            Label {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(extra.code).font(.caption.monospaced().weight(.semibold))
                                    Text(extra.title).font(.subheadline).foregroundStyle(Color.primary).lineLimit(1)
                                }
                            } icon: {
                                Image(systemName: "doc.badge.plus").foregroundStyle(.orange)
                            }
                            Spacer()
                            StatusBadge(status: extra.status)
                        }
                    }
                }
            } header: {
                Text("Lavori extra")
            }
        }
    }

    private func sectionView(_ section: QuoteSection) -> some View {
        Section {
            if let description = section.description.nonEmpty {
                Text(description)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if section.isOptional {
                Toggle("Inclusa nel totale", isOn: Binding(
                    get: { section.isOptionalIncluded },
                    set: { value in editor.updateSection(section.id) { $0.isOptionalIncluded = value } }
                ))
                .disabled(!editor.isEditable)
            }
            ForEach(section.items) { item in
                Button { editingItem = item.id } label: {
                    ItemRow(item: item, lumpSum: section.lumpSum)
                }
                .tint(.primary)
                .swipeActions(edge: .trailing) {
                    if editor.isEditable {
                        Button("Elimina", systemImage: "trash", role: .destructive) {
                            Task { await editor.deleteItem(item.id) }
                        }
                        Button("Duplica", systemImage: "plus.square.on.square") {
                            Task { await editor.duplicateItem(item.id) }
                        }
                        .tint(.indigo)
                    }
                }
                .contextMenu {
                    if editor.isEditable {
                        Button("Modifica", systemImage: "pencil") { editingItem = item.id }
                        Button("Duplica", systemImage: "plus.square.on.square") { Task { await editor.duplicateItem(item.id) } }
                        Button("Elimina", systemImage: "trash", role: .destructive) { Task { await editor.deleteItem(item.id) } }
                    }
                }
            }
            .onMove(perform: editor.isEditable ? { editor.moveItems(in: section.id, from: $0, to: $1) } : nil)

            if editor.isEditable {
                HStack {
                    Button("Voce", systemImage: "plus.circle.fill") {
                        Task { if let id = await editor.addItem(to: section.id) { editingItem = id } }
                    }
                    Spacer()
                    Button("Dal listino", systemImage: "list.bullet.rectangle") { addingFromList = section.id }
                }
                .buttonStyle(.borderless)
                .font(.subheadline.weight(.medium))
            }
            if let note = section.sectionNote.nonEmpty {
                Label(note, systemImage: "note.text")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        } header: {
            SectionHeader(section: section, editable: editor.isEditable,
                          edit: { editingSection = section.id },
                          delete: { pendingDeleteSection = section })
        }
    }

    // MARK: Barra

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Chiudi", systemImage: "chevron.down") { close() }
        }
        if reordering {
            ToolbarItem(placement: .confirmationAction) {
                Button("Fine", systemImage: "checkmark") { withAnimation { reordering = false } }
            }
        } else if let quote = editor.quote {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Picker("Stato", selection: Binding(
                        get: { quote.status },
                        set: { status in Task { await editor.setStatus(status) } }
                    )) {
                        ForEach(QuoteStatus.allCases) { Label($0.label, systemImage: $0.symbol).tag($0) }
                    }
                } label: {
                    StatusBadge(status: quote.status)
                }
                .disabled(!editor.isEditable)
            }
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Section("Condividi") {
                        Button("PDF", systemImage: "doc.richtext") { export("pdf") }
                        Button("Link per il cliente", systemImage: "link") { showLink = true }
                            .disabled(!editor.canEdit && !quote.publicLinkActive)
                        Button("Excel", systemImage: "tablecells") { export("excel") }
                        Button("CSV", systemImage: "doc.plaintext") { export("csv") }
                    }
                    if editor.canEdit {
                        Section {
                            if editor.isEditable {
                                Button("Riordina le voci", systemImage: "arrow.up.arrow.down") {
                                    withAnimation { reordering = true }
                                }
                                if quote.sections.count > 1 {
                                    Button("Ordine delle sezioni", systemImage: "list.number") { orderingSections = true }
                                }
                            }
                            if !quote.isExtra {
                                Button("Nuovo lavoro extra", systemImage: "doc.badge.plus") { createExtra() }
                            }
                            if editor.role == "admin" {
                                Button(quote.isLocked ? "Sblocca modifiche" : "Blocca modifiche",
                                       systemImage: quote.isLocked ? "lock.open" : "lock") {
                                    Task { await editor.setLocked(!quote.isLocked) }
                                }
                            }
                        }
                    }
                    Section {
                        Button("Apri nel sito", systemImage: "safari") { openWeb() }
                        if editor.isEditable {
                            Button("Sposta nel cestino", systemImage: "trash", role: .destructive) { confirmTrash = true }
                        }
                    }
                } label: {
                    if working { ProgressView() } else { Label("Azioni", systemImage: "ellipsis") }
                }
            }
        }
    }

    // MARK: Azioni

    private func close() {
        Task {
            await editor.flush()
            model.closeEditor()
        }
    }

    private func open(_ id: String) {
        Task {
            await editor.flush()
            model.openQuote(id)
        }
    }

    private func openWeb() {
        Task {
            await editor.flush()
            model.openWebEditor(editor.quoteID)
        }
    }

    private func export(_ format: String) {
        working = true
        Task {
            defer { working = false }
            if let url = await editor.exportFile(format) { model.previewURL = url }
        }
    }

    private func createExtra() {
        working = true
        Task {
            defer { working = false }
            if let id = await editor.createExtra() {
                model.dataChanged()
                model.openQuote(id)
            }
        }
    }

    private func trash() {
        Task {
            if await editor.trash() {
                model.closeEditor()
            }
        }
    }
}

/// Ordine delle sezioni, trascinando le maniglie.
private struct SectionsOrderView: View {
    let editor: QuoteEditorModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(editor.quote?.sections ?? []) { section in
                    HStack(spacing: 10) {
                        Text(section.code)
                            .font(.caption.weight(.bold).monospaced())
                            .foregroundStyle(.secondary)
                        Text(section.title)
                        Spacer()
                        Text(Format.currency(section.total))
                            .font(.subheadline)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                }
                .onMove { editor.moveSections(from: $0, to: $1) }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Ordine delle sezioni")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", systemImage: "checkmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

struct IDBox: Identifiable {
    let id: String
}

// MARK: - Parti

private struct HeaderSummary: View {
    let quote: QuoteDetail

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(quote.title)
                .font(.title3.weight(.bold))
                .multilineTextAlignment(.leading)
            VStack(alignment: .leading, spacing: 6) {
                detail("person", quote.client?.name ?? "Nessun cliente")
                if let address = quote.projectAddress.nonEmpty { detail("mappin.and.ellipse", address) }
                HStack(spacing: 14) {
                    detail("percent", "IVA \(quote.vatRate.formatted())%")
                    if let valid = quote.validUntil.nonEmpty { detail("calendar", "Valido fino al \(Format.date(valid))") }
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            Text("Modifica intestazione")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Color.accentColor)
        }
        .padding(.vertical, 4)
    }

    private func detail(_ symbol: String, _ text: String) -> some View {
        Label(text, systemImage: symbol)
            .labelStyle(.titleAndIcon)
            .lineLimit(2)
    }
}

private struct SectionHeader: View {
    let section: QuoteSection
    let editable: Bool
    let edit: () -> Void
    let delete: () -> Void

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(section.code)
                .font(.caption.weight(.bold).monospaced())
                .foregroundStyle(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(section.isOptional ? Color.orange : Color.accentColor, in: RoundedRectangle(cornerRadius: 5))
            VStack(alignment: .leading, spacing: 1) {
                Text(section.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.primary)
                    .textCase(nil)
                if section.isOptional || section.lumpSum {
                    Text([section.isOptional ? "Opzionale" : nil, section.lumpSum ? "A corpo" : nil]
                        .compactMap { $0 }.joined(separator: " · "))
                        .font(.caption2)
                        .textCase(nil)
                }
            }
            Spacer()
            Text(Format.currency(section.total))
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(Color.primary)
            if editable {
                Menu {
                    Button("Modifica sezione", systemImage: "pencil", action: edit)
                    Button("Elimina sezione", systemImage: "trash", role: .destructive, action: delete)
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.body)
                }
            }
        }
    }
}

private struct ItemRow: View {
    let item: QuoteItem
    let lumpSum: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if item.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text("Voce senza descrizione")
                    .italic()
                    .foregroundStyle(.secondary)
            } else {
                Text(RichText.attributed(item.description))
                    .font(.subheadline)
                    .lineLimit(4)
                    .multilineTextAlignment(.leading)
            }
            HStack(spacing: 6) {
                Text("\(item.quantity.formatted(.number.locale(Locale(identifier: "it_IT")))) \(item.unitOfMeasure) × \(Format.currency(item.unitPrice))")
                if item.discount > 0 {
                    Text("−\(item.discount.formatted())%")
                        .foregroundStyle(.green)
                }
                if !item.images.isEmpty {
                    Label("\(item.images.count)", systemImage: "photo")
                        .labelStyle(.titleAndIcon)
                }
                Spacer()
                Text(Format.currency(item.total))
                    .fontWeight(.semibold)
                    .foregroundStyle(lumpSum ? .secondary : .primary)
                    .strikethrough(lumpSum)
            }
            .font(.caption)
            .monospacedDigit()
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

private struct TotalsSection: View {
    let editor: QuoteEditorModel
    let quote: QuoteDetail
    let totals: QuoteTotals

    var body: some View {
        Section("Riepilogo") {
            row("Subtotale lavori", totals.baseSubtotal)
            if totals.optionalIncluded > 0 { row("Opzionali inclusi", totals.optionalIncluded) }
            Picker("Sconto", selection: Binding(
                get: { quote.discountType },
                set: { type in editor.updateHeader { $0.discountType = type; if type == nil { $0.discountValue = nil } } }
            )) {
                Text("Nessuno").tag(DiscountType?.none)
                ForEach(DiscountType.allCases) { Text($0.label).tag(Optional($0)) }
            }
            .disabled(!editor.isEditable)
            if let type = quote.discountType {
                LabeledContent(type == .percent ? "Sconto %" : "Sconto €") {
                    TextField("0", value: Binding(
                        get: { quote.discountValue ?? 0 },
                        set: { value in editor.updateHeader { $0.discountValue = max(0, value) } }
                    ), format: .number.locale(Locale(identifier: "it_IT")))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .disabled(!editor.isEditable)
                }
                row("Sconto", -totals.discountAmount)
            }
            row("Imponibile", totals.taxable, bold: true)
            Picker("IVA", selection: Binding(
                get: { quote.vatRate },
                set: { rate in editor.updateHeader { $0.vatRate = rate } }
            )) {
                ForEach(QuoteOptions.vatRates, id: \.0) { Text($0.1).tag($0.0) }
            }
            .disabled(!editor.isEditable)
            row("IVA \(quote.vatRate.formatted())%", totals.vat)
            row("Totale", totals.total, bold: true)
        }
    }

    private func row(_ label: String, _ value: Double, bold: Bool = false) -> some View {
        LabeledContent(label) {
            Text(Format.currency(value))
                .monospacedDigit()
                .fontWeight(bold ? .bold : .regular)
                .foregroundStyle(Color.primary)
        }
        .fontWeight(bold ? .semibold : .regular)
    }
}

/// Totale sempre visibile in basso, con lo stato del salvataggio.
private struct TotalBar: View {
    let total: Double
    let taxable: Double
    let state: QuoteEditorModel.SaveState

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Totale IVA inclusa")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(Format.currency(total))
                    .font(.title3.weight(.bold))
                    .monospacedDigit()
                    .contentTransition(.numericText())
            }
            Spacer()
            saveLabel
                .font(.caption.weight(.medium))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .glassEffect(.regular, in: Capsule())
        .padding(.horizontal, 16)
        .padding(.bottom, 4)
        .animation(.default, value: total)
    }

    @ViewBuilder
    private var saveLabel: some View {
        switch state {
        case .saved:
            Label("Salvato", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
        case .pending:
            Label("Modificato", systemImage: "pencil.circle").foregroundStyle(.secondary)
        case .saving:
            HStack(spacing: 6) { ProgressView().controlSize(.small); Text("Salvataggio…") }
                .foregroundStyle(.secondary)
        case .failed(let message):
            Label(message, systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
                .lineLimit(2)
                .frame(maxWidth: 170, alignment: .trailing)
        }
    }
}
