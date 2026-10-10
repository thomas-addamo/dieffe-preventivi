import Foundation

/// Preventivo nel cestino (GET /api/quotes/trash).
struct TrashedQuote: Decodable, Identifiable, Hashable {
    let id: String
    let code: String
    let title: String
    let deletedAt: String?
    let clientName: String?
    let authorName: String?
    let daysRemaining: Int
}

/// Utente (GET /api/users, solo admin).
struct TeamUser: Decodable, Identifiable, Hashable {
    let id: String
    let email: String
    var name: String
    var role: String
    var disabled: Bool
    let createdAt: String?
    let lastLoginAt: String?

    var roleLabel: String {
        switch role {
        case "admin": "Amministratore"
        case "editor": "Editor"
        default: "Visualizzatore"
        }
    }

    static let roles: [(String, String, String)] = [
        ("admin", "Amministratore", "Gestisce utenti, impostazioni e tutto il resto"),
        ("editor", "Editor", "Crea e modifica preventivi, clienti, listino"),
        ("viewer", "Visualizzatore", "Consulta senza modificare"),
    ]
}

/// Accesso registrato (GET /api/admin/users/[id]/access-log).
struct AccessLogEntry: Decodable, Identifiable {
    let id: String
    let loginAt: String?
    let ipAddress: String?
    let userAgent: String?
    let success: Bool

    enum CodingKeys: String, CodingKey { case id, loginAt, ipAddress, userAgent, success }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let text = try? c.decode(String.self, forKey: .id) {
            id = text
        } else {
            id = String((try? c.decode(Int.self, forKey: .id)) ?? Int.random(in: 0...Int.max))
        }
        loginAt = try c.decodeIfPresent(String.self, forKey: .loginAt)
        ipAddress = try c.decodeIfPresent(String.self, forKey: .ipAddress)
        userAgent = try c.decodeIfPresent(String.self, forKey: .userAgent)
        success = try c.decodeIfPresent(Bool.self, forKey: .success) ?? true
    }

    /// "iPhone · Safari", "Mac · app desktop"… dallo User-Agent.
    var device: String {
        guard let ua = userAgent else { return "Dispositivo sconosciuto" }
        let system = ua.contains("iPhone") ? "iPhone" : ua.contains("iPad") ? "iPad"
            : ua.contains("Android") ? "Android" : ua.contains("Mac") ? "Mac" : ua.contains("Windows") ? "Windows" : "Computer"
        let app = ua.contains("DieffeiOS") ? "app iPhone" : ua.contains("DieffeDesktop") ? "app desktop"
            : ua.contains("Edg/") ? "Edge" : ua.contains("Chrome") ? "Chrome" : ua.contains("Safari") ? "Safari"
            : ua.contains("Firefox") ? "Firefox" : "browser"
        return "\(system) · \(app)"
    }
}

/// Impostazioni dell'azienda (GET/PUT /api/settings).
struct CompanySettings: Codable, Equatable {
    var companyName: String
    var logoPath: String?
    /// Indirizzo dell'immagine (logoPath è il public_id di Cloudinary).
    var logoUrl: String?
    var address: String?
    var vatNumber: String?
    var email: String?
    var phone: String?
    var website: String?
    var defaultVatRate: Double
    var pdfTemplate: String
    var primaryColor: String
    var accentColor: String
    var emailFromAddress: String?
    var quotePrefix: String
    var notifyTeamOnAccept: Bool
    var notifyTeamOnReject: Bool
    var defaultPaymentTerms: String?
    var defaultQuoteNotes: String?
    var aiEnabled: Bool

    enum CodingKeys: String, CodingKey {
        case companyName, logoPath, logoUrl, address, vatNumber, email, phone, website, defaultVatRate, pdfTemplate
        case primaryColor, accentColor, emailFromAddress, quotePrefix, notifyTeamOnAccept, notifyTeamOnReject
        case defaultPaymentTerms, defaultQuoteNotes, aiEnabled
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        companyName = try c.decodeIfPresent(String.self, forKey: .companyName) ?? ""
        logoPath = try c.decodeIfPresent(String.self, forKey: .logoPath)
        logoUrl = try c.decodeIfPresent(String.self, forKey: .logoUrl)
        address = try c.decodeIfPresent(String.self, forKey: .address)
        vatNumber = try c.decodeIfPresent(String.self, forKey: .vatNumber)
        email = try c.decodeIfPresent(String.self, forKey: .email)
        phone = try c.decodeIfPresent(String.self, forKey: .phone)
        website = try c.decodeIfPresent(String.self, forKey: .website)
        defaultVatRate = try c.decodeIfPresent(Double.self, forKey: .defaultVatRate) ?? 22
        pdfTemplate = try c.decodeIfPresent(String.self, forKey: .pdfTemplate) ?? "classic"
        primaryColor = try c.decodeIfPresent(String.self, forKey: .primaryColor) ?? "#1e40af"
        accentColor = try c.decodeIfPresent(String.self, forKey: .accentColor) ?? "#3b82f6"
        emailFromAddress = try c.decodeIfPresent(String.self, forKey: .emailFromAddress)
        quotePrefix = try c.decodeIfPresent(String.self, forKey: .quotePrefix) ?? "PREV"
        notifyTeamOnAccept = try c.decodeIfPresent(Bool.self, forKey: .notifyTeamOnAccept) ?? true
        notifyTeamOnReject = try c.decodeIfPresent(Bool.self, forKey: .notifyTeamOnReject) ?? false
        defaultPaymentTerms = try c.decodeIfPresent(String.self, forKey: .defaultPaymentTerms)
        defaultQuoteNotes = try c.decodeIfPresent(String.self, forKey: .defaultQuoteNotes)
        aiEnabled = try c.decodeIfPresent(Bool.self, forKey: .aiEnabled) ?? true
    }

