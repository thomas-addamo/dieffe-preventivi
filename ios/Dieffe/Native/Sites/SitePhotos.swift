import ImageIO
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// Foto di cantiere (come src/app/(app)/cantieri/[id]/PhotosTab.tsx): griglia
// con miniature di Cloudinary, filtro per fase, caricamento dalla libreria o
// dalla fotocamera (ridimensionate prima dell'invio), visore a schermo intero
// con didascalia, fase, condivisione ed eliminazione.

// MARK: Preparazione e invio

/// Lato lungo 2.000 px in JPEG: resta sotto il limite di 4 MB del server e si
/// carica in fretta anche in cantiere con poco segnale. Toglie anche i
/// metadati (posizione GPS compresa).
enum SitePhotoPrep {
    static let maxSide = 2000
    static let maxBytes = 4 * 1024 * 1024 - 32 * 1024

    nonisolated static func jpeg(from data: Data) -> Data? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true, // raddrizza secondo l'EXIF
            kCGImageSourceThumbnailMaxPixelSize: maxSide,
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        for quality in [0.8, 0.65, 0.5] {
            if let out = encode(image, quality: quality), out.count <= maxBytes { return out }
        }
        return nil
    }

    nonisolated private static func encode(_ image: CGImage, quality: Double) -> Data? {
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        return CGImageDestinationFinalize(dest) ? out as Data : nil
    }
}

/// Coda di caricamento: vive nella pagina del cantiere, così l'avanzamento
/// resta visibile anche cambiando scheda.
@MainActor
@Observable
final class SitePhotoUploader {
    enum Source {
        case picker(PhotosPickerItem)
        case camera(UIImage)
    }

    private(set) var total = 0
    private(set) var done = 0
    var isUploading: Bool { total > 0 }

    /// Carica una foto alla volta; restituisce quante non sono andate e l'ultimo errore.
    func upload(_ sources: [Source], siteID: String, phaseID: String?) async -> (failed: Int, error: String?) {
        guard !sources.isEmpty, total == 0 else { return (0, nil) }
        total = sources.count
        done = 0
        defer { total = 0; done = 0 }
        var failed = 0
        var lastError: String?
        for source in sources {
            defer { done += 1 }
            guard let raw = await rawData(source) else { failed += 1; continue }
            let jpeg = await Task.detached(priority: .userInitiated) { SitePhotoPrep.jpeg(from: raw) }.value
            guard let jpeg else {
                failed += 1
                lastError = "Formato della foto non supportato."
                continue
            }
            var fields: [String: String] = [:]
            if let phaseID { fields["phaseId"] = phaseID }
            do {
                _ = try await APIClient.shared.upload("/api/sites/\(siteID)/photos", data: jpeg,
                                                      filename: "cantiere-\(UUID().uuidString.prefix(8)).jpg",
                                                      mimeType: "image/jpeg", fields: fields)
            } catch {
                failed += 1
                lastError = error.localizedDescription
            }
        }
        return (failed, lastError)
    }

    private func rawData(_ source: Source) async -> Data? {
        switch source {
        case .picker(let item): try? await item.loadTransferable(type: Data.self)
        case .camera(let image): image.jpegData(compressionQuality: 0.95)
        }
    }
}

// MARK: Immagini remote con cache

/// Le miniature tornano spesso (cambio scheda, visore): cache in memoria oltre
/// a quella di URLSession.
@MainActor
final class SiteImageCache {
    static let shared = SiteImageCache()
    private let cache: NSCache<NSURL, UIImage> = {
        let c = NSCache<NSURL, UIImage>()
        c.totalCostLimit = 80 * 1024 * 1024
        return c
    }()

    func image(_ url: URL) -> UIImage? { cache.object(forKey: url as NSURL) }

    func load(_ url: URL) async -> UIImage? {
        if let hit = image(url) { return hit }
        guard let (data, _) = try? await URLSession.shared.data(from: url) else { return nil }
        let decoded = await Task.detached(priority: .userInitiated) { UIImage(data: data)?.preparingForDisplay() }.value
        if let decoded { cache.setObject(decoded, forKey: url as NSURL, cost: data.count) }
        return decoded
    }
}

struct SiteRemoteImage: View {
    let url: URL?
    var placeholder: URL?
    var contentMode: ContentMode = .fill

    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        ZStack {
            if let image = image ?? url.flatMap({ SiteImageCache.shared.image($0) }) {
                Image(uiImage: image).resizable().aspectRatio(contentMode: contentMode)
            } else if let placeholder, let low = SiteImageCache.shared.image(placeholder) {
                Image(uiImage: low).resizable().aspectRatio(contentMode: contentMode).blur(radius: 6)
                ProgressView()
            } else if failed {
                Image(systemName: "photo.badge.exclamationmark").font(.title2).foregroundStyle(.secondary)
            } else {
                Rectangle().fill(.quaternary)
                ProgressView()
            }
        }
        .task(id: url) {
            guard let url, image == nil else { return }
            image = await SiteImageCache.shared.load(url)
            failed = image == nil
        }
    }
}

