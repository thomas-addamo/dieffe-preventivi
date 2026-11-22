import SwiftUI

// ─────────────────────────────────────────────────────────────────────────────
// La "presenza" dell'IA nel sopralluogo: una sfera di colore liquido (blu e
// azzurro Dieffe, un filo di viola) che
//  • respira piano quando è in pausa o in attesa;
//  • si gonfia e si agita con la voce mentre ascolta;
//  • gira più veloce, con un anello luminoso, quando sta elaborando.
// ─────────────────────────────────────────────────────────────────────────────

enum OrbMood: Equatable { case idle, listening, thinking }

struct SurveyOrb: View {
    var mood: OrbMood
    /// Livello della voce 0…1.
    var level: Double
    var size: CGFloat = 180

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var clock = OrbClock()

    private static let palette: [Color] = [
        Color(red: 0.18, green: 0.29, blue: 0.62), // blu Dieffe
        Color(red: 0.33, green: 0.70, blue: 0.89), // azzurro Dieffe
        Color(red: 0.44, green: 0.36, blue: 0.93), // viola
        Color(red: 0.55, green: 0.85, blue: 1.00), // celeste
        Color(red: 0.12, green: 0.25, blue: 0.69), // blu profondo
    ]

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 60, paused: reduceMotion)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            // Velocità dei colori: lenta a riposo, più svelta quando parli, svelta quando elabora.
            let speed = mood == .thinking ? 0.9 : mood == .listening ? 0.35 + clock.level * 0.9 : 0.22
            // La fase avanza fotogramma per fotogramma: cambiando velocità i colori accelerano
            // o rallentano con fluidità, senza salti (prima era t × velocità e saltava).
            let phase = clock.advance(to: t, speed: speed, level: level)
            let pulse = mood == .idle ? 0.025 * sin(t * 1.6) : 0
            let scale = 1 + pulse + (mood == .listening ? clock.level * 0.12 : 0) + (mood == .thinking ? 0.03 * sin(t * 4) : 0)

            ZStack {
                // Alone morbido dietro, più forte quando parli.
                Circle()
                    .fill(Self.palette[1].opacity(0.35 + level * 0.3))
                    .blur(radius: size * 0.22)
                    .scaleEffect(1.05 + level * 0.25)

                MeshGradient(width: 3, height: 3, points: points(phase: phase, energy: mood == .listening ? 0.6 + clock.level * 0.6 : 0.5),
                             colors: colors(phase: phase), smoothsColors: true)
                    .clipShape(Circle())
                    .overlay {
                        // Riflesso in alto a sinistra: sembra una goccia di vetro.
                        Circle()
                            .fill(LinearGradient(colors: [.white.opacity(0.55), .clear], startPoint: .topLeading, endPoint: .center))
                            .blur(radius: size * 0.06)
                            .padding(size * 0.08)
                            .blendMode(.plusLighter)
                    }
                    .overlay {
                        Circle().strokeBorder(.white.opacity(0.35), lineWidth: 1)
                    }

                if mood == .thinking {
                    Circle()
                        .trim(from: 0, to: 0.32)
                        .stroke(AngularGradient(colors: [Self.palette[1].opacity(0), Self.palette[1], Self.palette[2]], center: .center),
                                style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        .rotationEffect(.radians(t * 3.2))
                        .padding(-10)
                        .transition(.opacity)
                }
            }
            .frame(width: size, height: size)
            .scaleEffect(scale)
        }
        .animation(.smooth(duration: 0.4), value: mood)
        .accessibilityElement()
        .accessibilityLabel(mood == .listening ? "Ti sto ascoltando" : mood == .thinking ? "Sto elaborando" : "In attesa")
    }

    /// I 9 punti della griglia: quelli interni ondeggiano, quelli sul bordo restano fermi.
    private func points(phase: Double, energy: Double) -> [SIMD2<Float>] {
        func wobble(_ base: Float, _ freq: Double, _ offset: Double, _ amount: Double) -> Float {
            base + Float(sin(phase * freq + offset) * amount * energy)
        }
        return [
            [0, 0], [wobble(0.5, 1.1, 0, 0.18), 0], [1, 0],
            [0, wobble(0.5, 0.9, 1.3, 0.18)], [wobble(0.5, 1.3, 2.1, 0.22), wobble(0.5, 1.7, 0.4, 0.22)], [1, wobble(0.5, 1.2, 2.6, 0.18)],
            [0, 1], [wobble(0.5, 0.8, 3.4, 0.18), 1], [1, 1],
        ]
    }

    /// I colori ruotano lentamente tra i punti: il liquido sembra girare.
    private func colors(phase: Double) -> [Color] {
        let p = Self.palette
        let shift = Int(phase * 0.6) % p.count
        return (0..<9).map { i in
            let base = p[(i + shift) % p.count]
            let next = p[(i + shift + 1) % p.count]
            let f = phase * 0.6 - floor(phase * 0.6)
            return i == 4 ? Self.palette[3] : base.mix(with: next, by: f)
        }
    }
}

/// Orologio interno della sfera: somma la fase nel tempo e smussa il livello della voce.
private final class OrbClock {
    private var last: Double?
    private(set) var phase: Double = 0
    private(set) var level: Double = 0

    func advance(to time: Double, speed: Double, level target: Double) -> Double {
        let dt = min(0.1, max(0, time - (last ?? time)))
        last = time
        // Il livello segue la voce con un po' di ritardo: niente scatti.
        level += (target - level) * min(1, dt * 6)
        phase += dt * speed
        return phase
    }
}

#Preview {
    VStack(spacing: 40) {
        SurveyOrb(mood: .idle, level: 0)
        SurveyOrb(mood: .listening, level: 0.6, size: 120)
        SurveyOrb(mood: .thinking, level: 0, size: 120)
    }
}