    /// Corpo del PUT: tutti i campi modificabili (il logo ha la sua API),
    /// rimandati esattamente come sono: un salvataggio senza modifiche non
    /// cambia nulla.
    var json: [String: Any?] {
        func opt(_ s: String?) -> String? { s }
        return [
            "companyName": companyName, "address": opt(address), "vatNumber": opt(vatNumber), "email": opt(email),
            "phone": opt(phone), "website": opt(website), "defaultVatRate": defaultVatRate, "pdfTemplate": pdfTemplate,
            "primaryColor": primaryColor, "accentColor": accentColor, "emailFromAddress": opt(emailFromAddress),
            "quotePrefix": quotePrefix, "notifyTeamOnAccept": notifyTeamOnAccept, "notifyTeamOnReject": notifyTeamOnReject,
            "defaultPaymentTerms": opt(defaultPaymentTerms), "defaultQuoteNotes": opt(defaultQuoteNotes), "aiEnabled": aiEnabled,
        ]
    }
}

/// Comunicazione su carta intestata (GET /api/communications).
struct Communication: Identifiable {
    let id: String
    let code: String
    var subject: String
    var body: [String: Any]
    var recipients: [Recipient]
    var place: String
    var documentDate: String
    var includeStamp: Bool
    var signatory: String
    let createdAt: String

    struct Recipient: Identifiable, Equatable {
        let id = UUID()
        var kind: String
        var salutation: String
        var name: String
        var address: String
        var email: String
        var clientId: String?

        init(kind: String) {
            let k = Communication.kinds.first { $0.value == kind } ?? Communication.kinds[0]
            self.kind = k.value
            salutation = k.salutation
            name = ""
            address = ""
            email = ""
        }

        init(json: [String: Any]) {
            kind = json["kind"] as? String ?? "cliente"
            salutation = json["salutation"] as? String ?? ""
            name = json["name"] as? String ?? ""
            address = json["address"] as? String ?? ""
            email = json["email"] as? String ?? ""
            clientId = json["clientId"] as? String
        }

        var json: [String: Any] {
            var out: [String: Any] = ["kind": kind, "salutation": salutation, "name": name, "address": address, "email": email]
            out["clientId"] = clientId ?? NSNull()
            return out
        }

        var kindLabel: String { Communication.kinds.first { $0.value == kind }?.label ?? "Destinatario" }
    }

    static let kinds: [(value: String, label: String, salutation: String)] = [
        ("cliente", "Cliente", "Spett.le"),
        ("condomini", "Condòmini", "Gent.mi Condòmini"),
        ("amministratore", "Amministratore", "Spett.le Amministrazione"),
        ("architetto", "Architetto / D.L.", "Egr. Arch."),
        ("altro", "Altro", "Alla c.a."),
    ]

    static func today() -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: .now)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    static func empty() -> Communication {
        Communication(id: "", code: "", subject: "", body: LetterDoc.toDoc(""), recipients: [], place: "",
                      documentDate: today(), includeStamp: true, signatory: "", createdAt: "")
    }

    init(id: String, code: String, subject: String, body: [String: Any], recipients: [Recipient], place: String,
         documentDate: String, includeStamp: Bool, signatory: String, createdAt: String) {
        self.id = id
        self.code = code
        self.subject = subject
        self.body = body
        self.recipients = recipients
        self.place = place
        self.documentDate = documentDate
        self.includeStamp = includeStamp
        self.signatory = signatory
        self.createdAt = createdAt
    }

    init?(json: [String: Any]) {
        guard let id = json["id"] as? String else { return nil }
        self.id = id
        code = json["code"] as? String ?? ""
        subject = json["subject"] as? String ?? ""
        body = json["body"] as? [String: Any] ?? LetterDoc.toDoc("")
        recipients = (json["recipients"] as? [[String: Any]] ?? []).map(Recipient.init(json:))
        place = json["place"] as? String ?? ""
        documentDate = json["documentDate"] as? String ?? Self.today()
        includeStamp = json["includeStamp"] as? Bool ?? true
        signatory = json["signatory"] as? String ?? ""
        createdAt = json["createdAt"] as? String ?? ""
    }

    /// Corpo di POST/PATCH (communicationInputSchema).
    var input: [String: Any] {
        ["subject": subject, "body": body, "recipients": recipients.map(\.json), "place": place.isEmpty ? NSNull() : place,
         "documentDate": documentDate, "includeStamp": includeStamp, "signatory": signatory.isEmpty ? NSNull() : signatory]
    }

    var preview: String {
        let text = RichText.plain(LetterDoc.toText(body)).replacingOccurrences(of: "\n", with: " ")
        return text.isEmpty ? "Nessun testo" : text
    }
}
