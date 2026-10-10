import LocalAuthentication
import Observation
import SwiftUI

/// Blocco con Face ID / Touch ID (codice del telefono come riserva): all'avvio
/// e quando l'app torna in primo piano dopo più di un minuto.
@MainActor
@Observable
final class AppLock {
    private static let enabledKey = "faceIDLockEnabled"
    private static let graceSeconds: TimeInterval = 60

    var isEnabled: Bool {
        didSet { UserDefaults.standard.set(isEnabled, forKey: Self.enabledKey) }
    }
    private(set) var isLocked: Bool
    private(set) var isAuthenticating = false
    @ObservationIgnored private var backgroundedAt: Date?

    init() {
        let stored = UserDefaults.standard.object(forKey: Self.enabledKey) as? Bool
        let enabled = stored ?? Self.biometryAvailable
        isEnabled = enabled
        isLocked = enabled
    }

    static var biometryAvailable: Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }

    static var biometryName: String {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default: return "codice"
        }
    }

    func scenePhaseChanged(_ phase: ScenePhase) {
        switch phase {
        case .background:
            backgroundedAt = backgroundedAt ?? Date()
        case .active:
            if isEnabled, let since = backgroundedAt, Date().timeIntervalSince(since) > Self.graceSeconds {
                isLocked = true
            }
            backgroundedAt = nil
            if isLocked { Task { await unlock() } }
        default:
            break
        }
    }

    func unlock() async {
        guard isLocked, !isAuthenticating else { return }
        isAuthenticating = true
        defer { isAuthenticating = false }
        let context = LAContext()
        context.localizedCancelTitle = "Annulla"
        do {
            if try await context.evaluatePolicy(.deviceOwnerAuthentication,
                                                localizedReason: "Sblocca Dieffe Preventivi") {
                isLocked = false
            }
        } catch {
            // Resta bloccata: l'utente può riprovare dal pulsante.
        }
    }
}
