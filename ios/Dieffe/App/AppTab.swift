import Foundation

/// Le sezioni della tab bar nativa: le stesse della tab bar mobile del sito
/// (src/components/shared/mobile/MobileTabBar.tsx).
enum AppTab: String, CaseIterable, Identifiable, Hashable {
    case home, clienti, profilo, altro
    /// Non è una sezione: il tap apre "Nuovo preventivo" nella Home.
    case nuovo

    var id: String { rawValue }

    static let sections: [AppTab] = [.home, .clienti, .profilo, .altro]

    var title: String {
        switch self {
        case .home: "Home"
        case .clienti: "Clienti"
        case .profilo: "Profilo"
        case .altro: "Altro"
        case .nuovo: "Nuovo"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .clienti: "person.2"
        case .profilo: "person.crop.circle"
        case .altro: "square.grid.2x2"
        case .nuovo: "plus"
        }
    }

    var path: String {
        switch self {
        case .home: "/dashboard"
        case .clienti: "/clienti"
        case .profilo: "/profilo"
        case .altro: "/altro"
        case .nuovo: "/dashboard?nuovo=1"
        }
    }
}
