import SwiftUI

/// Aspetto dell'app: segue iOS oppure chiaro/scuro fissi.
enum Appearance: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: "Automatico"
        case .light: "Chiaro"
        case .dark: "Scuro"
        }
    }

    var symbol: String {
        switch self {
        case .system: "circle.lefthalf.filled"
        case .light: "sun.max"
        case .dark: "moon"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

/// Profilo nativo (come src/app/(app)/profilo/ProfiloClient.tsx): identità,
/// aspetto, sicurezza, password, esci.
struct ProfileView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @AppStorage("appearance") private var appearance: Appearance = .system
    var inSheet = false
    @State private var changingPassword = false
    @State private var confirmLogout = false

    var body: some View {
        @Bindable var lock = model.lock
        let user = model.currentUser

        List {
            Section {
                HStack(spacing: 16) {
                    InitialsAvatar(name: user?.name ?? "", size: 64)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(user?.name ?? "—")
                            .font(.title3.weight(.semibold))
                        if let email = user?.email {
                            Text(email)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        if let user {
                            Label(user.roleLabel, systemImage: "checkmark.shield.fill")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .foregroundStyle(Color.accentColor)
                                .background(Color.accentColor.opacity(0.12), in: Capsule())
                        }
                    }
                }
                .padding(.vertical, 6)
            }

            Section("Aspetto") {
                Picker("Tema", selection: $appearance) {
                    ForEach(Appearance.allCases) { Label($0.label, systemImage: $0.symbol).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }

            Section {
                Toggle(isOn: $lock.isEnabled) {
                    Label("Blocca con \(AppLock.biometryName)", systemImage: "faceid")
                }
                .disabled(!AppLock.biometryAvailable)
                Button {
                    changingPassword = true
                } label: {
                    Label("Cambia password", systemImage: "key")
                }
            } header: {
                Text("Sicurezza")
            } footer: {
                Text("\(AppLock.biometryName) all'apertura e quando torni all'app dopo più di un minuto.")
            }

            Section("App") {
                NavigationLink {
                    SettingsView(embedded: true)
                } label: {
                    Label("App iPhone", systemImage: "iphone")
                }
                LabeledContent("Versione", value: "\(AppConfig.version) (\(AppConfig.build))")
            }

            Section {
                Button(role: .destructive) {
                    confirmLogout = true
                } label: {
                    Label("Esci", systemImage: "rectangle.portrait.and.arrow.right")
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Profilo")
        .navigationBarTitleDisplayMode(inSheet ? .inline : .large)
        .toolbar {
            if inSheet {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine", systemImage: "checkmark") { dismiss() }
                }
            }
        }
        .sheet(isPresented: $changingPassword) {
            ChangePasswordView()
        }
        .confirmationDialog("Vuoi uscire?", isPresented: $confirmLogout, titleVisibility: .visible) {
            Button("Esci", role: .destructive) {
                dismiss()
                Task { await model.logout() }
            }
        } message: {
            Text("Per rientrare servono email e password.")
        }
    }
}

/// Cambio password (POST /api/auth/change-password), con le regole del sito:
/// almeno 8 caratteri, una lettera e un numero.
struct ChangePasswordView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var current = ""
    @State private var new = ""
    @State private var repeatNew = ""
    @State private var saving = false
    @State private var error: String?
    @State private var done = false

    private var rules: [(String, Bool)] {
        [("Almeno 8 caratteri", new.count >= 8),
         ("Almeno una lettera", new.contains { $0.isLetter }),
         ("Almeno un numero", new.contains { $0.isNumber }),
         ("Le due password coincidono", !new.isEmpty && new == repeatNew)]
    }

    private var valid: Bool { !current.isEmpty && rules.allSatisfy(\.1) && new != current }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("Password attuale", text: $current)
                        .textContentType(.password)
                }
                Section {
                    SecureField("Nuova password", text: $new)
                        .textContentType(.newPassword)
                    SecureField("Ripeti la nuova password", text: $repeatNew)
                        .textContentType(.newPassword)
                } footer: {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(rules, id: \.0) { rule in
                            Label(rule.0, systemImage: rule.1 ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(rule.1 ? .green : .secondary)
                        }
                    }
                    .padding(.top, 4)
                }
                if let error {
                    Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
                }
            }
            .navigationTitle("Cambia password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("Salva", systemImage: "checkmark") { save() }.disabled(!valid)
                    }
                }
            }
            .alert("Password aggiornata", isPresented: $done) {
                Button("OK") { dismiss() }
            }
        }
    }

    private func save() {
        saving = true
        error = nil
        Task {
            defer { saving = false }
            do {
                try await APIClient.shared.send("POST", "/api/auth/change-password",
                                                json: ["currentPassword": current, "newPassword": new],
                                                as: Empty.self, sessionOn401: false)
                done = true
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
