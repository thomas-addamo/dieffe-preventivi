import SwiftUI
import WebKit

/// Impostazioni dell'app iPhone: in un foglio (dal menu profilo) oppure
/// dentro la navigazione (Altro › App iPhone, Profilo › App iPhone).
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var embedded = false
    @State private var confirmReset = false

    var body: some View {
        if embedded {
            form
        } else {
            NavigationStack {
                form.toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Fine", systemImage: "checkmark") { dismiss() }
                    }
                }
            }
        }
    }

    private var form: some View {
        @Bindable var lock = model.lock

        return Form {
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
                Button("Ricarica i dati") {
                    model.dataChanged()
                    if !embedded { dismiss() }
                }
                Button("Svuota cache dell'app", role: .destructive) { confirmReset = true }
            } footer: {
                Text("La cache si ricrea da sola. Non serve rifare l'accesso.")
            }
        }
        .navigationTitle("App iPhone")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Svuotare la cache?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Svuota cache", role: .destructive) { clearCache() }
        }
    }

    /// Cancella cache e file temporanei, NON i cookie (resta l'accesso).
    private func clearCache() {
        let types: Set<String> = [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache,
                                  WKWebsiteDataTypeFetchCache, WKWebsiteDataTypeOfflineWebApplicationCache]
        WKWebsiteDataStore.default().removeData(ofTypes: types, modifiedSince: .distantPast) {
            model.dataChanged()
        }
        try? FileManager.default.removeItem(at: FileManager.default.temporaryDirectory.appendingPathComponent("Documenti"))
        if !embedded { dismiss() }
    }
}
