import SwiftUI

struct LockView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
            Text("Dieffe Preventivi")
                .font(.title2.bold())
            Text("App bloccata")
                .foregroundStyle(.secondary)
            Spacer()
            Button {
                Task { await model.lock.unlock() }
            } label: {
                Label("Sblocca con \(AppLock.biometryName)", systemImage: "faceid")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .disabled(model.lock.isAuthenticating)
            .padding(.horizontal, 32)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.background)
        .task { await model.lock.unlock() }
    }
}
