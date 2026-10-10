import SwiftUI
import UIKit

/// Riepilogo che si apre dalla barra del totale: sezioni, opzionali, sconto,
/// imponibile, IVA e totale (come il pannello "Totali" del sito).
struct TotalsSummaryView: View {
    @Environment(\.dismiss) private var dismiss
    let editor: QuoteEditorModel

    var body: some View {
        NavigationStack {
            if let quote = editor.quote {
                let totals = quote.totals
                List {
                    Section {
                        VStack(spacing: 4) {
                            Text("Totale IVA inclusa")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Text(Format.currency(totals.total))
                                .font(.system(size: 40, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .contentTransition(.numericText())
                            Text("Imponibile \(Format.currency(totals.taxable)) + IVA \(quote.vatRate.formatted())%")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                    }

                    let normal = quote.sections.filter { !$0.isOptional }
                    if !normal.isEmpty {
                        Section("Sezioni") {
                            ForEach(normal) { sectionRow($0, counted: true) }
                            row("Subtotale lavori", totals.baseSubtotal, bold: true)
                        }
                    }

                    let optional = quote.sections.filter(\.isOptional)
                    if !optional.isEmpty {
                        Section {
                            ForEach(optional) { section in
                                Toggle(isOn: Binding(
                                    get: { section.isOptionalIncluded },
                                    set: { value in editor.updateSection(section.id) { $0.isOptionalIncluded = value } }
                                )) {
                                    sectionRow(section, counted: section.isOptionalIncluded)
                                }
                                .disabled(!editor.isEditable)
                            }
                        } header: {
                            Text("Opzionali")
                        } footer: {
                            Text("Contano nel totale solo se incluse.")
                        }
                    }

                    Section("Totali") {
                        row("Subtotale", totals.subtotalBeforeDiscount)
                        if totals.discountAmount > 0 {
                            row(quote.discountType == .percent ? "Sconto \((quote.discountValue ?? 0).formatted())%" : "Sconto",
                                -totals.discountAmount, color: .green)
                        }
                        row("Imponibile", totals.taxable, bold: true)
                        row("IVA \(quote.vatRate.formatted())%", totals.vat)
                        row("Totale", totals.total, bold: true)
                    }
                }
                .navigationTitle("Riepilogo")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Fine", systemImage: "checkmark") { dismiss() }
                    }
                }
                .animation(.default, value: totals.total)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func sectionRow(_ section: QuoteSection, counted: Bool) -> some View {
        HStack(spacing: 10) {
            Text(section.code)
                .font(.caption.weight(.bold).monospaced())
                .foregroundStyle(.white)
                .frame(minWidth: 22)
                .padding(.vertical, 2)
                .background(section.isOptional ? Color.orange : Color.accentColor, in: RoundedRectangle(cornerRadius: 5))
            VStack(alignment: .leading, spacing: 1) {
                Text(section.title).lineLimit(2)
                Text(section.lumpSum ? "A corpo" : Format.count(section.items.count, "voce", "voci"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(Format.currency(section.total))
                .monospacedDigit()
                .foregroundStyle(counted ? Color.primary : Color.secondary)
                .strikethrough(!counted)
        }
    }

    private func row(_ label: String, _ value: Double, bold: Bool = false, color: Color = .primary) -> some View {
        LabeledContent(label) {
            Text(Format.currency(value))
                .monospacedDigit()
                .fontWeight(bold ? .bold : .regular)
                .foregroundStyle(color)
        }
        .fontWeight(bold ? .semibold : .regular)
    }
}

/// Assistente AI edilizia (come src/components/quote-editor/AiChatAssistant.tsx,
/// POST /api/ai/chat): risponde con i prezzi del listino e dei preventivi
/// passati, e su richiesta cerca online.
struct AIChatView: View {
    @Environment(\.dismiss) private var dismiss
    let quote: QuoteDetail?

    private struct Message: Identifiable, Equatable {
        let id = UUID()
        let role: String
        let content: String
    }

    @State private var messages: [Message] = []
    @State private var input = ""
    @State private var loading = false
    @FocusState private var focused: Bool

    private let suggestions = [
        "Quanto ho fatto pagare l'ultimo cappotto termico?",
        "Che prezzi ho usato per la tinteggiatura?",
        "Come calcolo il fabbisogno di piastrelle per un bagno?",
        "Qual è il costo medio della posa parquet?",
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            if messages.isEmpty { intro }
                            ForEach(messages) { bubble($0) }
                            if loading {
                                HStack(spacing: 8) {
                                    ProgressView()
                                    Text("Sto pensando…").font(.subheadline).foregroundStyle(.secondary)
                                }
                                .padding(.leading, 4)
                                .id("loading")
                            }
                        }
                        .padding()
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: messages) { _, list in
                        withAnimation { proxy.scrollTo(list.last?.id, anchor: .bottom) }
                    }
                    .onChange(of: loading) { _, value in
                        if value { withAnimation { proxy.scrollTo("loading", anchor: .bottom) } }
                    }
                }
                composer
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Assistente AI")
            .navigationSubtitle("Specializzato in edilizia")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Chiudi", systemImage: "xmark") { dismiss() }
                }
                if !messages.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Nuova chat", systemImage: "square.and.pencil") { messages = [] }
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Chiedi prezzi, quantità e lavorazioni: rispondo con il tuo listino e i preventivi passati.",
                  systemImage: "sparkles")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if let quote {
                Button {
                    send("Per il preventivo \"\(quote.title)\" (\(Format.currency(quote.totals.taxable)) di imponibile): manca qualche lavorazione tipica? Suggerisci voci con prezzo.")
                } label: {
                    Label("Controlla questo preventivo", systemImage: "checklist")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.bordered)
                .tint(.purple)
            }
            ForEach(suggestions, id: \.self) { s in
                Button { send(s) } label: {
                    Text(s).frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.bordered)
            }
        }
        .font(.subheadline)
    }

    private func bubble(_ m: Message) -> some View {
        let mine = m.role == "user"
        return Text(LocalizedStringKey(m.content))
            .font(.subheadline)
            .textSelection(.enabled)
            .padding(12)
            .foregroundStyle(mine ? .white : .primary)
            .background(mine ? Color.purple : Color(.secondarySystemGroupedBackground),
                        in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
            .padding(mine ? .leading : .trailing, 40)
            .id(m.id)
            .contextMenu {
                Button("Copia", systemImage: "doc.on.doc") { UIPasteboard.general.string = m.content }
            }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Scrivi una domanda…", text: $input, axis: .vertical)
                .lineLimit(1...5)
                .focused($focused)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
                .onSubmit { send(input) }
            Button {
                send(input)
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(.purple)
            }
            .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || loading)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private func send(_ text: String) {
        let content = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(3000))
        guard !content.isEmpty, !loading else { return }
        input = ""
        messages.append(Message(role: "user", content: content))
        loading = true
        let history = messages.suffix(30).map { ["role": $0.role, "content": $0.content] }
        Task {
            defer { loading = false }
            struct Reply: Decodable { let reply: String }
            do {
                let r: Reply = try await APIClient.shared.send("POST", "/api/ai/chat", json: ["messages": history])
                messages.append(Message(role: "assistant", content: r.reply))
            } catch {
                messages.append(Message(role: "assistant", content: error.localizedDescription))
            }
        }
    }
}
