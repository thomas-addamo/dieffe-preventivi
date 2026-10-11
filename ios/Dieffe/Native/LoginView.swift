import SwiftUI

/// Accesso nativo (POST /api/auth/login). La sessione va nel Portachiavi e
/// nell'archivio delle pagine web: un solo login per tutta l'app.
struct LoginView: View {
    @Environment(AppModel.self) private var model
    @State private var email = ""
    @State private var password = ""
    @State private var loading = false
    @State private var error: String?
    @FocusState private var focus: Field?

    private enum Field { case email, password }

    private var canSubmit: Bool { !email.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty && !loading }

    @State private var showPassword = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                VStack(spacing: 14) {
                    Image("Logo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 72, height: 72)
                        .shadow(color: .black.opacity(0.12), radius: 12, y: 6)
                    VStack(spacing: 4) {
                        Text("Bentornato")
                            .font(.title.bold())
                        Text("Accedi a Dieffe Preventivi")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.top, 84)
                .padding(.bottom, 36)

                VStack(spacing: 0) {
                    field(symbol: "envelope") {
                        TextField("Email", text: $email)
                            .textContentType(.username)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focus, equals: .email)
                            .submitLabel(.next)
                            .onSubmit { focus = .password }
                    }
                    Divider().padding(.leading, 48)
                    field(symbol: "lock") {
                        Group {
                            if showPassword {
                                TextField("Password", text: $password)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                            } else {
                                SecureField("Password", text: $password)
                            }
                        }
                        .textContentType(.password)
                        .focused($focus, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { if canSubmit { login() } }
                        Button {
                            showPassword.toggle()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                                .frame(width: 32, height: 32)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(showPassword ? "Nascondi password" : "Mostra password")
                    }
                }
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                if let error {
                    Label(error, systemImage: "exclamationmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 6)
                        .padding(.top, 12)
                }

                Button(action: login) {
                    HStack(spacing: 8) {
                        if loading {
                            ProgressView().tint(.white)
                        } else {
                            Text("Accedi")
                            Image(systemName: "arrow.right")
                        }
                    }
                    .font(.body.weight(.semibold))
                    .frame(minWidth: 120)
                }
                .buttonStyle(.glassProminent)
                .disabled(!canSubmit)
                .padding(.top, 28)

                Text("Versione \(AppConfig.version)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .padding(.top, 48)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 440)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background {
            ZStack {
                Color(.systemGroupedBackground)
                RadialGradient(colors: [Color.accentColor.opacity(0.18), .clear],
                               center: .top, startRadius: 0, endRadius: 420)
            }
            .ignoresSafeArea()
        }
    }

    private func field<Content: View>(symbol: String, @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.secondary)
                .frame(width: 24)
            content()
        }
        .padding(.leading, 14)
        .padding(.trailing, 10)
        .frame(height: 54)
    }

    private func login() {
        loading = true
        error = nil
        focus = nil
        Task {
            defer { loading = false }
            do {
                let result = try await APIClient.shared.login(
                    email: email.trimmingCharacters(in: .whitespaces).lowercased(), password: password)
                password = ""
                model.didLogin(mustChangePassword: result.mustChangePassword ?? false)
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
