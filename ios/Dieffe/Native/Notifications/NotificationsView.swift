import SwiftUI

/// Centro notifiche (come la campanella del sito, src/components/shared/
/// NotificationBell.tsx): elenco, apri, segna come lette, elimina.
struct NotificationsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var items: [AppNotification]?
    @State private var error: String?
    @State private var onlyUnread = false

    var body: some View {
        NavigationStack {
            Group {
                if let items {
                    let visible = onlyUnread ? items.filter { !$0.isRead } : items
                    List {
                        ForEach(visible) { item in
                            Button { open(item) } label: { NotificationRow(item: item) }
                                .tint(.primary)
                                .swipeActions(edge: .trailing) {
                                    Button("Elimina", systemImage: "trash", role: .destructive) { delete(item) }
                                }
                                .swipeActions(edge: .leading) {
                                    if !item.isRead {
                                        Button("Letta", systemImage: "envelope.open") { markRead(item) }.tint(.blue)
                                    }
                                }
                        }
                    }
                    .overlay {
                        if visible.isEmpty {
                            ContentUnavailableView(onlyUnread ? "Nessuna notifica da leggere" : "Nessuna notifica",
                                                   systemImage: "bell.slash",
                                                   description: Text("Qui arrivano firme dei clienti, cambi di stato, assegnazioni e comunicazioni del team."))
                        }
                    }
                } else {
                    LoadingOrError(error: error) { await load() }
                }
            }
            .navigationTitle("Notifiche")
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await load() }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Chiudi", systemImage: "xmark") { dismiss() }
                }
                ToolbarItem(placement: .principal) {
                    Picker("Mostra", selection: $onlyUnread) {
                        Text("Tutte").tag(false)
                        Text("Da leggere").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 200)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Segna tutte come lette", systemImage: "checkmark.circle") { markAllRead() }
                        .disabled(items?.allSatisfy(\.isRead) ?? true)
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        struct Response: Decodable { let notifications: [AppNotification] }
        do {
            let r: Response = try await APIClient.shared.get("/api/notifications?limit=100")
            items = r.notifications
            error = nil
        } catch APIError.unauthorized {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error.localizedDescription
        }
    }

    private func open(_ item: AppNotification) {
        if !item.isRead { markRead(item) }
        guard let link = item.link, link.hasPrefix("/") else { return }
        dismiss()
        Task {
            try? await Task.sleep(for: .milliseconds(350))
            model.openPath(link)
        }
    }

    private func markRead(_ item: AppNotification) {
        guard let index = items?.firstIndex(where: { $0.id == item.id }) else { return }
        items?[index].readAt = "now"
        Task {
            _ = try? await APIClient.shared.send("PATCH", "/api/notifications/\(item.id)", as: Empty.self)
            model.dataChanged()
        }
    }

    private func markAllRead() {
        items = items?.map { var n = $0; if n.readAt == nil { n.readAt = "now" }; return n }
        Task {
            _ = try? await APIClient.shared.send("PATCH", "/api/notifications", as: Empty.self)
            model.dataChanged()
        }
    }

    private func delete(_ item: AppNotification) {
        withAnimation { items?.removeAll { $0.id == item.id } }
        Task {
            try? await APIClient.shared.delete("/api/notifications/\(item.id)")
            model.dataChanged()
        }
    }
}

struct AppNotification: Decodable, Identifiable {
    let id: String
    let type: String
    let title: String
    let body: String?
    let link: String?
    var readAt: String?
    let createdAt: String?

    var isRead: Bool { readAt != nil }

    /// Icona e colore come in src/lib/notification-meta.ts.
    var style: (symbol: String, color: Color) {
        switch type {
        case "quote_signed": ("signature", .green)
        case "quote_rejected": ("xmark.seal", .red)
        case "quote_status": ("arrow.triangle.2.circlepath", .blue)
        case "quote_assigned": ("person.badge.plus", .purple)
        case "quote_locked": ("lock.fill", .orange)
        case "quote_unlocked": ("lock.open.fill", .orange)
        case "quote_deleted": ("trash", .gray)
        case "feature": ("sparkles", .purple)
        case "announcement": ("megaphone.fill", .blue)
        case "maintenance": ("wrench.and.screwdriver.fill", .orange)
        case "alert": ("exclamationmark.triangle.fill", .red)
        case "support": ("questionmark.bubble.fill", .cyan)
        default: ("info.circle.fill", .gray)
        }
    }
}

private struct NotificationRow: View {
    let item: AppNotification

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.style.symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(item.style.color)
                .frame(width: 34, height: 34)
                .background(item.style.color.opacity(0.13), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.subheadline.weight(item.isRead ? .regular : .semibold))
                    .foregroundStyle(Color.primary)
                if let body = item.body, !body.isEmpty {
                    Text(body)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                }
                if let created = item.createdAt {
                    Text(Format.date(created))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            Spacer(minLength: 4)
            if !item.isRead {
                Circle().fill(Color.accentColor).frame(width: 9, height: 9).padding(.top, 4)
            }
        }
        .padding(.vertical, 2)
    }
}
