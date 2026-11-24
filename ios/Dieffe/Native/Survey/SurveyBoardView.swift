import SwiftUI
import PhotosUI

// ─────────────────────────────────────────────────────────────────────────────
// Pannello «Sopralluogo» del preventivo (dall'editor, già sulla bozza):
// logistica di cantiere, annotazioni e foto preliminari. Sono le stesse righe
// delle Note e Foto del cantiere: quando il preventivo diventa cantiere le si
// ritrova anche lì. API: /api/quotes/:id/survey-board (+ /notes) e /photos.
// ─────────────────────────────────────────────────────────────────────────────

struct SurveyBoard: Decodable {
    let siteId: String?
    var logistics: Int?
    var logisticsAt: String?
    var logisticsBy: String?
    var notes: [SiteDetail.Note]
    var photos: [Photo]

    struct Photo: Decodable, Identifiable, Hashable {
        let id: String
        let url: String
        let caption: String?
        /// Foto del preventivo (si elimina da qui); nil = aggiunta dalla pagina cantiere.
        let quoteId: String?
        let userId: String?
        let userName: String?
        let createdAt: String

        var thumbURL: URL? { URL(string: SitePhotoURL.transform(url, "f_auto,q_auto,w_400,h_400,c_fill,g_auto")) }
        var fullURL: URL? { URL(string: SitePhotoURL.transform(url, "f_auto,q_auto,w_2000,c_limit")) }
    }
}

