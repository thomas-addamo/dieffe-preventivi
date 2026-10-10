#if DEBUG
import SwiftUI
import UIKit

/// Autotest delle schermate native contro il server vero, solo nelle build
/// Debug: `xcrun simctl launch booted <bundle> -DieffeSelfTest YES`.
/// Usa lo stesso codice dell'app (APIClient, QuoteEditorModel, archivi) e
/// controlla, ricaricando dal server, che ogni salvataggio sia arrivato.
/// Tutto ciò che crea viene eliminato alla fine (preventivi anche dal cestino).
/// Risultato in Documents/selftest.log nel contenitore dell'app.
@MainActor
enum SelfTest {
    static var isRequested: Bool { UserDefaults.standard.bool(forKey: "DieffeSelfTest") }

    private static var log: [String] = []
    private static var failures = 0

    private static func note(_ text: String) {
        log.append(text)
        print("[SelfTest] \(text)")
    }

    private static func check(_ condition: Bool, _ label: String) {
        if condition {
            note("OK   \(label)")
        } else {
            failures += 1
            note("FAIL \(label)")
        }
    }

    private static func step<T>(_ label: String, _ work: () async throws -> T) async -> T? {
        do {
            let value = try await work()
            note("OK   \(label)")
            return value
        } catch {
            failures += 1
            note("FAIL \(label): \(error.localizedDescription)")
            return nil
        }
    }

