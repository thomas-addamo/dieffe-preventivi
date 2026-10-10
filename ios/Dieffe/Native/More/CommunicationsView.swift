import QuickLook
import SwiftUI

/// Comunicazioni su carta intestata (come src/app/(app)/comunicazioni):
/// archivio, nuova lettera, destinatari, testo, PDF, duplica, elimina.
struct CommunicationsView: View {
    @Environment(AppModel.self) private var model
    @State private var items: [Communication]?
    @State private var error: String?
    @State private var search = ""
    @State private var editing: Communication?
    @State private var pendingDelete: Communication?

    var body: some View {
        Group {
            if let items {
                let needle = search.trimmingCharacters(in: .whitespaces)
                let visible = needle.isEmpty ? items : items.filter {
                    $0.subject.localizedStandardContains(needle) || $0.code.localizedStandardContains(needle)
                        || $0.recipients.contains { $0.name.localizedStandardContains(needle) }
                }
                List {
                    ForEach(visible) { item in
                        Button { editing = item } label: { CommunicationRow(item: item) }
                            .tint(.primary)
                            .swipeActions(edge: .trailing) {
                                if model.canEdit {
                                    Button("Elimina", systemImage: "trash") { pendingDelete = item }.tint(.red)
                                }
                            }
                            .contextMenu {
                                Button("PDF", systemImage: "doc.richtext") { openPDF(item) }
                                if model.canEdit {
                                    Button("Duplica", systemImage: "plus.square.on.square") { editing = duplicate(item) }
                                    Button("Elimina", systemImage: "trash", role: .destructive) { pendingDelete = item }
                                }
                            }
                    }
                }
                .overlay {
                    if visible.isEmpty {
                        if needle.isEmpty {
                            ContentUnavailableView {
                                Label("Nessuna comunicazione", systemImage: "envelope")
                            } description: {
                                Text("Lettere su carta intestata per clienti, condòmini, amministratori e direzione lavori.")
                            } actions: {
                                if model.canEdit {
                                    Button("Nuova comunicazione") { editing = .empty() }.buttonStyle(.glassProminent)
                                }
                            }
                        } else {
                            ContentUnavailableView.search(text: search)
                        }
                    }
                }
            } else {
                LoadingOrError(error: error) { await load() }
            }
        }
        .navigationTitle("Comunicazioni")
        .searchable(text: $search, prompt: "Oggetto, protocollo, destinatario")
        .refreshable { await load() }
        .task { await load() }
        .toolbar {
            if model.canEdit {
                ToolbarItem(placement: .primaryAction) {
                    Button("Nuova", systemImage: "square.and.pencil") { editing = .empty() }
                }
            }
        }
        .fullScreenCover(item: $editing) { item in
            CommunicationEditor(original: item) { saved in
                if let index = items?.firstIndex(where: { $0.id == saved.id }) {
                    items?[index] = saved
                } else {
                    items?.insert(saved, at: 0)
                }
            }
        }
        .confirmationDialog(
            "Eliminare la comunicazione \(pendingDelete?.code ?? "")?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { item in
            Button("Elimina", role: .destructive) { delete(item) }
        }
    }

    private func load() async {
        do {
            let json: [[String: Any]] = try await APIClient.shared.getRawArray("/api/communications")
            items = json.compactMap(Communication.init(json:))
            error = nil
        } catch APIError.unauthorized {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error.localizedDescription
        }
    }

    private func duplicate(_ item: Communication) -> Communication {
        Communication(id: "", code: "", subject: item.subject, body: item.body, recipients: item.recipients,
                             place: item.place, documentDate: Communication.today(), includeStamp: item.includeStamp,
                             signatory: item.signatory, createdAt: "")
    }

    private func openPDF(_ item: Communication) {
        Task {
            do {
                model.previewURL = try await APIClient.shared.download("/api/communications/\(item.id)/pdf")
            } catch {
                model.lastError = error.localizedDescription
            }
        }
    }

    private func delete(_ item: Communication) {
        Task {
            do {
                try await APIClient.shared.delete("/api/communications/\(item.id)")
                withAnimation { items?.removeAll { $0.id == item.id } }
            } catch {
                model.lastError = error.localizedDescription
            }
        }
    }
}