struct SurveyBoardView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let quoteID: String
    var isExtra = false
    /// Avvisa l'editor quando cambia il numero di note + foto.
    var onCount: (Int) -> Void = { _ in }

    @State private var board: SurveyBoard?
    @State private var loadError: String?
    @State private var noteEditor: NoteEditorTarget?
    @State private var picked: [PhotosPickerItem] = []
    @State private var showCamera = false
    @State private var uploading: (done: Int, total: Int)?
    @State private var viewing: SurveyBoard.Photo?

    private var me: String? { model.currentUser?.id }
    private var isAdmin: Bool { model.currentUser?.role == "admin" }
    private var canWrite: Bool { model.currentUser.map { $0.role != "viewer" } ?? false }
    private func owns(_ userId: String?) -> Bool { isAdmin || (userId != nil && userId == me) }
    private var base: String { "/api/quotes/\(quoteID)/survey-board" }

    var body: some View {
        NavigationStack {
            Group {
                if let board {
                    list(board)
                } else if let loadError {
                    ContentUnavailableView {
                        Label("Non riesco a caricare il sopralluogo", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(loadError)
                    } actions: {
                        Button("Riprova") { Task { await load() } }
                    }
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Sopralluogo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine") { dismiss() }
                }
            }
        }
        .task { await load() }
        .sheet(item: $noteEditor) { target in
            AnnotationEditorSheet(title: target.noteID == nil ? "Nuova annotazione" : "Modifica annotazione", text: target.text) { text in
                Task { await saveNote(target, text: text) }
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in Task { await upload([.camera(image)]) } }
                .ignoresSafeArea()
        }
        .sheet(item: $viewing) { photo in
            NavigationStack {
                SiteRemoteImage(url: photo.fullURL, placeholder: photo.thumbURL, contentMode: .fit)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.black)
                    .navigationTitle(photo.caption ?? "Foto")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fine") { viewing = nil } } }
            }
        }
        .onChange(of: picked) { _, items in
            guard !items.isEmpty else { return }
            picked = []
            Task { await upload(items.map { .picker($0) }) }
        }
    }

    // MARK: Contenuto

    private func list(_ b: SurveyBoard) -> some View {
        List {
            Section {
                LogisticsPickerRows(selection: b.logistics.flatMap(SiteLogistics.init(rawValue:)), disabled: !canWrite) { level in
                    Task { await setLogistics(level) }
                }
            } header: {
                Text("Logistica di cantiere")
            } footer: {
                if let by = b.logisticsBy, b.logistics != nil {
                    Text("Indicata da \(by)." + (isExtra ? " Vale per tutto il cantiere." : ""))
                } else {
                    Text("Spunta com'è l'accesso, una volta fatto il sopralluogo." + (isExtra ? " Vale per tutto il cantiere." : ""))
                }
            }

            Section {
                if canWrite {
                    Button { noteEditor = NoteEditorTarget(noteID: nil, text: "") } label: {
                        Label("Aggiungi annotazione", systemImage: "square.and.pencil")
                    }
                }
                if b.notes.isEmpty {
                    Text("Nessuna annotazione.").font(.subheadline).foregroundStyle(.secondary)
                }
                ForEach(b.notes) { n in
                    VStack(alignment: .leading, spacing: 3) {
                        Text([n.userName ?? "—", SiteDate.short(n.createdAt), n.updatedAt != nil ? "modificata" : nil]
                            .compactMap { $0 }.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(n.body).textSelection(.enabled)
                    }
                    .padding(.vertical, 2)
                    .swipeActions(edge: .trailing) {
                        if canWrite, owns(n.userId) {
                            Button(role: .destructive) { Task { await deleteNote(n) } } label: { Label("Elimina", systemImage: "trash") }
                            Button { noteEditor = NoteEditorTarget(noteID: n.id, text: n.body) } label: { Label("Modifica", systemImage: "pencil") }
                                .tint(.blue)
                        }
                    }
                }
            } header: {
                Text(b.notes.isEmpty ? "Annotazioni" : "Annotazioni (\(b.notes.count))")
            }

            Section {
                if canWrite {
                    HStack(spacing: 10) {
                        if UIImagePickerController.isSourceTypeAvailable(.camera) {
                            Button { showCamera = true } label: {
                                Label("Scatta", systemImage: "camera.fill").frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                        }
                        PhotosPicker(selection: $picked, maxSelectionCount: 20, selectionBehavior: .ordered, matching: .images) {
                            Label("Libreria", systemImage: "photo.on.rectangle.angled").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                    .disabled(uploading != nil)
                    if let uploading {
                        ProgressView(value: Double(uploading.done), total: Double(max(1, uploading.total))) {
                            Text("Caricamento \(min(uploading.done + 1, uploading.total)) di \(uploading.total)…").font(.subheadline)
                        }
                    }
                }
                if b.photos.isEmpty {
                    Text("Nessuna foto.").font(.subheadline).foregroundStyle(.secondary)
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 4)], spacing: 4) {
                        ForEach(b.photos) { p in
                            Button { viewing = p } label: {
                                Color.clear
                                    .aspectRatio(1, contentMode: .fit)
                                    .overlay { SiteRemoteImage(url: p.thumbURL) }
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(p.caption ?? "Foto del sopralluogo")
                            .contextMenu {
                                if canWrite, p.quoteId == quoteID, owns(p.userId) {
                                    Button("Elimina", systemImage: "trash", role: .destructive) { Task { await deletePhoto(p) } }
                                }
                            }
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                }
            } header: {
                Text(b.photos.isEmpty ? "Foto" : "Foto (\(b.photos.count))")
            } footer: {
                Text(b.siteId == nil
                     ? "Note e foto passano nella pagina del cantiere quando il preventivo viene inviato."
                     : "Note e foto sono anche nella pagina del cantiere.")
            }
        }
        .refreshable { await load() }
    }

    // MARK: Azioni

    private func load() async {
        do {
            let b: SurveyBoard = try await APIClient.shared.get(base)
            board = b
            loadError = nil
            onCount(b.notes.count + b.photos.count)
        } catch {
            if board == nil { loadError = error.localizedDescription } else { model.lastError = error.localizedDescription }
        }
    }

    private func setLogistics(_ level: SiteLogistics?) async {
        let previous = board?.logistics
        board?.logistics = level?.rawValue
        board?.logisticsBy = level == nil ? nil : model.currentUser?.name
        do {
            let _: Empty = try await APIClient.shared.send("PATCH", base, json: ["logistics": level?.rawValue])
        } catch {
            board?.logistics = previous
            model.lastError = error.localizedDescription
        }
    }

    private func saveNote(_ target: NoteEditorTarget, text: String) async {
        let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        do {
            if let id = target.noteID {
                let _: Empty = try await APIClient.shared.send("PATCH", "\(base)/notes/\(id)", json: ["body": body])
            } else {
                let _: Empty = try await APIClient.shared.send("POST", "\(base)/notes", json: ["body": body])
            }
        } catch {
            model.lastError = error.localizedDescription
        }
        await load()
    }

    private func deleteNote(_ n: SiteDetail.Note) async {
        board?.notes.removeAll { $0.id == n.id }
        do { try await APIClient.shared.delete("\(base)/notes/\(n.id)") } catch { model.lastError = error.localizedDescription }
        await load()
    }

    private func deletePhoto(_ p: SurveyBoard.Photo) async {
        board?.photos.removeAll { $0.id == p.id }
        do { try await APIClient.shared.delete("/api/quotes/\(quoteID)/photos/\(p.id)") } catch { model.lastError = error.localizedDescription }
        await load()
    }

    private func upload(_ sources: [SitePhotoUploader.Source]) async {
        guard uploading == nil, !sources.isEmpty else { return }
        uploading = (0, sources.count)
        var failed = 0
        for (index, source) in sources.enumerated() {
            let raw: Data? = switch source {
            case .picker(let item): try? await item.loadTransferable(type: Data.self)
            case .camera(let image): image.jpegData(compressionQuality: 0.95)
            }
            if let raw, let jpeg = await Task.detached(priority: .userInitiated, operation: { SitePhotoPrep.jpeg(from: raw) }).value {
                do {
                    _ = try await APIClient.shared.upload("/api/quotes/\(quoteID)/photos", data: jpeg,
                                                          filename: "sopralluogo-\(UUID().uuidString.prefix(8)).jpg",
                                                          mimeType: "image/jpeg", fields: [:])
                } catch { failed += 1 }
            } else {
                failed += 1
            }
            uploading = (index + 1, sources.count)
        }
        uploading = nil
        if failed > 0 { model.lastError = failed == 1 ? "Una foto non è stata caricata." : "\(failed) foto non sono state caricate." }
        await load()
    }
}

struct NoteEditorTarget: Identifiable {
    let id = UUID()
    let noteID: String?
    let text: String
}

/// Foglio per scrivere un'annotazione (anche dettandola con il microfono della tastiera).
struct AnnotationEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    @State var text: String
    let onSave: (String) -> Void
    @FocusState private var focused: Bool

    init(title: String, text: String, onSave: @escaping (String) -> Void) {
        self.title = title
        _text = State(initialValue: text)
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            TextEditor(text: $text)
                .focused($focused)
                .padding(.horizontal, 12)
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text("Es. contatore in cantina, chiavi dal vicino, muro portante da verificare…")
                            .foregroundStyle(.tertiary)
                            .padding(.horizontal, 17)
                            .padding(.vertical, 8)
                            .allowsHitTesting(false)
                    }
                }
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Salva") {
                            onSave(text)
                            dismiss()
                        }
                        .fontWeight(.semibold)
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
                .onAppear { focused = true }
        }
        .presentationDetents([.medium, .large])
    }
}
