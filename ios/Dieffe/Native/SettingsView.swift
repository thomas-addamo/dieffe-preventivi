import SwiftUI
import WebKit

/// Impostazioni dell'app iPhone (dal sito: Altro › App iPhone).
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var confirmReset = false

    var body: some View {
        @Bindable var lock = model.lock

        NavigationStack {
            Form {
                Section {
                    Toggle("Blocca con \(AppLock.biometryName)", isOn: $lock.isEnabled)
                        .disabled(!AppLock.biometryAvailable)
                } footer: {
                    Text("Chiede \(AppLock.biometryName) all'apertura e quando torni all'app dopo più di un minuto.")
                }

                Section("Informazioni") {
                    LabeledContent("Versione app", value: "\(AppConfig.version) (\(AppConfig.build))")
                    LabeledContent("Server", value: AppConfig.baseURL.host() ?? "")
                }

                Section {
                    Button("Ricarica tutte le sezioni") {
                        AppTab.sections.forEach { model.page($0).reload() }
                        dismiss()
                    }
                    Button("Svuota cache dell'app", role: .destructive) { confirmReset = true }
                } footer: {
                    Text("La cache si ricrea da sola. Non serve rifare l'accesso.")
                }
            }
            .navigationTitle("App iPhone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", systemImage: "checkmark") { dismiss() }
                }
            }
            .confirmationDialog("Svuotare la cache?", isPresented: $confirmReset, titleVisibility: .visible) {
                Button("Svuota cache", role: .destructive) { clearCache() }
            }
        }
    }

    /// Cancella cache e file temporanei, NON i cookie (resta l'accesso).
    private func clearCache() {
        let types: Set<String> = [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache,
                                  WKWebsiteDataTypeFetchCache, WKWebsiteDataTypeOfflineWebApplicationCache]
        WKWebsiteDataStore.default().removeData(ofTypes: types, modifiedSince: .distantPast) {
            AppTab.sections.forEach { model.page($0).reload() }
        }
        try? FileManager.default.removeItem(at: FileManager.default.temporaryDirectory.appendingPathComponent("Documenti"))
        dismiss()
    }
}
