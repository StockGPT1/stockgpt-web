import UIKit
import WebKit
import UserNotifications
import LocalAuthentication
import AuthenticationServices
import CryptoKit
import Security
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

private func stockGPTTransparentMark() -> UIImage? {
    guard let source = UIImage(named: "LaunchLogo"),
          let cgImage = source.cgImage else {
        return UIImage(named: "LaunchLogo")
    }

    let width = cgImage.width
    let height = cgImage.height
    let bytesPerRow = width * 4
    var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)
    let colorSpace = CGColorSpaceCreateDeviceRGB()

    return pixels.withUnsafeMutableBytes { rawBuffer -> UIImage? in
        guard let baseAddress = rawBuffer.baseAddress,
              let context = CGContext(
                data: baseAddress,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: bytesPerRow,
                space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
              ) else {
            return source
        }

        context.interpolationQuality = .high
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

        let bytes = rawBuffer.bindMemory(to: UInt8.self)
        for offset in stride(from: 0, to: bytes.count, by: 4) {
            let red = Int(bytes[offset])
            let green = Int(bytes[offset + 1])
            let blue = Int(bytes[offset + 2])

            // Preserve the original warm gold/yellow StockGPT mark and make
            // the dark green app-icon tile fully transparent.
            let isGoldMark =
                red > 55 &&
                green > 42 &&
                red > blue + 24 &&
                green > blue + 10 &&
                red >= green

            if !isGoldMark {
                bytes[offset] = 0
                bytes[offset + 1] = 0
                bytes[offset + 2] = 0
                bytes[offset + 3] = 0
            }
        }

        guard let output = context.makeImage() else { return source }
        return UIImage(cgImage: output, scale: source.scale, orientation: source.imageOrientation)
    }
}

private func stockGPTPath(for shortcutItem: UIApplicationShortcutItem) -> String? {
    switch shortcutItem.type {
    case "pro.stockgpt.app.search":
        return "/dashboard?search=1"
    case "pro.stockgpt.app.rankings":
        return "/rankings"
    case "pro.stockgpt.app.portfolio":
        return "/portfolio"
    case "pro.stockgpt.app.alerts":
        return "/notifications"
    default:
        return nil
    }
}

