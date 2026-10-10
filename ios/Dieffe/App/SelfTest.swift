#if DEBUG
import SwiftUI
import UIKit
import UserNotifications

/// Autotest delle schermate native contro il server vero, solo nelle build
/// Debug: `xcrun simctl launch booted <bundle> -DieffeSelfTest YES`.
/// Usa lo stesso codice dell'app (APIClient, QuoteEditorModel, archivi) e
/// controlla, ricaricando dal server, che ogni salvataggio sia arrivato.
/// Tutto ciò che crea viene eliminato alla fine (preventivi anche dal cestino).
/// Risultato in Documents/selftest.log nel contenitore dell'app.
@MainActor
enum SelfTest {
    static var isRequested: Bool { UserDefaults.standard.bool(forKey: "DieffeSelfTest") }
    /// -DieffeKeychainTest YES: il Portachiavi è utilizzabile? (scrive, rilegge, cancella)
    static func runKeychainTest() {
        log = []
        failures = 0
        let previous = SessionStore.load()
        SessionStore.save(token: "prova-portachiavi", expires: Date(timeIntervalSinceNow: 3600))
        check(SessionStore.load()?.token == "prova-portachiavi", "Portachiavi: scrittura e lettura")
        if let previous { SessionStore.save(token: previous.token, expires: previous.expires) } else { SessionStore.clear() }
        note(failures == 0 ? "RISULTATO: tutto OK" : "RISULTATO: \(failures) errori")
        write()
    }

    static var notificationTestRequested: Bool { UserDefaults.standard.bool(forKey: "DieffeNotificationTest") }

    /// -DieffeNotificationTest YES: attiva le notifiche locali, manda a se
    /// stessi una notifica (admin), la mostra e poi la elimina dal server.
    static func runNotificationTest(app: AppModel) async {
        log = []
        failures = 0
        await app.home.load()
        guard let user = app.currentUser, user.role == "admin" else { return note("FAIL serve un admin") }
        let enabled = await LocalNotifier.shared.enable()
        check(enabled, "notifiche locali autorizzate")
        let title = "Preventivo PREV-TEST firmato dal cliente"
        _ = await step("notifica di prova inviata", {
            try await APIClient.shared.send("POST", "/api/admin/notifications",
                                            json: ["type": "announcement", "title": title,
                                                   "body": "Prova dell'app iPhone: tocca per aprire il listino.",
                                                   "link": "/listino", "target": user.id], as: Empty.self)
        })
        await LocalNotifier.shared.check()
        try? await Task.sleep(for: .seconds(1))
        let delivered = await UNUserNotificationCenter.current().deliveredNotifications()
        check(delivered.contains { $0.request.content.title == title }, "notifica mostrata da iOS")
        try? await Task.sleep(for: .seconds(12))
        let list = (try? await APIClient.shared.getRaw("/api/notifications?limit=20"))?["notifications"] as? [[String: Any]] ?? []
        if let id = list.first(where: { $0["title"] as? String == title })?["id"] as? String {
            _ = await step("notifica di prova eliminata", { try await APIClient.shared.delete("/api/notifications/\(id)") })
        }
        note(failures == 0 ? "RISULTATO: tutto OK" : "RISULTATO: \(failures) errori")
        write()
    }

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

        await moreTests(app: app, user: user, mainID: quoteID, createdQuotes: &createdQuotes)

        // Pulizia: cestino e poi eliminazione definitiva.
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

    // MARK: Altro: lavori extra, cestino, comunicazioni, notifiche, utenti, impostazioni, statistiche