// MARK: Sezione Foto

/// Riquadro per aggiungere foto: icona colorata, titolo e sottotitolo.
private struct PhotoSourceTile: View {
    let title: String
    let subtitle: String
    let symbol: String
    let tint: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(tint.gradient, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.85)
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(subtitle)")
    }
}

struct SitePhotosSection: View {
    let detail: SiteDetail
    let editable: Bool
    let uploader: SitePhotoUploader
    let canDelete: (SiteDetail.Photo) -> Bool
    let upload: ([SitePhotoUploader.Source], _ phaseID: String?) -> Void
    let openCamera: (_ phaseID: String?) -> Void
    let open: (SiteDetail.Photo, [SiteDetail.Photo]) -> Void
    let edit: (SiteDetail.Photo) -> Void
    let delete: (SiteDetail.Photo) -> Void

    @State private var phase: String?
    @State private var picked: [PhotosPickerItem] = []

    private var cameraAvailable: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }

    var body: some View {
        let all = detail.allPhotos
        let photos = phase.map { id in all.filter { $0.phaseId == id } } ?? all
        let phaseTitle = Dictionary(uniqueKeysWithValues: detail.phases.map { ($0.id, $0.title) })

        if editable {
            Section {
                // Due riquadri affiancati (fotocamera e libreria) fuori dalla
                // card: stile plain, così il tocco su uno non attiva l'altro.
                HStack(spacing: 10) {
                    if cameraAvailable {
                        Button { openCamera(phase) } label: {
                            PhotoSourceTile(title: "Scatta", subtitle: "Fotocamera", symbol: "camera.fill", tint: .accentColor)
                        }
                        .buttonStyle(.plain)
                    }
                    PhotosPicker(selection: $picked, maxSelectionCount: 20, selectionBehavior: .ordered, matching: .images) {
                        PhotoSourceTile(title: "Scegli", subtitle: "Dalla libreria", symbol: "photo.on.rectangle.angled", tint: .orange)
                    }
                    .buttonStyle(.plain)
                }
                .disabled(uploader.isUploading)
                .opacity(uploader.isUploading ? 0.5 : 1)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)

                if uploader.isUploading {
                    ProgressView(value: Double(uploader.done), total: Double(max(1, uploader.total))) {
                        Text("Caricamento \(min(uploader.done + 1, uploader.total)) di \(uploader.total)…")
                            .font(.subheadline)
                    }
                    .padding(14)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 0, trailing: 0))
                    .listRowBackground(Color.clear)
                    .accessibilityLabel("Caricamento foto, \(uploader.done) di \(uploader.total)")
                }
            } footer: {
                if let phase, let title = phaseTitle[phase] {
                    Text("Le nuove foto vengono collegate a «\(title)».")
                }
            }
            .onChange(of: picked) { _, items in
                guard !items.isEmpty else { return }
                picked = []
                upload(items.map { .picker($0) }, phase)
            }
        }

        Section {
            if photos.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "photo.stack").font(.largeTitle).foregroundStyle(.tertiary)
                    Text(phase == nil ? "Nessuna foto." : "Nessuna foto per questa fase.")
                        .font(.subheadline.weight(.medium))
                    if editable {
                        Text("Documenta l'avanzamento: scatta o scegli le foto, si ridimensionano da sole prima dell'invio.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
                .accessibilityElement(children: .combine)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 4)], spacing: 4) {
                    ForEach(photos) { p in
                        Button { open(p, photos) } label: {
                            Color.clear
                                .aspectRatio(1, contentMode: .fit)
                                .overlay { SiteRemoteImage(url: p.thumbURL) }
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(accessibility(p, phaseTitle: phaseTitle))
                        .accessibilityHint("Apre la foto a schermo intero")
                        .contextMenu {
                            if editable {
                                Button("Didascalia e fase", systemImage: "pencil") { edit(p) }
                            }
                            if canDelete(p) {
                                Button("Elimina", systemImage: "trash", role: .destructive) { delete(p) }
                            }
                        } preview: {
                            SiteRemoteImage(url: p.thumbURL)
                                .frame(width: 300, height: 300)
                        }
                    }
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
            }
        } header: {
            HStack {
                Text(Format.count(photos.count, "foto", "foto"))
                Spacer()
                if !detail.phases.isEmpty {
                    Menu {
                        Picker("Fase", selection: $phase) {
                            Text("Tutte (\(all.count))").tag(String?.none)
                            ForEach(detail.phases) { p in
                                Text("\(p.title) (\(all.filter { $0.phaseId == p.id }.count))").tag(Optional(p.id))
                            }
                        }
                    } label: {
                        Label(phase.flatMap { phaseTitle[$0] } ?? "Tutte le fasi", systemImage: "line.3.horizontal.decrease.circle")
                            .font(.subheadline)
                            .lineLimit(1)
                    }
                    .textCase(nil)
                    .accessibilityLabel("Filtra per fase")
                }
            }
        } footer: {
            if !photos.isEmpty, editable {
                Text("Tieni premuta una foto per la didascalia, la fase o per eliminarla.")
            }
        }
    }

    private func accessibility(_ p: SiteDetail.Photo, phaseTitle: [String: String]) -> String {
        var parts = ["Foto"]
        if let c = p.caption, !c.isEmpty { parts.append(c) }
        if let id = p.phaseId, let t = phaseTitle[id] { parts.append("fase \(t)") }
        parts.append("del \(SiteDate.long(p.createdAt))")
        if let u = p.userName { parts.append("di \(u)") }
        return parts.joined(separator: ", ")
    }
}

