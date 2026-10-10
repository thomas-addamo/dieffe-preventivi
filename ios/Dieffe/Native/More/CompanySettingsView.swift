import PhotosUI
import SwiftUI
import UIKit

/// Impostazioni azienda (solo admin, come la parte aziendale di
/// src/app/(app)/impostazioni): dati e logo, preventivi, email, numerazione,
/// notifiche del team e AI. Le preferenze personali sono nel Profilo.
struct CompanySettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var settings: CompanySettings?
    @State private var saved: CompanySettings?
    @State private var error: String?
    @State private var saving = false
    @State private var logoItem: PhotosPickerItem?
    @State private var logoWorking = false
    @State private var confirmRemoveLogo = false
    @State private var resetting = false
    @State private var resetText = ""
    @State private var savedAlert = false

    private var dirty: Bool { settings != nil && settings != saved }

    var body: some View {
        Group {
            if settings != nil {
                form
            } else {
                LoadingOrError(error: error) { await load() }
            }
        }
        .navigationTitle("Impostazioni azienda")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                if saving {
                    ProgressView()
                } else {
                    Button("Salva", systemImage: "checkmark") { save() }.disabled(!dirty)
                }
            }
        }
        .alert("Impostazioni salvate", isPresented: $savedAlert) { Button("OK") {} }
    }

    private func binding<T>(_ key: WritableKeyPath<CompanySettings, T>, _ fallback: T) -> Binding<T> {
        Binding(get: { settings?[keyPath: key] ?? fallback }, set: { settings?[keyPath: key] = $0 })
    }

    private func text(_ key: WritableKeyPath<CompanySettings, String?>) -> Binding<String> {
        Binding(get: { settings?[keyPath: key] ?? "" }, set: { settings?[keyPath: key] = $0.isEmpty ? nil : $0 })
    }

    private var form: some View {
        Form {
            Section {
                HStack(spacing: 16) {
                    Group {
                        if let path = settings?.logoUrl, let url = URL(string: path) {
                            AsyncImage(url: url) { image in
                                image.resizable().scaledToFit()
                            } placeholder: { ProgressView() }
                        } else {
                            Image(systemName: "building.2").font(.largeTitle).foregroundStyle(.secondary)
                        }
                    }
                    .frame(width: 88, height: 64)
                    .padding(8)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(.quaternary))
                    VStack(alignment: .leading, spacing: 8) {
                        PhotosPicker(selection: $logoItem, matching: .images) {
                            Label(settings?.logoPath == nil ? "Carica logo" : "Cambia logo", systemImage: "photo")
                        }
                        if settings?.logoPath != nil {
                            Button("Rimuovi logo", systemImage: "trash", role: .destructive) { confirmRemoveLogo = true }
                        }
                    }
                    .buttonStyle(.borderless)
                    .disabled(logoWorking)
                    if logoWorking { ProgressView() }
                }
            } header: {
                Text("Logo")
            } footer: {
                Text("Compare nell'intestazione dei PDF. PNG o JPG, sfondo chiaro.")
            }

            Section("Dati azienda") {
                field("Ragione sociale", binding(\.companyName, ""))
                field("P.IVA", text(\.vatNumber)).font(.body.monospaced())
                field("Telefono", text(\.phone)).keyboardType(.phonePad)
                field("Email", text(\.email)).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                field("Sito web", text(\.website)).keyboardType(.URL).textInputAutocapitalization(.never)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Indirizzo").font(.caption).foregroundStyle(.secondary)
                    TextField("Indirizzo", text: text(\.address), axis: .vertical)
                }
            }

            Section("Preventivi") {
                Picker("IVA predefinita", selection: binding(\.defaultVatRate, 22)) {
                    ForEach(QuoteOptions.vatRates, id: \.0) { Text($0.1).tag($0.0) }
                }
                Picker("Modello PDF", selection: binding(\.pdfTemplate, "classic")) {
                    Text("Classico").tag("classic")
                    Text("Moderno").tag("modern")
                    Text("Minimale").tag("minimal")
                }
                ColorPicker("Colore primario", selection: hexColor(\.primaryColor), supportsOpacity: false)
                ColorPicker("Colore accento", selection: hexColor(\.accentColor), supportsOpacity: false)
                TextField("Condizioni di pagamento predefinite", text: text(\.defaultPaymentTerms), axis: .vertical)
                    .lineLimit(2...6)
                TextField("Note predefinite", text: text(\.defaultQuoteNotes), axis: .vertical)
                    .lineLimit(2...6)
            }

            Section {
                TextField("Indirizzo mittente", text: text(\.emailFromAddress))
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
            } header: {
                Text("Email")
            } footer: {
                Text("Mittente delle email inviate dall'app (es. preventivi@impresadieffe.it).")
            }

            Section {
                TextField("Prefisso", text: Binding(
                    get: { settings?.quotePrefix ?? "" },
                    set: { settings?.quotePrefix = String($0.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(6)) }
                ))
                .font(.body.monospaced())
                .textInputAutocapitalization(.characters)
                LabeledContent("Anteprima",
                               value: "\(settings?.quotePrefix.isEmpty == false ? settings!.quotePrefix : "PREV")-\(Calendar.current.component(.year, from: .now))-001")
                Button("Azzera il contatore dell'anno", role: .destructive) { resetting = true }
            } header: {
                Text("Numerazione preventivi")
            } footer: {
                Text("Dopo l'azzeramento il prossimo preventivo avrà il numero 001. Non si può annullare.")
            }

            Section {
                Toggle("Avvisa il team quando un preventivo è accettato", isOn: binding(\.notifyTeamOnAccept, true))
                Toggle("Avvisa il team quando un preventivo è rifiutato", isOn: binding(\.notifyTeamOnReject, false))
                Toggle("Assistente AI attivo per tutto il team", isOn: binding(\.aiEnabled, true))
            } header: {
                Text("Team")
            } footer: {
                Text("Valgono per tutti gli utenti.")
            }

            if let error {
                Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
            }
        }
        .onChange(of: logoItem) { _, item in if let item { uploadLogo(item) } }
        .confirmationDialog("Rimuovere il logo?", isPresented: $confirmRemoveLogo, titleVisibility: .visible) {
            Button("Rimuovi", role: .destructive) { removeLogo() }
        }
        .alert("Azzerare il contatore?", isPresented: $resetting) {
            TextField("Scrivi RESET", text: $resetText)
            Button("Azzera", role: .destructive) { resetCounter() }
            Button("Annulla", role: .cancel) { resetText = "" }
        } message: {
            Text("Scrivi RESET per confermare. Il prossimo preventivo avrà il numero 001.")
        }
    }

    private func field(_ label: String, _ value: Binding<String>) -> some View {
        LabeledContent(label) {
            TextField(label, text: value).multilineTextAlignment(.trailing)
        }
    }

    private func hexColor(_ key: WritableKeyPath<CompanySettings, String>) -> Binding<Color> {
        Binding(
            get: { Color(hex: settings?[keyPath: key] ?? "#1e40af") },
            set: { settings?[keyPath: key] = $0.hex }
        )
    }

    // MARK: Azioni

    private func load() async {
        do {
            let loaded: CompanySettings = try await APIClient.shared.get("/api/settings")
            settings = loaded
            saved = loaded
            error = nil
        } catch APIError.unauthorized {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error.localizedDescription
        }
    }

    private func save() {
        guard let settings else { return }
        guard !settings.companyName.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "La ragione sociale è obbligatoria."
            return
        }
        saving = true
        error = nil
        Task {
            defer { saving = false }
            do {
                let updated: CompanySettings = try await APIClient.shared.send("PUT", "/api/settings", json: settings.json)
                self.settings = updated
                saved = updated
                savedAlert = true
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private func uploadLogo(_ item: PhotosPickerItem) {
        logoWorking = true
        Task {
            defer { logoWorking = false; logoItem = nil }
            do {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let png = UIImage(data: data)?.pngData() else { throw APIError.server("Immagine non valida.") }
                let json = try await APIClient.shared.upload("/api/settings/logo", data: png, filename: "logo.png", mimeType: "image/png")
                // La risposta contiene l'indirizzo dell'immagine; logoPath serve solo a sapere che c'è.
                let url = json["logoPath"] as? String
                settings?.logoUrl = url
                saved?.logoUrl = url
                settings?.logoPath = url
                saved?.logoPath = url
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private func removeLogo() {
        logoWorking = true
        Task {
            defer { logoWorking = false }
            do {
                try await APIClient.shared.delete("/api/settings/logo")
                settings?.logoPath = nil
                saved?.logoPath = nil
                settings?.logoUrl = nil
                saved?.logoUrl = nil
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private func resetCounter() {
        guard resetText == "RESET" else {
            error = "Contatore non azzerato: bisognava scrivere RESET."
            resetText = ""
            return
        }
        resetText = ""
        Task {
            do {
                try await APIClient.shared.send("POST", "/api/settings/reset-counter", as: Empty.self)
                model.lastError = "Contatore azzerato: il prossimo preventivo avrà il numero 001."
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

extension Color {
    init(hex: String) {
        let clean = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let value = UInt64(clean, radix: 16) ?? 0x1e40af
        self.init(red: Double((value >> 16) & 0xff) / 255, green: Double((value >> 8) & 0xff) / 255,
                  blue: Double(value & 0xff) / 255)
    }

    var hex: String {
        let c = UIColor(self).cgColor.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil)?.components ?? [0, 0, 0]
        let r = Int((c[0] * 255).rounded()), g = Int((c[safe: 1] ?? 0) * 255), b = Int((c[safe: 2] ?? 0) * 255)
        return String(format: "#%02x%02x%02x", r, g, b)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
