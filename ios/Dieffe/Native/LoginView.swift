import SwiftUI

/// Accesso nativo (POST /api/auth/login). Il cookie di sessione finisce
/// nell'archivio condiviso con le pagine web: un solo login per tutta l'app.
struct LoginView: View {
    @Environment(AppModel.self) private var model
    @State private var email = ""
    @State private var password = ""
    @State private var loading = false
    @State private var error: String?
    @FocusState private var focus: Field?

    private enum Field { case email, password }

    private var canSubmit: Bool { !email.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty && !loading }

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 12) {
                    Image("Logo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 88, height: 88)
                    Text("Dieffe Preventivi")
                        .font(.largeTitle.bold())
                    Text("Gestione preventivi edili")
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 72)

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focus = .password }
                        .loginField()
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .focused($focus, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { if canSubmit { login() } }
                        .loginField()

                    if let error {
                        Label(error, systemImage: "exclamationmark.circle.fill")
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 4)
                    }
                }

                Button(action: login) {
                    Group {
                        if loading { ProgressView() } else { Text("Accedi").fontWeight(.semibold) }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.glassProminent)
                .controlSize(.large)
                .disabled(!canSubmit)
            }
            .padding(.horizontal, 28)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color(.systemGroupedBackground))
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

private extension View {
    func loginField() -> some View {
        padding(.horizontal, 16)
            .frame(height: 52)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