    /// Riusa il preventivo di prova (ha già un lavoro extra): ogni giro di
    /// autotest consuma un solo numero della sequenza dei preventivi.
    private static func moreTests(app: AppModel, user: CurrentUser, mainID: String, createdQuotes: inout [String]) async {
        let api = APIClient.shared
        let main = CreatedID(id: mainID)

        // Lavori extra: il secondo e il terzo.
        var extraIDs: [String] = []
        for n in 2...3 {
            if let e: CreatedID = await step("extra: crea lavoro extra \(n)", {
                try await api.send("POST", "/api/quotes/\(main.id)/extras")
            }) {
                extraIDs.append(e.id)
                createdQuotes.append(e.id)
            }
        }
        if let first = extraIDs.first {
            let editor = QuoteEditorModel(quoteID: first)
            editor.canEdit = true
            editor.role = user.role
            await editor.load()
            if let section = await editor.addSection(optional: false), let item = await editor.addItem(to: section) {
                editor.updateItem(item) { $0.description = "Voce extra"; $0.unitPrice = 50 }
                await editor.flush()
            }
        }
        await app.home.load()
        let group = ExtrasView.groups(app.home.data?.quotes ?? []).first { $0.main.id == main.id }
        check(group?.extras.count == 3, "extra: raggruppati sotto il principale (\(group?.extras.count ?? 0))")
        check(group.map { abs($0.extrasTotal - 50) < 0.01 } == true, "extra: valore degli extra \(Format.currency(group?.extrasTotal ?? 0))")
        check(group?.extras.allSatisfy { $0.code.hasPrefix(group!.main.code + "-E") } == true,
              "extra: codici \(group?.extras.map(\.code).joined(separator: ", ") ?? "")")

        // Cestino: elimina, ritrova, ripristina (torna in Bozza), elimina per sempre.
        let trashID = main.id
        _ = await step("cestino: sposta nel cestino", {
            try await api.send("PATCH", "/api/quotes/\(trashID)/status", json: ["status": "sent"], as: Empty.self)
            try await api.delete("/api/quotes/\(trashID)")
        })
        var trash: [TrashedQuote] = (try? await api.get("/api/quotes/trash")) ?? []
        let entry = trash.first { $0.id == trashID }
        check(entry != nil, "cestino: il preventivo compare")
        check(entry?.daysRemaining == 30, "cestino: 30 giorni rimanenti (\(entry?.daysRemaining ?? -1))")
        _ = await step("cestino: ripristina", { try await api.send("POST", "/api/quotes/\(trashID)/restore", as: Empty.self) })
        trash = (try? await api.get("/api/quotes/trash")) ?? []
        check(!trash.contains { $0.id == trashID }, "cestino: non c'è più dopo il ripristino")
        let restored = QuoteEditorModel(quoteID: trashID)
        await restored.load()
        check(restored.quote?.status == .draft, "cestino: ripristinato in Bozza")
        if user.role == "admin" {
            _ = await step("cestino: elimina definitivamente", {
                try await api.delete("/api/quotes/\(trashID)")
                try await api.delete("/api/quotes/\(trashID)/permanent")
            })
            trash = (try? await api.get("/api/quotes/trash")) ?? []
            check(!trash.contains { $0.id == trashID }, "cestino: sparito dopo l'eliminazione definitiva")
            createdQuotes.removeAll { $0 == trashID }
            // Gli extra di un preventivo eliminato per sempre restano orfani: li pulisce la pulizia finale.
        }

        // Comunicazioni: convertitore del testo e salvataggi.
        let sample = "Gentili condòmini,\n\ncon la presente **comunichiamo** l'*inizio* dei __lavori__ ~~ieri~~.\n- primo punto\n- secondo **punto**\n1. uno\n2. due\nCosto 5\\*3 \\_ ok"
        let doc = LetterDoc.toDoc(sample)
        check(LetterDoc.toText(doc) == sample, "lettere: testo → documento → testo identico")
        check(LetterDoc.isEditableNatively(doc), "lettere: documento modificabile nell'app")
        check(!LetterDoc.isEditableNatively(["type": "doc", "content": [["type": "paragraph", "attrs": ["textAlign": "center"]]]]),
              "lettere: formattazione avanzata riconosciuta")
        var letter = Communication.empty()
        letter.subject = "TEST app iPhone – da eliminare"
        letter.body = doc
        letter.place = "Nichelino"
        letter.signatory = "Il titolare"
        var recipient = Communication.Recipient(kind: "condomini")
        recipient.name = "Condominio di prova"
        letter.recipients = [recipient]
        if let created = await step("lettere: crea", { try await api.sendRaw("POST", "/api/communications", json: letter.input) }),
           let saved = Communication(json: created) {
            check(saved.code.hasPrefix("COM-"), "lettere: protocollo \(saved.code)")
            check(LetterDoc.toText(saved.body) == sample, "lettere: testo salvato identico")
            check(saved.recipients.first?.salutation == "Gent.mi Condòmini" && saved.recipients.first?.name == "Condominio di prova",
                  "lettere: destinatario salvato")
            var changed = saved
            changed.subject = "TEST app iPhone – modificata"
            changed.includeStamp = false
            let patched = await step("lettere: modifica", {
                try await api.sendRaw("PATCH", "/api/communications/\(saved.id)", json: changed.input)
            }).flatMap(Communication.init(json:))
            check(patched?.subject == "TEST app iPhone – modificata" && patched?.includeStamp == false, "lettere: modifica salvata")
            if let pdf = await step("lettere: PDF", { try await api.download("/api/communications/\(saved.id)/pdf") }) {
                let size = (try? pdf.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
                check(size > 1000, "lettere: PDF di \(size) byte")
            }
            _ = await step("lettere: elimina", { try await api.delete("/api/communications/\(saved.id)") })
            let all = ((try? await api.getRawArray("/api/communications")) ?? []).compactMap(Communication.init(json:))
            check(!all.contains { $0.id == saved.id }, "lettere: sparita dall'archivio")
            let native = all.filter { LetterDoc.isEditableNatively($0.body) }.count
            note("INFO lettere esistenti modificabili nell'app: \(native) su \(all.count)")
        }

        // Notifiche (solo admin): a me stesso, poi la elimino.
        if user.role == "admin" {
            let title = "TEST app iPhone \(Int.random(in: 1000...9999))"
            _ = await step("notifiche: invia a me stesso", {
                try await api.send("POST", "/api/admin/notifications",
                                   json: ["type": "announcement", "title": title, "body": "Prova", "link": "/listino", "target": user.id],
                                   as: Empty.self)
            })
            let list = (try? await api.getRaw("/api/notifications?limit=20"))?["notifications"] as? [[String: Any]] ?? []
            let mine = list.first { $0["title"] as? String == title }
            check(mine != nil, "notifiche: ricevuta")
            if let id = mine?["id"] as? String {
                _ = await step("notifiche: elimina", { try await api.delete("/api/notifications/\(id)") })
            }
        }

        // Utenti (solo admin).
        if user.role == "admin" {
            let email = "test-app-iphone-\(Int.random(in: 1000...9999))@example.com"
            if let created: CreatedID = await step("utenti: crea", {
                try await api.send("POST", "/api/users", json: ["name": "Test App", "email": email,
                                                                "password": PasswordPolicy.generate(), "role": "viewer"])
            }) {
                _ = await step("utenti: nome, ruolo, disattiva, password", {
                    try await api.send("PATCH", "/api/users/\(created.id)", json: ["name": "Test App Modificato", "role": "editor"], as: Empty.self)
                    try await api.send("PATCH", "/api/users/\(created.id)", json: ["disabled": true], as: Empty.self)
                    try await api.send("PATCH", "/api/users/\(created.id)", json: ["password": PasswordPolicy.generate()], as: Empty.self)
                })
                let users: [TeamUser] = (try? await api.get("/api/users")) ?? []
                let u = users.first { $0.id == created.id }
                check(u?.name == "Test App Modificato" && u?.role == "editor" && u?.disabled == true, "utenti: modifiche salvate")
                let log: [AccessLogEntry]? = try? await api.get("/api/admin/users/\(created.id)/access-log")
                check(log != nil, "utenti: accessi leggibili (\(log?.count ?? -1))")
                _ = await step("utenti: elimina", { try await api.delete("/api/users/\(created.id)") })
                let after: [TeamUser] = (try? await api.get("/api/users")) ?? []
                check(!after.contains { $0.id == created.id }, "utenti: sparito")
            }
            let me = ((try? await api.get("/api/users")) as [TeamUser]?)?.first { $0.id == user.id }
            if let me {
                do {
                    try await api.send("PATCH", "/api/users/\(me.id)", json: ["disabled": true], as: Empty.self)
                    check(false, "utenti: non posso disattivarmi da solo")
                } catch {
                    check(true, "utenti: non posso disattivarmi da solo (\(error.localizedDescription))")
                }
            }
        }

        // Impostazioni azienda (solo admin): rileggo e risalvo uguali.
        if user.role == "admin", let before: CompanySettings = await step("impostazioni: lettura", { try await api.get("/api/settings") }) {
            let after: CompanySettings? = await step("impostazioni: salvataggio senza modifiche", {
                try await api.send("PUT", "/api/settings", json: before.json)
            })
            if let after, after != before {
                let m1 = Mirror(reflecting: before), m2 = Mirror(reflecting: after)
                for (a, b) in zip(m1.children, m2.children) where "\(a.value)" != "\(b.value)" {
                    note("DIFF \(a.label ?? "?"): \(a.value) → \(b.value)")
                }
            }
            check(after == before, "impostazioni: invariate dopo il salvataggio")
        }

        // Statistiche: stessi conti del sito sui dati della Home.
        let quotes = app.home.data?.quotes ?? []
        let stats = Stats(quotes: quotes, period: .all)
        check(stats.count == quotes.count, "statistiche: \(stats.count) preventivi")
        check(stats.byStatus.reduce(0) { $0 + $1.1 } == stats.count, "statistiche: stati che sommano al totale")
        check((0...1).contains(stats.conversion), "statistiche: conversione \(stats.conversion.formatted(.percent))")
        check(stats.monthly.count == 12 * QuoteStatus.allCases.count && stats.acceptedByMonth.count == 12, "statistiche: 12 mesi")
    }

    private static func write() {
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("selftest.log")
        try? log.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
    }
}
#endif
