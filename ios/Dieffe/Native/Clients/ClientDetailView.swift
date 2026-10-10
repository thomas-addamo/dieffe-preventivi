import SwiftUI
import UIKit

/// Scheda cliente: contatti con azioni rapide, valore e preventivi collegati.
struct ClientDetailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    let clientID: String

    @State private var editing = false
    @State private var confirmDelete = false

    var body: some View {
        if let client = model.clients.client(clientID) {
            content(client)
        } else {
            ContentUnavailableView("Cliente non trovato", systemImage: "person.crop.circle.badge.questionmark")
        }
    }

    private func content(_ client: ClientRecord) -> some View {
        List {
            Section {
                VStack(spacing: 10) {
                    InitialsAvatar(name: client.name, size: 84)
                    Text(client.name)
                        .font(.title2.weight(.bold))
                        .multilineTextAlignment(.center)
                    if let vat = client.vatNumber {
                        Text(vat)
                            .font(.subheadline.monospaced())
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                    HStack(spacing: 10) {
                        QuickAction(title: "Chiama", symbol: "phone.fill", url: client.phone.flatMap { Self.url("tel:", $0) })
                        QuickAction(title: "Messaggio", symbol: "message.fill", url: client.phone.flatMap { Self.url("sms:", $0) })
                        QuickAction(title: "Email", symbol: "envelope.fill", url: client.email.flatMap { URL(string: "mailto:\($0)") })
                        QuickAction(title: "Indicazioni", symbol: "map.fill", url: client.address.flatMap(Self.mapsURL))
                    }
                    .padding(.top, 6)
                }
                .frame(maxWidth: .infinity)
            }
            .listRowBackground(Color.clear)

            if client.phone != nil || client.email != nil || client.address != nil {
                Section("Contatti") {
                    if let phone = client.phone {
                        ContactRow(label: "Telefono", value: phone, url: Self.url("tel:", phone))
                    }
                    if let email = client.email {
                        ContactRow(label: "Email", value: email, url: URL(string: "mailto:\(email)"))
                    }
                    if let address = client.address {
                        ContactRow(label: "Indirizzo", value: address, url: Self.mapsURL(address))
                    }
                }
            }

            if let notes = client.notes {
                Section("Note") {
                    Text(notes)
                        .textSelection(.enabled)
                }
            }

            Section {
                LabeledContent("Valore accettato") {
                    Text(Format.currency(client.acceptedValue))
                        .monospacedDigit()
                        .foregroundStyle(client.acceptedValue > 0 ? .green : .secondary)
                }
                ForEach(client.quotes) { quote in
                    Button {
                        model.openQuote(quote.id)
                    } label: {
                        ClientQuoteRow(quote: quote)
                    }
                    .tint(.primary)
                }
                if model.canEdit {
                    Button {
                        model.newQuote(client: ClientRef(id: client.id, name: client.name))
                    } label: {
                        Label("Nuovo preventivo per \(client.name)", systemImage: "doc.badge.plus")
                    }
                }
            } header: {
                Text(Format.count(client.quotes.count, "preventivo", "preventivi"))
            }

            if model.canEdit {
                Section {
                    Button("Elimina cliente", systemImage: "trash", role: .destructive) { confirmDelete = true }
                }
            }
        }
        .navigationTitle(client.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if model.canEdit {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Modifica") { editing = true }
                }
            }
        }
        .refreshable { await model.clients.load() }
        .sheet(isPresented: $editing) {
            ClientFormView(editing: client) { _ in model.dataChanged() }
        }
        .confirmationDialog("Eliminare \(client.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Elimina cliente", role: .destructive) { delete(client) }
        } message: {
            Text(Self.deleteWarning(client))
        }
    }

    private func delete(_ client: ClientRecord) {
        Task {
            do {
                try await model.clients.delete(client)
                dismiss()
                model.dataChanged()
            } catch {
                model.lastError = error.localizedDescription
            }
        }
    }

    static func deleteWarning(_ client: ClientRecord) -> String {
        let n = client.quotes.count
        guard n > 0 else { return "L'operazione non si può annullare." }
        return n == 1
            ? "Ha 1 preventivo collegato, che resterà senza cliente."
            : "Ha \(n) preventivi collegati, che resteranno senza cliente."
    }

    private static func url(_ scheme: String, _ phone: String) -> URL? {
        URL(string: scheme + phone.filter { $0.isNumber || $0 == "+" })
    }

    private static func mapsURL(_ address: String) -> URL? {
        var components = URLComponents(string: "maps://")
        components?.queryItems = [URLQueryItem(name: "daddr", value: address)]
        return components?.url
    }
}

/// Pulsante rotondo come nella scheda dell'app Contatti.
private struct QuickAction: View {
    @Environment(\.openURL) private var openURL
    let title: String
    let symbol: String
    let url: URL?

    var body: some View {
        Button {
            if let url { openURL(url) }
        } label: {
            VStack(spacing: 5) {
                Image(systemName: symbol)
                    .font(.system(size: 17, weight: .semibold))
                    .frame(height: 22)
                Text(title)
                    .font(.caption2.weight(.medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
        }
        .buttonStyle(.glass)
        .disabled(url == nil)
    }
}

private struct ContactRow: View {
    @Environment(\.openURL) private var openURL
    let label: String
    let value: String
    let url: URL?

    var body: some View {
        Button {
            if let url { openURL(url) }
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(Color.secondary)
                Text(value)
                    .foregroundStyle(Color.accentColor)
            }
        }
        .contextMenu {
            Button("Copia", systemImage: "doc.on.doc") { UIPasteboard.general.string = value }
        }
    }
}

private struct ClientQuoteRow: View {
    let quote: ClientRecord.ClientQuote

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(quote.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                Text("\(quote.code) · \(Format.date(quote.createdAt))")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 4) {
                Text(Format.currency(quote.total))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                StatusBadge(status: quote.status)
            }
        }
    }
}