// MARK: Visore

struct PhotoViewerItem: Identifiable {
    let id: String
    let photos: [SiteDetail.Photo]
}

struct SitePhotoViewer: View {
    @Environment(\.dismiss) private var dismiss
    let phases: [SiteDetail.Phase]
    let editable: Bool
    let canDelete: (SiteDetail.Photo) -> Bool
    let save: (SiteDetail.Photo) async -> Bool
    let delete: (SiteDetail.Photo) async -> Bool

    @State private var photos: [SiteDetail.Photo]
    @State private var current: String
    @State private var editing: SiteDetail.Photo?
    @State private var confirmDelete = false
    @State private var chrome = true

    init(item: PhotoViewerItem, phases: [SiteDetail.Phase], editable: Bool,
         canDelete: @escaping (SiteDetail.Photo) -> Bool,
         save: @escaping (SiteDetail.Photo) async -> Bool,
         delete: @escaping (SiteDetail.Photo) async -> Bool) {
        self.phases = phases
        self.editable = editable
        self.canDelete = canDelete
        self.save = save
        self.delete = delete
        _photos = State(initialValue: item.photos)
        _current = State(initialValue: item.id)
    }

    private var photo: SiteDetail.Photo? { photos.first { $0.id == current } }
    private var index: Int { photos.firstIndex { $0.id == current } ?? 0 }