final class StockGPTBridgeViewController: CAPBridgeViewController,
    WKScriptMessageHandler,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding,
    ASWebAuthenticationPresentationContextProviding {

    var pendingAppPath: String?

    private var appleSignInNonce: String?
    private var webAuthSession: ASWebAuthenticationSession?
    private var stockGPTBootOverlay: UIView?
    private var stockGPTWebProgressObservation: NSKeyValueObservation?

    private lazy var stockGPTRefreshControl: UIRefreshControl = {
        let control = UIRefreshControl()
        control.tintColor = stockGPTGold
        control.addTarget(self, action: #selector(refreshStockGPT), for: .valueChanged)
        return control
    }()

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = stockGPTBackground
        installStockGPTBootOverlay()
    }

    private func installStockGPTBootOverlay() {
        guard stockGPTBootOverlay == nil else { return }

        let overlay = UIView()
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.backgroundColor = stockGPTBackground
        overlay.isUserInteractionEnabled = false

        let logo = UIImageView(image: stockGPTTransparentMark())
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.contentMode = .scaleAspectFit

        overlay.addSubview(logo)
        view.addSubview(overlay)

        NSLayoutConstraint.activate([
            overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            overlay.topAnchor.constraint(equalTo: view.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            logo.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            logo.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            logo.widthAnchor.constraint(equalToConstant: 104),
            logo.heightAnchor.constraint(equalToConstant: 104),
        ])

        stockGPTBootOverlay = overlay
    }

    private func hideStockGPTBootOverlay() {
        guard let overlay = stockGPTBootOverlay else { return }
        stockGPTBootOverlay = nil
        stockGPTWebProgressObservation = nil

        UIView.animate(
            withDuration: 0.18,
            delay: 0,
            options: [.curveEaseOut, .allowUserInteraction]
        ) {
            overlay.alpha = 0
        } completion: { _ in
            overlay.removeFromSuperview()
        }
    }

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

        // iOS removes LaunchScreen as soon as the native view controller is
        // ready, which previously exposed the plain green WKWebView background
        // while the remote app was still loading. Keep the logo overlay above
        // the web view until its first navigation actually completes.
        installStockGPTBootOverlay()
        if let overlay = stockGPTBootOverlay {
            view.bringSubviewToFront(overlay)
        }
        stockGPTWebProgressObservation = webView.observe(
            \.estimatedProgress,
            options: [.initial, .new]
        ) { [weak self] observedWebView, _ in
            guard observedWebView.estimatedProgress >= 1.0 else { return }
            DispatchQueue.main.async {
                self?.hideStockGPTBootOverlay()
            }
        }

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

        if let path = pendingAppPath {
            pendingAppPath = nil
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                self?.openAppPath(path)
            }
        }
    }

    deinit {
        stockGPTWebProgressObservation = nil
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "stockgptNative")
        NotificationCenter.default.removeObserver(self)
    }

    func openAppPath(_ path: String) {
        guard path.hasPrefix("/") else { return }
        guard webView != nil else {
            pendingAppPath = path
            return
        }

        let safePath = path
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        webView?.evaluateJavaScript("window.location.assign('\(safePath)');")
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
        case "getPushToken":
            emitSavedPushToken()
        case "authenticate":
            authenticate(reason: payload["reason"] as? String)
        case "appleSignIn":
            beginAppleSignIn()
        case "oauthSession":
            guard let urlString = payload["url"] as? String,
                  let url = URL(string: urlString) else {
                emitEvent("stockgpt:oauth-result", detail: ["error": "Could not open the sign-in page."])
                return
            }
            beginOAuthSession(
                url: url,
                callbackScheme: payload["callbackScheme"] as? String ?? "stockgpt"
            )
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

    private func emitSavedPushToken() {
        let defaults = UserDefaults.standard

        if let token = defaults.string(forKey: stockGPTPushTokenDefaultsKey),
           !token.isEmpty {
            let environment =
                defaults.string(forKey: stockGPTPushEnvironmentDefaultsKey) == "production"
                    ? "production"
                    : "sandbox"

            emitEvent(
                "stockgpt:push-token",
                detail: ["token": token, "environment": environment]
            )
            return
        }

        // Permission may already be granted while no token has been persisted yet
        // (for example after reinstalling or upgrading the app). Ask APNs for the
        // current token instead of relying on launch timing.
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
                return
            }

            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
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

    private func beginAppleSignIn() {
        let nonce = randomNonceString()
        appleSignInNonce = nonce

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8),
              let nonce = appleSignInNonce else {
            appleSignInNonce = nil
            emitEvent("stockgpt:apple-auth-result", detail: ["error": "Apple did not return a usable identity token."])
            return
        }

        var detail: [String: Any] = [
            "token": token,
            "nonce": nonce
        ]

        if let email = credential.email, !email.isEmpty {
            detail["email"] = email
        }
        if let givenName = credential.fullName?.givenName, !givenName.isEmpty {
            detail["givenName"] = givenName
        }
        if let familyName = credential.fullName?.familyName, !familyName.isEmpty {
            detail["familyName"] = familyName
        }

        appleSignInNonce = nil
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        emitEvent("stockgpt:apple-auth-result", detail: detail)
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        appleSignInNonce = nil
        let authError = error as? ASAuthorizationError
        let cancelled = authError?.code == .canceled
        emitEvent(
            "stockgpt:apple-auth-result",
            detail: [
                "cancelled": cancelled,
                "error": cancelled ? "Sign in with Apple was cancelled." : error.localizedDescription
            ]
        )
    }

    private func beginOAuthSession(url: URL, callbackScheme: String) {
        guard webAuthSession == nil else {
            emitEvent("stockgpt:oauth-result", detail: ["error": "A sign-in window is already open."])
            return
        }

        let session = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: callbackScheme
        ) { [weak self] callbackURL, error in
            DispatchQueue.main.async {
                self?.webAuthSession = nil

                if let callbackURL {
                    self?.emitEvent("stockgpt:oauth-result", detail: ["url": callbackURL.absoluteString])
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    return
                }

                let authError = error as? ASWebAuthenticationSessionError
                let cancelled = authError?.code == .canceledLogin
                self?.emitEvent(
                    "stockgpt:oauth-result",
                    detail: [
                        "cancelled": cancelled,
                        "error": cancelled ? "Sign in was cancelled." : (error?.localizedDescription ?? "Sign in did not complete.")
                    ]
                )
            }
        }

        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        webAuthSession = session

        if !session.start() {
            webAuthSession = nil
            emitEvent("stockgpt:oauth-result", detail: ["error": "Could not open the secure sign-in window."])
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        presentationWindow()
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        presentationWindow()
    }

    private func presentationWindow() -> UIWindow {
        if let window = view.window {
            return window
        }

        if let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first,
           let window = scene.windows.first {
            return window
        }

        return UIWindow(frame: UIScreen.main.bounds)
    }

    private func randomNonceString() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            return UUID().uuidString.replacingOccurrences(of: "-", with: "")
        }

        return Data(bytes)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func sha256(_ value: String) -> String {
        let digest = SHA256.hash(data: Data(value.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    @objc private func receivedPushToken(_ notification: Notification) {
        guard let token = notification.userInfo?["token"] as? String else { return }
        let environment = notification.userInfo?["environment"] as? String ?? "sandbox"
        emitEvent(
            "stockgpt:push-token",
            detail: ["token": token, "environment": environment]
        )
    }

    @objc private func receivedPushRegistrationError(_ notification: Notification) {
        let message = notification.userInfo?["message"] as? String ?? "Push registration failed"
        emitEvent("stockgpt:push-registration-error", detail: ["message": message])
    }

    @objc private func openPushPath(_ notification: Notification) {
        guard let path = notification.userInfo?["path"] as? String,
              path.hasPrefix("/") else { return }
        openAppPath(path)
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
        if let shortcutItem = connectionOptions.shortcutItem {
            bridgeViewController.pendingAppPath = stockGPTPath(for: shortcutItem)
        }

        appWindow.backgroundColor = stockGPTBackground
        appWindow.tintColor = stockGPTGold
        appWindow.overrideUserInterfaceStyle = .dark
        bridgeViewController.view.backgroundColor = stockGPTBackground

        appWindow.rootViewController = bridgeViewController
        appWindow.makeKeyAndVisible()
        window = appWindow

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func windowScene(
        _ windowScene: UIWindowScene,
        performActionFor shortcutItem: UIApplicationShortcutItem,
        completionHandler: @escaping (Bool) -> Void
    ) {
        guard let path = stockGPTPath(for: shortcutItem),
              let bridgeViewController = window?.rootViewController as? StockGPTBridgeViewController else {
            completionHandler(false)
            return
        }

        bridgeViewController.openAppPath(path)
        completionHandler(true)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
