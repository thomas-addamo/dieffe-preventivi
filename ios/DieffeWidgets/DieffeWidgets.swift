import ActivityKit
import SwiftUI
import WidgetKit

@main
struct DieffeWidgetsBundle: WidgetBundle {
    var body: some Widget {
        DieffeLiveActivity()
    }
}

/// Dynamic Island e schermata di blocco per le attività di DieffeActivity.swift.
struct DieffeLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DieffeActivityAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(nil)
                .widgetURL(context.attributes.url)
        } dynamicIsland: { context in
            let a = context.attributes
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(a.kind == .task ? (a.taskName ?? "") : a.mediumCode)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                    } icon: {
                        Image(systemName: a.symbol).foregroundStyle(.tint)
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Group {
                        switch a.kind {
                        case .editing:
                            if let total = s.total {
                                Text(total, format: .currency(code: "EUR").locale(Locale(identifier: "it_IT")))
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                            }
                        case .task:
                            PhaseIcon(phase: s.phase)
                        case .siteVisit:
                            Text(timerInterval: a.startedAt...Date.distantFuture, countsDown: false)
                                .font(.subheadline.weight(.semibold))
                                .monospacedDigit()
                                .multilineTextAlignment(.trailing)
                        }
                    }
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ExpandedBottom(attributes: a, state: s)
                }
            } compactLeading: {
                HStack(spacing: 4) {
                    Image(systemName: a.symbol).foregroundStyle(.tint)
                    if a.kind != .task {
                        Text(a.shortCode).font(.caption.weight(.semibold)).monospacedDigit()
                    }
                }
            } compactTrailing: {
                switch a.kind {
                case .editing:
                    Text(s.total.map(CompactMoney.format) ?? "")
                        .font(.caption.weight(.semibold))
                        .monospacedDigit()
                case .task:
                    PhaseIcon(phase: s.phase)
                case .siteVisit:
                    Text(timerInterval: a.startedAt...Date.distantFuture, countsDown: false)
                        .font(.caption.weight(.semibold))
                        .monospacedDigit()
                        .frame(maxWidth: 46)
                }
            } minimal: {
                if a.kind == .task, s.phase != .running {
                    PhaseIcon(phase: s.phase)
                } else {
                    Image(systemName: a.symbol).foregroundStyle(.tint)
                }
            }
            .widgetURL(a.url)
            .keylineTint(.accentColor)
        }
    }
}

private struct PhaseIcon: View {
    let phase: DieffeActivityAttributes.Phase

    var body: some View {
        switch phase {
        case .running:
            ProgressView().progressViewStyle(.circular).tint(.accentColor)
        case .done:
            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
        case .failed:
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
        }
    }
}

private struct ExpandedBottom: View {
    let attributes: DieffeActivityAttributes
    let state: DieffeActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(state.title)
                .font(.headline)
                .lineLimit(1)
            if let detail = state.detail ?? attributes.clientName {
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if attributes.kind == .siteVisit {
                if let address = attributes.address {
                    Label(address, systemImage: "mappin")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                SiteVisitButtons(attributes: attributes)
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }
}

private struct SiteVisitButtons: View {
    let attributes: DieffeActivityAttributes

    var body: some View {
        HStack(spacing: 8) {
            if let url = attributes.addItemURL {
                Link(destination: url) {
                    Label("Aggiungi voce", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(Color.accentColor, in: Capsule())
                        .foregroundStyle(.white)
                }
            }
            if let url = attributes.endVisitURL {
                Link(destination: url) {
                    Label("Termina", systemImage: "stop.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(.white.opacity(0.18), in: Capsule())
                }
            }
        }
    }
}

/// Schermata di blocco (e notifiche): tutte le informazioni, codice intero.
private struct LockScreenView: View {
    let attributes: DieffeActivityAttributes
    let state: DieffeActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: attributes.symbol)
                    .font(.title3)
                    .foregroundStyle(.tint)
                VStack(alignment: .leading, spacing: 1) {
                    Text(heading)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(state.title)
                        .font(.headline)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                trailing
            }
            if let detail = state.detail ?? attributes.clientName {
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if attributes.kind == .siteVisit {
                if let address = attributes.address {
                    Label(address, systemImage: "mappin")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                if state.phase == .running {
                    SiteVisitButtons(attributes: attributes)
                }
            }
        }
        .padding(16)
    }

    private var heading: String {
        switch attributes.kind {
        case .editing: "\(attributes.code ?? "") · in modifica"
        case .task: attributes.taskName ?? "Dieffe"
        case .siteVisit: "Sopralluogo · \(attributes.code ?? "")"
        }
    }

    @ViewBuilder
    private var trailing: some View {
        switch attributes.kind {
        case .editing:
            if let total = state.total {
                Text(total, format: .currency(code: "EUR").locale(Locale(identifier: "it_IT")))
                    .font(.headline)
                    .monospacedDigit()
            }
        case .task:
            PhaseIcon(phase: state.phase)
        case .siteVisit:
            if state.phase == .running {
                Text(timerInterval: attributes.startedAt...Date.distantFuture, countsDown: false)
                    .font(.title3.weight(.semibold))
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 90, alignment: .trailing)
            } else {
                PhaseIcon(phase: .done)
            }
        }
    }
}
