import SwiftUI

/// "Firma del cliente" nell'editor (come SignatureSection in
/// src/components/quote-editor/QuoteEditor.tsx): firma disegnata dal cliente
/// sul link pubblico, oppure il suo rifiuto. Il tocco apre i dettagli.
struct SignatureSection: View {
    let editor: QuoteEditorModel
    let quote: QuoteDetail
    @State private var showDetail = false

    var body: some View {
        if let signature = quote.signature {
            Section {
                Button { showDetail = true } label: {
                    SignatureSummary(signature: signature)
                }
                .tint(.primary)
            } header: {
                Text(signature.accepted ? "Firma del cliente" : "Risposta del cliente")
            }
            .sheet(isPresented: $showDetail) {
                SignatureDetailView(editor: editor, signature: signature)
            }
            .task { if PreviewOptions.editorSheet == "signature" { showDetail = true } }
        } else if quote.status == .accepted {
            Section("Firma del cliente") {
                Label("Accettato senza firma digitale: lo stato è stato impostato a mano.", systemImage: "signature")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct SignatureSummary: View {
    let signature: QuoteSignature

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: signature.accepted ? "checkmark.seal.fill" : "xmark.seal.fill")
                    .font(.title3)
                    .foregroundStyle(signature.accepted ? .green : .red)
                VStack(alignment: .leading, spacing: 1) {
                    Text(signature.signerName).font(.subheadline.weight(.semibold))
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
            }
            if let image = signature.uiImage {
                SignatureImage(image: image)
                    .frame(height: 84)
            } else if signature.accepted {
                Text("Il cliente ha accettato senza disegnare la firma.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private var subtitle: String {
        let verb = signature.accepted ? (signature.uiImage == nil ? "Accettato" : "Accettato e firmato") : "Rifiutato"
        guard let date = signature.date else { return verb }
        return "\(verb) il \(date.formatted(.dateTime.day().month().year().hour().minute()))"
    }
}

/// La firma su fondo bianco anche in modalità scura: il tratto è nero.
private struct SignatureImage: View {
    let image: UIImage

    var body: some View {
        Image(uiImage: image)
            .resizable()
            .scaledToFit()
            .padding(10)
            .frame(maxWidth: .infinity)
            .background(.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(.separator))
            .accessibilityLabel("Firma del cliente")
    }
}

struct SignatureDetailView: View {
    let editor: QuoteEditorModel
    let signature: QuoteSignature
    @Environment(\.dismiss) private var dismiss
    @State private var confirmRevoke = false
    @State private var revoking = false

    var body: some View {
        NavigationStack {
            List {
                if let image = signature.uiImage {
                    Section {
                        SignatureImage(image: image)
                            .frame(height: 170)
                            .listRowInsets(EdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12))
                    } footer: {
                        Text("Disegnata dal cliente sul link pubblico del preventivo.")
                    }
                } else if signature.accepted {
                    Section {
                        Label("Il cliente ha accettato senza disegnare la firma.", systemImage: "signature")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Dettagli") {
                    LabeledContent("Firmatario", value: signature.signerName)
                    if let email = signature.signerEmail, !email.isEmpty {
                        LabeledContent("Email", value: email)
                    }
                    LabeledContent("Esito") {
                        HStack(spacing: 6) {
                            Image(systemName: signature.accepted ? "checkmark.seal.fill" : "xmark.seal.fill")
                            Text(signature.accepted ? "Accettato" : "Rifiutato")
                        }
                        .foregroundStyle(signature.accepted ? .green : .red)
                    }
                    if let date = signature.date {
                        LabeledContent("Data e ora", value: date.formatted(.dateTime.day().month(.wide).year().hour().minute()))
                    }
                }

                Section("Registrazione") {
                    if let ip = signature.ipAddress, !ip.isEmpty {
                        LabeledContent("Indirizzo IP") { Text(ip).monospaced() }
                    }
                    LabeledContent("Consenso IP", value: signature.ipConsent == true ? "Esplicito" : "Non dato")
                    LabeledContent("Consenso privacy", value: signature.privacyConsent == true ? "Dato" : "Non dato")
                }

                if editor.role == "admin" {
                    Section {
                        Button(role: .destructive) { confirmRevoke = true } label: {
                            HStack {
                                Label(signature.accepted ? "Annulla accettazione" : "Annulla rifiuto",
                                      systemImage: "arrow.uturn.backward")
                                if revoking { Spacer(); ProgressView() }
                            }
                        }
                        .tint(.red)
                        .disabled(revoking)
                    } footer: {
                        Text("Il preventivo torna «Inviato» e il link per il cliente viene disattivato.")
                    }
                }
            }
            .navigationTitle(signature.accepted ? "Firma del cliente" : "Risposta del cliente")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Chiudi", systemImage: "xmark") { dismiss() }
                }
                if let image = signature.uiImage {
                    ToolbarItem(placement: .primaryAction) {
                        ShareLink(item: Image(uiImage: image),
                                  preview: SharePreview("Firma di \(signature.signerName)", image: Image(uiImage: image))) {
                            Label("Condividi firma", systemImage: "square.and.arrow.up")
                        }
                    }
                }
            }
            .confirmationDialog(signature.accepted ? "Annullare l'accettazione?" : "Annullare il rifiuto?",
                                isPresented: $confirmRevoke, titleVisibility: .visible) {
                Button("Annulla e torna a «Inviato»", role: .destructive) { revoke() }
            } message: {
                Text("La firma viene eliminata. Per farlo firmare di nuovo crea un nuovo link per il cliente.")
            }
        }
    }

    private func revoke() {
        revoking = true
        Task {
            let ok = await editor.revokeSignature()
            revoking = false
            if ok { dismiss() }
        }
    }
}

extension QuoteSignature {
    /// nil anche quando il riquadro è stato lasciato vuoto (PNG tutto trasparente).
    var uiImage: UIImage? {
        guard let image = imageData.flatMap(UIImage.init(data:)), !image.isBlank else { return nil }
        return image
    }
}

private extension UIImage {
    /// Nessun pixel visibile: si controlla una copia ridotta del disegno.
    var isBlank: Bool {
        guard let cgImage else { return true }
        let width = 120, height = max(1, Int(Double(cgImage.height) / Double(cgImage.width) * 120))
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
                                          bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn else { return false }
        // Pixel con alfa e non bianchi (il canvas può avere fondo bianco).
        for i in stride(from: 0, to: pixels.count, by: 4) where pixels[i + 3] > 24 {
            if min(pixels[i], pixels[i + 1], pixels[i + 2]) < 200 { return false }
        }
        return true
    }
}
