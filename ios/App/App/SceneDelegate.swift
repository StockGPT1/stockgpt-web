import UIKit
import WebKit
import UserNotifications
import LocalAuthentication
import Capacitor

private let stockGPTBackground = UIColor(
    red: 4.0 / 255.0,
    green: 24.0 / 255.0,
    blue: 15.0 / 255.0,
    alpha: 1.0
)

private let stockGPTGold = UIColor(
    red: 221.0 / 255.0,
    green: 177.0 / 255.0,
    blue: 89.0 / 255.0,
    alpha: 1.0
)

final class StockGPTBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private lazy var stockGPTRefreshControl: UIRefreshControl = {
        let control = UIRefreshControl()
        control.tintColor = stockGPTGold
        control.addTarget(self, action: #selector(refreshStockGPT), for: .valueChanged)
        return control
    }()

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        view.backgroundColor = stockGPTBackground
        setStatusBarStyle(.lightContent)

        guard let webView else { return }
        webView.isOpaque = false
        webView.backgroundColor = stockGPTBackground
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.backgroundColor = stockGPTBackground
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.alwaysBounceVertical = true
        webView.scrollView.scrollsToTop = true
        webView.scrollView.refreshControl = stockGPTRefreshControl
        webView.configuration.userContentController.add(self, name: "stockgptNative")

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(receivedPushToken(_:)),
            name: .stockGPTPushToken,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(receivedPushRegistrationError(_:)),
            name: .stockGPTPushRegistrationError,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(openPushPath(_:)),
            name: .stockGPTPushOpenPath,
            object: nil
        )
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "stockgptNative")
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func refreshStockGPT() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        webView?.reload()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.stockGPTRefreshControl.endRefreshing()
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "stockgptNative",
              let payload = message.body as? [String: Any],
              let type = payload["type"] as? String else { return }

        switch type {
        case "haptic":
            performHaptic(style: payload["style"] as? String ?? "light")
        case "share":
            presentShareSheet(payload: payload)
        case "enablePush":
            requestPushPermission()
        case "authenticate":
            authenticate(reason: payload["reason"] as? String)
        default:
            break
        }
    }

    private func performHaptic(style: String) {
        switch style {
        case "medium":
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case "heavy":
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        case "success":
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "warning":
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case "error":
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        default:
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    private func presentShareSheet(payload: [String: Any]) {
        var items: [Any] = []

        if let text = payload["text"] as? String, !text.isEmpty {
            items.append(text)
        }
        if let urlString = payload["url"] as? String,
           let url = URL(string: urlString) {
            items.append(url)
        }

        guard !items.isEmpty else { return }

        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let popover = controller.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 40, width: 1, height: 1)
        }
        present(controller, animated: true)
    }

    private func requestPushPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { [weak self] granted, error in
            DispatchQueue.main.async {
                if let error {
                    self?.emitEvent("stockgpt:push-registration-error", detail: ["message": error.localizedDescription])
                    UINotificationFeedbackGenerator().notificationOccurred(.error)
                    return
                }

                self?.emitEvent("stockgpt:push-permission", detail: ["granted": granted])

                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                } else {
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                }
            }
        }
    }

    private func authenticate(reason: String?) {
        let context = LAContext()
        context.localizedCancelTitle = "Not now"
        var error: NSError?
        let prompt = (reason?.isEmpty == false ? reason : nil) ?? "Unlock StockGPT to view your portfolio and account."

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            emitEvent(
                "stockgpt:biometric-result",
                detail: [
                    "success": false,
                    "available": false,
                    "message": error?.localizedDescription ?? "Face ID or Touch ID is not available on this device."
                ]
            )
            return
        }

        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: prompt) { [weak self] success, authError in
            DispatchQueue.main.async {
                self?.emitEvent(
                    "stockgpt:biometric-result",
                    detail: [
                        "success": success,
                        "available": true,
                        "message": authError?.localizedDescription ?? ""
                    ]
                )
                if success {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                }
            }
        }
    }

    @objc private func receivedPushToken(_ notification: Notification) {
        guard let token = notification.userInfo?["token"] as? String else { return }
        emitEvent("stockgpt:push-token", detail: ["token": token])
    }

    @objc private func receivedPushRegistrationError(_ notification: Notification) {
        let message = notification.userInfo?["message"] as? String ?? "Push registration failed"
        emitEvent("stockgpt:push-registration-error", detail: ["message": message])
    }

    @objc private func openPushPath(_ notification: Notification) {
        guard let path = notification.userInfo?["path"] as? String,
              path.hasPrefix("/") else { return }
        emitEvent("stockgpt:push-open", detail: ["path": path])
    }

    private func emitEvent(_ name: String, detail: [String: Any]) {
        guard let webView,
              JSONSerialization.isValidJSONObject(detail),
              let data = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: data, encoding: .utf8) else { return }

        let escapedName = name.replacingOccurrences(of: "'", with: "\\'")
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('\(escapedName)', { detail: \(json) }));"
        )
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let appWindow = UIWindow(windowScene: windowScene)
        let bridgeViewController = StockGPTBridgeViewController()

        appWindow.backgroundColor = stockGPTBackground
        appWindow.tintColor = stockGPTGold
        appWindow.overrideUserInterfaceStyle = .dark
        bridgeViewController.view.backgroundColor = stockGPTBackground

        appWindow.rootViewController = bridgeViewController
        appWindow.makeKeyAndVisible()
        window = appWindow

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
