import SwiftUI
import UIKit

/// Utenti (solo admin, come src/app/(app)/utenti): elenco, nuovo utente,
/// ruolo, attiva/disattiva, nuova password, ultimi accessi, elimina.
/// L'accesso come altro utente resta solo sul sito.
struct UsersView: View {
    @Environment(AppModel.self) private var model
    @State private var users: [TeamUser]?
    @State private var error: String?
    @State private var creating = false

    var body: some View {
        Group {
            if let users {
                List {
                    ForEach(TeamUser.roles, id: \.0) { role, label, _ in
                        let group = users.filter { $0.role == role }
                        if !group.isEmpty {
                            Section(label) {
                                ForEach(group) { user in
                                    NavigationLink {
                                        UserDetailView(user: user) { await load() }
                                    } label: {
                                        UserRow(user: user, isMe: user.id == model.currentUser?.id)
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                LoadingOrError(error: error) { await load() }
            }
        }
        .navigationTitle("Utenti")
        .refreshable { await load() }
        .task { await load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Nuovo utente", systemImage: "person.badge.plus") { creating = true }
            }
        }
        .sheet(isPresented: $creating) {
            NewUserView { await load() }
        }
    }

    private func load() async {
        do {
            users = try await APIClient.shared.get("/api/users")
            error = nil
        } catch APIError.unauthorized {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error.localizedDescription
        }
    }
}

private struct UserRow: View {
    let user: TeamUser
    let isMe: Bool

    var body: some View {
        HStack(spacing: 12) {
            InitialsAvatar(name: user.name, size: 40)
                .opacity(user.disabled ? 0.4 : 1)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(user.name).font(.body.weight(.semibold))
                    if isMe { Text("Tu").font(.caption2.weight(.bold)).padding(.horizontal, 6).background(.quaternary, in: Capsule()) }
                    if user.disabled { Text("Disattivato").font(.caption2.weight(.semibold)).foregroundStyle(.red) }
                }
                Text(user.email).font(.caption).foregroundStyle(.secondary)
                Text(user.lastLoginAt.map { "Ultimo accesso \(Format.date($0))" } ?? "Mai entrato")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

struct UserDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State var user: TeamUser
    let reload: () async -> Void
    @State private var log: [AccessLogEntry]?
    @State private var name = ""
    @State private var resettingPassword = false
    @State private var confirmDelete = false
    @State private var error: String?

    private var isMe: Bool { user.id == model.currentUser?.id }

    var body: some View {
        Form {
            Section {
                HStack(spacing: 14) {
                    InitialsAvatar(name: user.name, size: 56)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(user.name).font(.title3.weight(.semibold))
                        Text(user.email).font(.subheadline).foregroundStyle(.secondary).textSelection(.enabled)
                    }
                }
                .padding(.vertical, 4)
            }
            Section("Nome") {
                TextField("Nome", text: $name)
                    .onSubmit { update(["name": name.trimmingCharacters(in: .whitespaces)]) { $0.name = name } }
                if name.trimmingCharacters(in: .whitespaces) != user.name {
                    Button("Salva nome") { update(["name": name.trimmingCharacters(in: .whitespaces)]) { $0.name = name } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).count < 2)
                }
            }
            Section {
                Picker("Ruolo", selection: Binding(get: { user.role }, set: { role in update(["role": role]) { $0.role = role } })) {
                    ForEach(TeamUser.roles, id: \.0) { Text($0.1).tag($0.0) }
                }
                .disabled(isMe)
                Toggle("Account attivo", isOn: Binding(
                    get: { !user.disabled },
                    set: { active in update(["disabled": !active]) { $0.disabled = !active } }
                ))
                .disabled(isMe)
            } header: {
                Text("Accesso")
            } footer: {
                Text(isMe ? "Non puoi cambiare ruolo o disattivare il tuo account."
                     : TeamUser.roles.first { $0.0 == user.role }?.2 ?? "")
            }
            Section {
                Button("Imposta una nuova password", systemImage: "key") { resettingPassword = true }
            } footer: {
                Text("Al prossimo accesso l'utente dovrà sceglierne una sua. Le sue sessioni aperte vengono chiuse.")
            }
            Section("Ultimi accessi") {
                if let log {
                    if log.isEmpty { Text("Nessun accesso registrato").foregroundStyle(.secondary) }
                    ForEach(log) { entry in
                        HStack {
                            Image(systemName: entry.success ? "checkmark.circle.fill" : "xmark.octagon.fill")
                                .foregroundStyle(entry.success ? .green : .red)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(entry.device).font(.subheadline)
                                Text([entry.loginAt.map(Format.date), entry.ipAddress].compactMap { $0 }.joined(separator: " · "))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                } else {
                    ProgressView()
                }
            }
            if let error {
                Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
            }
            if !isMe {
                Section {
                    Button("Elimina utente", systemImage: "trash", role: .destructive) { confirmDelete = true }
                }
            }
        }
        .navigationTitle(user.name)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { name = user.name }
        .task { log = (try? await APIClient.shared.get("/api/admin/users/\(user.id)/access-log")) ?? [] }
        .sheet(isPresented: $resettingPassword) {
            PasswordResetView(user: user)
        }
        .confirmationDialog("Eliminare \(user.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Elimina utente", role: .destructive) { delete() }
        } message: {
            Text("L'account viene eliminato. Per bloccare l'accesso senza perdere lo storico, disattivalo.")
        }
    }

    private func update(_ body: [String: Any?], local: @escaping (inout TeamUser) -> Void) {
        let before = user
        local(&user)
        error = nil
        Task {
            do {
                try await APIClient.shared.send("PATCH", "/api/users/\(user.id)", json: body, as: Empty.self)
                await reload()
            } catch {
                user = before
                name = before.name
                self.error = error.localizedDescription
            }
        }
    }

    private func delete() {
        Task {
            do {
                try await APIClient.shared.delete("/api/users/\(user.id)")
                await reload()
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

/// Regole della password del sito (src/lib/password-policy.ts).
enum PasswordPolicy {
    static func problems(_ p: String) -> [String] {
        var out: [String] = []
        if p.count < 8 { out.append("Almeno 8 caratteri") }
        if !p.contains(where: \.isLetter) { out.append("Almeno una lettera") }
        if !p.contains(where: \.isNumber) { out.append("Almeno un numero") }
        return out
    }

    /// Password provvisoria leggibile, conforme alle regole.
    static func generate() -> String {
        let letters = Array("abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ")
        let digits = Array("23456789")
        let body = (0..<8).map { _ in letters.randomElement()! } + (0..<3).map { _ in digits.randomElement()! }
        return String(body.shuffled())
    }
}

private struct PasswordResetView: View {
    @Environment(\.dismiss) private var dismiss
    let user: TeamUser
    @State private var password = PasswordPolicy.generate()
    @State private var saving = false
    @State private var error: String?
    @State private var done = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        TextField("Nuova password", text: $password)
                            .font(.body.monospaced())
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button("Genera", systemImage: "arrow.triangle.2.circlepath") { password = PasswordPolicy.generate() }
                            .labelStyle(.iconOnly)
                    }
                } footer: {
                    let problems = PasswordPolicy.problems(password)
                    Text(problems.isEmpty ? "Comunicala a \(user.name): al primo accesso dovrà cambiarla." : problems.joined(separator: " · "))
                        .foregroundStyle(problems.isEmpty ? Color.secondary : Color.red)
                }
                if let error { Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) } }
            }
            .navigationTitle("Nuova password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla", systemImage: "xmark") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button("Imposta", systemImage: "checkmark") { save() }.disabled(!PasswordPolicy.problems(password).isEmpty)
                    }
                }
            }
            .alert("Password impostata", isPresented: $done) {
                Button("Copia e chiudi") { UIPasteboard.general.string = password; dismiss() }
            } message: {
                Text(password)
            }
        }
        .presentationDetents([.medium])
    }

    private func save() {
        saving = true
        Task {
            defer { saving = false }
            do {
                try await APIClient.shared.send("PATCH", "/api/users/\(user.id)", json: ["password": password], as: Empty.self)
                done = true
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

private struct NewUserView: View {
    @Environment(\.dismiss) private var dismiss
    let reload: () async -> Void
    @State private var name = ""
    @State private var email = ""
    @State private var password = PasswordPolicy.generate()
    @State private var role = "editor"
    @State private var saving = false
    @State private var error: String?

    private var valid: Bool {
        name.trimmingCharacters(in: .whitespaces).count >= 2
            && email.wholeMatch(of: /[^@\s]+@[^@\s]+\.[^@\s]+/) != nil
            && PasswordPolicy.problems(password).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Persona") {
                    TextField("Nome e cognome", text: $name).textContentType(.name)
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                Section {
                    Picker("Ruolo", selection: $role) {
                        ForEach(TeamUser.roles, id: \.0) { Text($0.1).tag($0.0) }
                    }
                } footer: {
                    Text(TeamUser.roles.first { $0.0 == role }?.2 ?? "")
                }
                Section {
                    HStack {
                        TextField("Password provvisoria", text: $password)
                            .font(.body.monospaced())
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button("Genera", systemImage: "arrow.triangle.2.circlepath") { password = PasswordPolicy.generate() }
                            .labelStyle(.iconOnly)
                    }
                } header: {
                    Text("Password provvisoria")
                } footer: {
                    let problems = PasswordPolicy.problems(password)
                    Text(problems.isEmpty ? "Al primo accesso dovrà sceglierne una sua." : problems.joined(separator: " · "))
                        .foregroundStyle(problems.isEmpty ? Color.secondary : Color.red)
                }
                if let error { Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) } }
            }
            .navigationTitle("Nuovo utente")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla", systemImage: "xmark") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button("Crea", systemImage: "checkmark") { save() }.disabled(!valid)
                    }
                }
            }
        }
    }

    private func save() {
        saving = true
        error = nil
        Task {
            defer { saving = false }
            do {
                try await APIClient.shared.send("POST", "/api/users", json: [
                    "name": name.trimmingCharacters(in: .whitespaces), "email": email.trimmingCharacters(in: .whitespaces),
                    "password": password, "role": role,
                ], as: Empty.self)
                UIPasteboard.general.string = password
                await reload()
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
