import QuickLook
import SwiftUI
import UniformTypeIdentifiers

// Documenti PDF del cantiere (B3), come la scheda "Documenti" del sito:
// permessi, progetti, contratti. Il PDF va direttamente a Cloudinary con la
// firma del server (POST /api/sites/:id/documents/sign), poi si registra
// (POST /api/sites/:id/documents). Si aprono in anteprima con Quick Look e
// restano in cache sul telefono: aperti una volta, si rivedono anche offline.

struct SiteDocumentsSection: View {
    let detail: SiteDetail
    let editable: Bool
    let canDelete: (SiteDetail.Document) -> Bool
    let mutate: SiteMutation
    let reload: () async -> Void

    @State private var importing = false
    @State private var uploading: String?
    @State private var progressText: String?
    @State private var previewURL: URL?
    @State private var opening: String?
    @State private var error: String?

    var body: some View {
        Section {
            if detail.allDocuments.isEmpty {
                Text(editable ? "Nessun documento. Aggiungi permessi, progetti e contratti in PDF (fino a 25 MB)." : "Nessun documento.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            ForEach(detail.allDocuments) { doc in
                Button { open(doc) } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "doc.richtext.fill")
                            .font(.title3)
                            .foregroundStyle(.red)
                            .frame(width: 36, height: 36)
                            .background(Color.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 9))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(doc.name).font(.body.weight(.medium)).foregroundStyle(.primary).lineLimit(2)
                            Text([SiteDocumentFile.size(doc.bytes), SiteDate.short(doc.createdAt), doc.userName]
                                .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if opening == doc.id { ProgressView() }
                    }
                }
                .swipeActions(edge: .trailing) {
                    if editable, canDelete(doc) {
                        Button(role: .destructive) {
                            Task {
                                _ = await mutate("DELETE", "/api/sites/\(detail.site.id)/documents/\(doc.id)", [:])
                                SiteDocumentFile.forget(doc)
                            }
                        } label: { Label("Elimina", systemImage: "trash") }
                    }
                }
                .contextMenu {
                    if let url = URL(string: doc.url) { ShareLink(item: url) { Label("Condividi link", systemImage: "square.and.arrow.up") } }
                }
            }
            if editable {
                if let uploading {
                    HStack {
                        ProgressView()
                        Text("Caricamento di «\(uploading)»\(progressText.map { " · \($0)" } ?? "")…")
                            .font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                    }
                } else {
                    Button("Aggiungi PDF", systemImage: "doc.badge.plus") { importing = true }
                }
            }
        } header: {
            Text("Documenti")
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf], allowsMultipleSelection: true) { result in
            if case .success(let urls) = result { Task { await upload(urls) } }
        }
        .quickLookPreview($previewURL)
        .alert("Documento", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(error ?? "") }
    }

    private func open(_ doc: SiteDetail.Document) {
        guard opening == nil else { return }
        opening = doc.id
        Task {
            defer { opening = nil }
            do { previewURL = try await SiteDocumentFile.local(doc) } catch { self.error = "Impossibile aprire il documento: \(error.localizedDescription)" }
        }
    }

    private struct Sign: Decodable {
        let uploadUrl: String
        let fields: [String: String]
        let maxBytes: Int
    }

    private func upload(_ urls: [URL]) async {
        var added = 0
        for url in urls {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            let name = url.lastPathComponent
            uploading = name
            progressText = nil
            do {
                let data = try Data(contentsOf: url)
                let sign: Sign = try await APIClient.shared.send("POST", "/api/sites/\(detail.site.id)/documents/sign", as: Sign.self)
                guard data.count <= sign.maxBytes else {
                    throw SiteDocumentError("«\(name)» supera i \(sign.maxBytes / 1_048_576) MB")
                }
                progressText = SiteDocumentFile.size(data.count)
                let publicId = try await SiteDocumentFile.uploadToCloudinary(sign.uploadUrl, fields: sign.fields, data: data, filename: name)
                try await APIClient.shared.send("POST", "/api/sites/\(detail.site.id)/documents",
                                                json: ["publicId": publicId, "name": name], as: Empty.self)
                added += 1
            } catch {
                self.error = error.localizedDescription
            }
        }
        uploading = nil
        if added > 0 {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            await reload()
        }
    }
}

struct SiteDocumentError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

/// Download in cache e caricamento diretto su Cloudinary.
enum SiteDocumentFile {
    static func size(_ bytes: Int?) -> String? {
        guard let bytes, bytes > 0 else { return nil }
        return bytes < 1_048_576 ? "\(max(1, bytes / 1024)) KB"
            : String(format: "%.1f MB", Double(bytes) / 1_048_576).replacingOccurrences(of: ".", with: ",")
    }

    private static var folder: URL {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appending(path: "documenti-cantiere")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static func fileURL(_ doc: SiteDetail.Document) -> URL {
        let safe = doc.name.replacingOccurrences(of: "/", with: "-")
        let dir = folder.appending(path: doc.id)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: safe.lowercased().hasSuffix(".pdf") ? safe : safe + ".pdf")
    }

    /// File sul telefono (scaricato la prima volta, poi dalla cache: anche offline).
    static func local(_ doc: SiteDetail.Document) async throws -> URL {
        let dest = fileURL(doc)
        if FileManager.default.fileExists(atPath: dest.path) { return dest }
        guard let remote = URL(string: doc.url) else { throw SiteDocumentError("Indirizzo non valido") }
        let (tmp, response) = try await URLSession.shared.download(from: remote)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw SiteDocumentError("Download non riuscito") }
        try? FileManager.default.removeItem(at: dest)
        try FileManager.default.moveItem(at: tmp, to: dest)
        return dest
    }

    static func forget(_ doc: SiteDetail.Document) {
        try? FileManager.default.removeItem(at: folder.appending(path: doc.id))
    }

    static func uploadToCloudinary(_ endpoint: String, fields: [String: String], data: Data, filename: String) async throws -> String {
        guard let url = URL(string: endpoint) else { throw SiteDocumentError("Caricamento non disponibile") }
        let boundary = "dieffe-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 300
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        for (key, value) in fields {
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(key)\"\r\n\r\n\(value)\r\n".utf8))
        }
        let name = filename.replacingOccurrences(of: "\"", with: "")
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(name)\"\r\nContent-Type: application/pdf\r\n\r\n".utf8))
        body.append(data)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        let (respData, response) = try await URLSession.shared.upload(for: req, from: body)
        let json = (try? JSONSerialization.jsonObject(with: respData)) as? [String: Any] ?? [:]
        guard (response as? HTTPURLResponse)?.statusCode == 200, let publicId = json["public_id"] as? String else {
            let message = (json["error"] as? [String: Any])?["message"] as? String
            throw SiteDocumentError(message ?? "Caricamento non riuscito")
        }
        return publicId
    }
}