    static func run(app: AppModel) async {
        log = []
        failures = 0
        note("Autotest avviato \(Date.now.formatted())")
        await app.home.load()
        guard let user = app.currentUser else {
            note("FAIL nessuna sessione: accedi prima di lanciare l'autotest")
            return write()
        }
        note("Utente: \(user.name) (\(user.role))")

        let api = APIClient.shared
        var createdQuotes: [String] = []

        // 1. Nuovo preventivo, come NewQuoteView.
        guard let created: CreatedID = await step("crea preventivo", {
            try await api.send("POST", "/api/quotes", json: [
                "title": "TEST app iPhone – da eliminare", "clientId": nil, "projectAddress": "Via Prova 1, Torino",
            ])
        }) else { return write() }
        let quoteID = created.id
        createdQuotes.append(quoteID)

        // 2. Editor: intestazione.
        let editor = QuoteEditorModel(quoteID: quoteID)
        editor.canEdit = user.canEdit
        editor.role = user.role
        await editor.load()
        check(editor.quote != nil, "editor carica il preventivo")
        let client = app.home.data?.clients.first
        editor.updateHeader {
            $0.title = "TEST app iPhone – modificato"
            $0.vatRate = 22
            $0.paymentTerms = QuoteOptions.paymentTerms[1]
            $0.notes = "Note di prova"
            $0.validUntil = "2026-12-31"
            $0.discountType = .percent
            $0.discountValue = 10
            $0.clientId = client?.id
            $0.client = client.map { QuoteDetail.Party(id: $0.id, name: $0.name) }
        }
        await editor.flush()
        check(editor.saveState == .saved, "salvataggio intestazione (\(editor.saveState))")

        // 3. Sezioni e voci.
        let sectionA = await editor.addSection(optional: false)
        check(sectionA != nil, "aggiunge sezione")
        if let sectionA {
            editor.updateSection(sectionA) { $0.title = "Sezione di prova"; $0.description = "Descrizione sezione" }
            let item1 = await editor.addItem(to: sectionA)
            check(item1 != nil, "aggiunge voce")
            if let item1 {
                editor.updateItem(item1) {
                    $0.description = "**Voce** di prova con *corsivo*\n- primo punto"
                    $0.quantity = 2.5
                    $0.unitOfMeasure = "mq"
                    $0.unitPrice = 100
                    $0.discount = 5
                    $0.notes = "Nota voce"
                }
                // Foto: carica ed elimina.
                let jpeg = UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64)).image { ctx in
                    UIColor.systemBlue.setFill()
                    ctx.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
                }.jpegData(compressionQuality: 0.8)!
                await editor.addImage(to: item1, data: jpeg)
                let images = editor.item(item1)?.images ?? []
                check(images.count == 1, "carica una foto sulla voce")
                if let image = images.first {
                    await editor.deleteImage(image.id, from: item1)
                    check(editor.item(item1)?.images.isEmpty == true, "elimina la foto")
                }
            }
            await app.priceList.loadIfNeeded()
            if let template = app.priceList.items?.first(where: \.isActive) {
                let item2 = await editor.addItem(to: sectionA, from: template.asQuoteItem)
                check(item2 != nil, "aggiunge voce dal listino (\(template.code ?? template.description.prefix(20).description))")
                if let item2 {
                    await editor.duplicateItem(item2)
                    let count = editor.quote?.sections.first { $0.id == sectionA }?.items.count ?? 0
                    check(count == 3, "duplica voce (voci: \(count))")
                    if let dup = editor.quote?.sections.first(where: { $0.id == sectionA })?.items.last {
                        await editor.deleteItem(dup.id)
                    }
                    editor.moveItems(in: sectionA, from: IndexSet(integer: 1), to: 0)
                    try? await Task.sleep(for: .seconds(1.5))
                }
            }
        }
        let sectionB = await editor.addSection(optional: true)
        if let sectionB {
            editor.updateSection(sectionB) {
                $0.isOptionalIncluded = true
                $0.lumpSum = true
                $0.lumpSumPrice = 300
            }
        }
        await editor.flush()
        check(editor.saveState == .saved, "salvataggio sezioni e voci (\(editor.saveState))")

        // 4. Stato e link per il cliente.
        await editor.setStatus(.sent)
        let link = await editor.createPublicLink(days: 7)
        check(link?.pin?.count == 6, "crea link per il cliente con PIN")
        await editor.revokePublicLink()
        check(editor.quote?.publicToken == nil, "revoca link")

        // 5. Ricarica dal server e confronta.
        let local = editor.quote
        let fresh = QuoteEditorModel(quoteID: quoteID)
        await fresh.load()
        if let a = local, let b = fresh.quote {
            check(b.title == "TEST app iPhone – modificato", "titolo salvato")
            check(b.clientId == client?.id, "cliente salvato")
            check(b.vatRate == 22 && b.discountType == .percent && b.discountValue == 10, "IVA e sconto salvati")
            check(b.paymentTerms == QuoteOptions.paymentTerms[1] && b.notes == "Note di prova", "pagamento e note salvati")
            check(b.validUntil?.hasPrefix("2026-12-31") == true, "validità salvata (\(b.validUntil ?? "nil"))")
            check(b.status == .sent, "stato Inviato salvato")
            check(b.sections.count == 2, "due sezioni salvate")
            check(b.sections.map(\.id) == a.sections.map(\.id), "ordine sezioni")
            check(b.sections.first?.items.map(\.id) == a.sections.first?.items.map(\.id), "ordine voci dopo il riordino")
            if let item = b.sections.first?.items.first(where: { $0.unitOfMeasure == "mq" && $0.unitPrice == 100 }) {
                check(item.quantity == 2.5 && item.discount == 5, "quantità e sconto voce")
                check(item.description == "**Voce** di prova con *corsivo*\n- primo punto", "descrizione formattata intatta")
                check(item.notes == "Nota voce", "nota voce")
            } else {
                check(false, "voce di prova ritrovata")
            }
            check(b.sections.last?.lumpSum == true && b.sections.last?.lumpSumPrice == 300
                  && b.sections.last?.isOptionalIncluded == true, "sezione opzionale a corpo inclusa")
            check(abs(a.totals.total - b.totals.total) < 0.005, "totale uguale dopo il ricaricamento (\(Format.currency(b.totals.total)))")

            await app.home.load()
            let serverNet = app.home.data?.quotes.first { $0.id == quoteID }?.total
            check(serverNet.map { abs($0 - b.totals.taxable) < 0.01 } == true,
                  "imponibile app = server (\(Format.currency(b.totals.taxable)) vs \(serverNet.map(Format.currency) ?? "–"))")
        } else {
            check(false, "ricarica dal server")
        }

        // 6. Esportazioni.
        if let pdf = await editor.exportFile("pdf") {
            let size = (try? pdf.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            check(size > 1000 && pdf.pathExtension == "pdf", "PDF scaricato (\(pdf.lastPathComponent), \(size) byte)")
        } else { check(false, "PDF") }
        if let xlsx = await editor.exportFile("excel") {
            check(xlsx.pathExtension == "xlsx", "Excel scaricato (\(xlsx.lastPathComponent))")
        } else { check(false, "Excel") }

        // 7. Lavoro extra.
        if let extraID = await editor.createExtra() {
            createdQuotes.append(extraID)
            let extra = QuoteEditorModel(quoteID: extraID)
            await extra.load()
            check(extra.quote?.isExtra == true && extra.quote?.parentQuoteId == quoteID, "lavoro extra collegato (\(extra.quote?.code ?? ""))")
        } else { check(false, "crea lavoro extra") }

        // 8. Blocco (solo admin).
        if user.role == "admin" {
            await editor.setLocked(true)
            await editor.setLocked(false)
            check(editor.quote?.isLocked == false, "blocca e sblocca")
        }

        // 9. Clienti.
        var draft = ClientDraft()
        draft.name = "TEST cliente app – da eliminare"
        draft.email = "test@example.com"
        if let saved = await step("crea cliente", { try await app.clients.save(draft, editing: nil) }) {
            draft.phone = "+39 011 000000"
            let updated = await step("modifica cliente", { try await app.clients.save(draft, editing: saved.id) })
            check(updated?.phone == "+39 011 000000", "telefono cliente salvato")
            _ = await step("elimina cliente", { try await app.clients.delete(saved) })
        }

        // 10. Listino.
        var price = PriceListDraft(category: PriceCatalog.defaultCategory)
        price.description = "TEST voce listino app – da eliminare"
        price.unitPrice = 12.5
        price.unitOfMeasure = "ml"
        if await step("crea voce listino", { try await app.priceList.save(price, editing: nil) }) != nil,
           let item = app.priceList.items?.first(where: { $0.description == price.description }) {
            check(item.unitPrice == 12.5 && item.unitOfMeasure == "ml", "prezzo e unità voce listino (\(item.code ?? "-"))")
            _ = await step("fissa voce listino", { try await app.priceList.setFlags(item, pinned: true) })
            _ = await step("elimina voce listino", { try await app.priceList.delete(item) })
        }

        // 11. Pulizia: cestino e poi eliminazione definitiva.
        for id in createdQuotes.reversed() {
            _ = await step("cestino \(id.prefix(6))", { try await api.delete("/api/quotes/\(id)") })
            if user.role == "admin" {
                _ = await step("eliminazione definitiva \(id.prefix(6))", { try await api.delete("/api/quotes/\(id)/permanent") })
            }
        }
        app.dataChanged()
        note(failures == 0 ? "RISULTATO: tutto OK" : "RISULTATO: \(failures) errori")
        write()
    }

    private static func write() {
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("selftest.log")
        try? log.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
    }
}
#endif