    var body: some View {
        NavigationStack {
            TabView(selection: $current) {
                ForEach(photos) { p in
                    ZoomablePhoto(photo: p, toggleChrome: { withAnimation(.easeInOut(duration: 0.2)) { chrome.toggle() } })
                        .tag(p.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .background(Color.black.ignoresSafeArea())
            .ignoresSafeArea(edges: .bottom)
            .safeAreaInset(edge: .bottom) {
                if chrome, let photo { info(photo) }
            }
            .navigationTitle(photos.count > 1 ? "\(index + 1) di \(photos.count)" : "Foto")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(chrome ? .visible : .hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Chiudi", systemImage: "xmark") { dismiss() }
                }
                if let photo {
                    ToolbarItemGroup(placement: .primaryAction) {
                        ShareLink(item: SharedSitePhoto(photo: photo),
                                  preview: SharePreview(photo.caption ?? "Foto di cantiere", image: Image(systemName: "photo")))
                        if editable || canDelete(photo) {
                            Menu("Altro", systemImage: "ellipsis") {
                                if editable {
                                    Button("Didascalia e fase", systemImage: "pencil") { editing = photo }
                                }
                                if canDelete(photo) {
                                    Button("Elimina", systemImage: "trash", role: .destructive) { confirmDelete = true }
                                }
                            }
                        }
                    }
                }
            }
            .confirmationDialog("Eliminare la foto?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Elimina foto", role: .destructive) { remove() }
            } message: {
                Text("La foto viene cancellata per tutti e non si può recuperare.")
            }
            .sheet(item: $editing) { p in
                PhotoEditSheet(photo: p, phases: phases) { updated in
                    guard await save(updated) else { return false }
                    if let i = photos.firstIndex(where: { $0.id == updated.id }) { photos[i] = updated }
                    return true
                }
            }
        }
        .environment(\.colorScheme, .dark)
        .statusBarHidden(!chrome)
    }

    private func info(_ p: SiteDetail.Photo) -> some View {
        let phase = p.phaseId.flatMap { id in phases.first { $0.id == id }?.title }
        return VStack(alignment: .leading, spacing: 4) {
            if let caption = p.caption, !caption.isEmpty {
                Text(caption).font(.body).foregroundStyle(.white)
            }
            if let phase {
                Label(phase, systemImage: "checklist").font(.subheadline).foregroundStyle(.white.opacity(0.85))
            }
            Text([p.userName, SiteDate.long(p.createdAt)].compactMap { $0 }.joined(separator: " · "))
                .font(.caption)
                .foregroundStyle(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .accessibilityElement(children: .combine)
    }

    private func remove() {
        guard let p = photo else { return }
        let i = index
        Task {
            guard await delete(p) else { return }
            photos.removeAll { $0.id == p.id }
            if photos.isEmpty { dismiss(); return }
            current = photos[min(i, photos.count - 1)].id
        }
    }
}

/// Foto con pizzico per ingrandire, doppio tocco e trascinamento quando è ingrandita.
private struct ZoomablePhoto: View {
    let photo: SiteDetail.Photo
    let toggleChrome: () -> Void

    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    var body: some View {
        SiteRemoteImage(url: photo.fullURL, placeholder: photo.thumbURL, contentMode: .fit)
            .scaleEffect(scale)
            .offset(offset)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(
                MagnifyGesture()
                    .onChanged { v in scale = min(5, max(1, lastScale * v.magnification)) }
                    .onEnded { _ in
                        lastScale = scale
                        if scale <= 1 { reset() }
                    }
            )
            .simultaneousGesture(scale > 1 ? DragGesture()
                .onChanged { v in
                    offset = CGSize(width: lastOffset.width + v.translation.width, height: lastOffset.height + v.translation.height)
                }
                .onEnded { _ in lastOffset = offset } : nil)
            .onTapGesture(count: 2) {
                withAnimation(.spring(duration: 0.3)) {
                    if scale > 1 { reset() } else { scale = 2.5; lastScale = 2.5 }
                }
            }
            .onTapGesture(perform: toggleChrome)
            .accessibilityElement()
            .accessibilityLabel(photo.caption.map { "Foto: \($0)" } ?? "Foto di cantiere")
            .accessibilityAddTraits(.isImage)
    }

    private func reset() {
        scale = 1; lastScale = 1; offset = .zero; lastOffset = .zero
    }
}

/// Condivide il file JPEG (non il link) con Messaggi, WhatsApp, Salva immagine…
struct SharedSitePhoto: Transferable {
    let photo: SiteDetail.Photo

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .jpeg) { item in
            let raw = SitePhotoURL.transform(item.photo.url, "f_jpg,q_auto,w_2000,c_limit")
            guard let url = URL(string: raw) else { throw URLError(.badURL) }
            return try await URLSession.shared.data(from: url).0
        }
        .suggestedFileName { _ in "foto-cantiere.jpg" }
    }
}

// MARK: Didascalia e fase

struct PhotoEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    let photo: SiteDetail.Photo
    let phases: [SiteDetail.Phase]
    let save: (SiteDetail.Photo) async -> Bool

    @State private var caption = ""
    @State private var phaseID: String?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Spacer()
                        SiteRemoteImage(url: photo.thumbURL)
                            .frame(width: 120, height: 120)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .accessibilityHidden(true)
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                }
                Section("Didascalia") {
                    TextField("Es. Getto del solaio, lato nord", text: $caption, axis: .vertical)
                        .lineLimit(1...4)
                }
                if !phases.isEmpty {
                    Section("Fase") {
                        Picker("Fase", selection: $phaseID) {
                            Text("Nessuna").tag(String?.none)
                            ForEach(phases) { p in Text(p.title).tag(Optional(p.id)) }
                        }
                        .pickerStyle(.navigationLink)
                    }
                }
            }
            .navigationTitle("Foto")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") {
                        saving = true
                        var updated = photo
                        let text = caption.trimmingCharacters(in: .whitespacesAndNewlines)
                        updated.caption = text.isEmpty ? nil : String(text.prefix(300))
                        updated.phaseId = phaseID
                        Task {
                            let ok = await save(updated)
                            saving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(saving)
                }
            }
            .onAppear {
                caption = photo.caption ?? ""
                phaseID = photo.phaseId
            }
        }
        .presentationDetents([.medium, .large])
    }
}

// MARK: Fotocamera

struct CameraRequest: Identifiable {
    let id = UUID()
    let phaseID: String?
}

struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage { parent.onImage(image) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}