private struct CommunicationRow: View {
    let item: Communication

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(item.code)
                    .font(.caption.monospaced().weight(.semibold))
                    .foregroundStyle(Color.accentColor)
                Spacer()
                Text(Format.date(item.documentDate))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(item.subject.isEmpty ? "Senza oggetto" : item.subject)
                .font(.body.weight(.semibold))
                .lineLimit(2)
            if !item.recipients.isEmpty {
                Text(item.recipients.map { $0.name.isEmpty ? $0.kindLabel : $0.name }.joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Text(item.preview)
                .font(.caption)
                .foregroundStyle(.tertiary)
                .lineLimit(2)
        }
        .padding(.vertical, 2)
    }
}

/// Editor di una comunicazione (nuova, esistente o copia).
struct CommunicationEditor: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let original: Communication
    let onSaved: (Communication) -> Void

    @State private var draft: Communication
    @State private var text: String
    @State private var advanced: Bool
    @State private var saving = false
    @State private var error: String?
    @State private var confirmDiscard = false
    @State private var selection: TextSelection?
    @State private var pdfURL: URL?
    @FocusState private var textFocused: Bool

    init(original: Communication, onSaved: @escaping (Communication) -> Void) {
        self.original = original
        self.onSaved = onSaved
        _draft = State(initialValue: original)
        _text = State(initialValue: LetterDoc.toText(original.body))
        _advanced = State(initialValue: !LetterDoc.isEditableNatively(original.body))
    }

    private var readOnly: Bool { !model.canEdit }
    private var isNew: Bool { draft.id.isEmpty }
    private var dirty: Bool {
        draft.subject != original.subject || draft.recipients != original.recipients || draft.place != original.place
            || draft.documentDate != original.documentDate || draft.includeStamp != original.includeStamp
            || draft.signatory != original.signatory || (!advanced && text != LetterDoc.toText(original.body))
            || isNew
    }
    private var canSave: Bool {
        !readOnly && (!draft.subject.trimmingCharacters(in: .whitespaces).isEmpty || !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Oggetto") {
                    TextField("Oggetto", text: $draft.subject, prompt: Text("Es. Avviso inizio lavori"), axis: .vertical)
                }

                Section {
                    ForEach($draft.recipients) { $recipient in
                        RecipientEditor(recipient: $recipient)
                    }
                    .onDelete { draft.recipients.remove(atOffsets: $0) }
                    Menu {
                        ForEach(Communication.kinds, id: \.value) { kind in
                            Button(kind.label) { draft.recipients.append(.init(kind: kind.value)) }
                        }
                    } label: {
                        Label("Aggiungi destinatario", systemImage: "person.badge.plus")
                    }
                } header: {
                    Text("Destinatari")
                }

                Section {
                    if advanced {
                        Text(RichText.attributed(LetterDoc.toText(draft.body)))
                            .font(.subheadline)
                        Label("Questa lettera ha una formattazione avanzata (colori, dimensioni o allineamenti): il testo si modifica dal sito.",
                              systemImage: "info.circle")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Button("Modifica il testo nel sito", systemImage: "safari") {
                            dismiss()
                            model.altroPath.append(WebDestination(path: "/comunicazioni", title: "Comunicazioni (sito)"))
                        }
                    } else {
                        TextEditor(text: $text, selection: $selection)
                            .focused($textFocused)
                            .frame(minHeight: 220)
                    }
                } header: {
                    Text("Testo")
                } footer: {
                    if !advanced {
                        Text("Seleziona il testo e usa la barra sopra la tastiera per grassetto, corsivo, sottolineato, barrato ed elenchi.")
                    }
                }

                Section("Chiusura") {
                    TextField("Luogo", text: $draft.place, prompt: Text("Luogo (es. Nichelino)"))
                    DatePicker("Data", selection: Binding(
                        get: { HeaderEditView.date(draft.documentDate) ?? .now },
                        set: { draft.documentDate = HeaderEditView.isoDay($0) }
                    ), displayedComponents: .date)
                    TextField("Firmatario", text: $draft.signatory, prompt: Text("Firmatario (es. Il titolare)"))
                    Toggle("Timbro e firma dell'impresa", isOn: $draft.includeStamp)
                }

                if let error {
                    Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
                }
            }
            .disabled(readOnly)
            .navigationTitle(isNew ? "Nuova comunicazione" : draft.code)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Chiudi", systemImage: "xmark") {
                        if dirty && canSave && !isNew || (isNew && canSave) { confirmDiscard = true } else { dismiss() }
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("PDF", systemImage: "doc.richtext") { pdf() }
                        .disabled(saving || (isNew && !canSave))
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("Salva", systemImage: "checkmark") { Task { await save() } }
                            .disabled(!canSave || !dirty)
                    }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    if textFocused {
                        ForEach(RichText.Style.allCases) { style in
                            Button(style.label, systemImage: style.symbol) { apply(style) }.labelStyle(.iconOnly)
                        }
                        Button("Elenco", systemImage: "list.bullet") {
                            RichText.toggleList(in: &text, range: range())
                            selection = nil
                        }
                        .labelStyle(.iconOnly)
                        Spacer()
                        Button("Fine", systemImage: "keyboard.chevron.compact.down") { textFocused = false }.labelStyle(.iconOnly)
                    }
                }
            }
            .quickLookPreview($pdfURL)
            .confirmationDialog("Uscire senza salvare?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("Salva ed esci") { Task { if await save() { dismiss() } } }
                Button("Esci senza salvare", role: .destructive) { dismiss() }
            }
        }
    }

    private func range() -> Range<String.Index>? {
        guard case .selection(let r) = selection?.indices, r.upperBound <= text.endIndex else { return nil }
        return r
    }

    private func apply(_ style: RichText.Style) {
        if let r = RichText.toggle(style, in: &text, range: range()) { selection = TextSelection(range: r) }
    }

    @discardableResult
    private func save() async -> Bool {
        saving = true
        error = nil
        defer { saving = false }
        var payload = draft
        if !advanced { payload.body = LetterDoc.toDoc(text) }
        do {
            let json = try await APIClient.shared.sendRaw(isNew ? "POST" : "PATCH",
                                                          isNew ? "/api/communications" : "/api/communications/\(draft.id)",
                                                          json: payload.input)
            guard let saved = Communication(json: json) else { throw APIError.server("Risposta non valida.") }
            draft = saved
            text = LetterDoc.toText(saved.body)
            onSaved(saved)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    /// Il PDF si genera dalla versione salvata: se serve, salva prima.
    private func pdf() {
        Task {
            if (dirty && canSave) || isNew {
                guard await save() else { return }
            }
            do {
                pdfURL = try await APIClient.shared.download("/api/communications/\(draft.id)/pdf")
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

private struct RecipientEditor: View {
    @Environment(AppModel.self) private var model
    @Binding var recipient: Communication.Recipient

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Picker("Tipo", selection: Binding(
                    get: { recipient.kind },
                    set: { kind in
                        let wasDefault = Communication.kinds.contains { $0.salutation == recipient.salutation }
                        recipient.kind = kind
                        if wasDefault, let k = Communication.kinds.first(where: { $0.value == kind }) { recipient.salutation = k.salutation }
                    }
                )) {
                    ForEach(Communication.kinds, id: \.value) { Text($0.label).tag($0.value) }
                }
                .labelsHidden()
                Spacer()
                if recipient.kind == "cliente", let clients = model.clients.clients, !clients.isEmpty {
                    Menu {
                        ForEach(clients.sorted { $0.name.localizedCompare($1.name) == .orderedAscending }) { client in
                            Button(client.name) {
                                recipient.clientId = client.id
                                recipient.name = client.name
                                recipient.address = client.address ?? ""
                                recipient.email = client.email ?? ""
                            }
                        }
                    } label: {
                        Label("Dai clienti", systemImage: "person.crop.circle")
                    }
                    .font(.subheadline)
                }
            }
            TextField("Formula", text: $recipient.salutation, prompt: Text("Formula (es. Spett.le)"))
                .foregroundStyle(.secondary)
            TextField("Nome", text: $recipient.name, prompt: Text(recipient.kind == "condomini" ? "Condominio…" : "Nome"))
                .font(.body.weight(.semibold))
            TextField("Indirizzo", text: $recipient.address, prompt: Text("Indirizzo"), axis: .vertical)
            TextField("Email", text: $recipient.email, prompt: Text("Email"))
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
        }
        .padding(.vertical, 4)
        .task { if model.clients.clients == nil { await model.clients.load() } }
    }
}
