import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let stockGPTBackground = UIColor(
            red: 4.0 / 255.0,
            green: 24.0 / 255.0,
            blue: 15.0 / 255.0,
            alpha: 1.0
        )
        let stockGPTGold = UIColor(
            red: 221.0 / 255.0,
            green: 177.0 / 255.0,
            blue: 89.0 / 255.0,
            alpha: 1.0
        )

        let appWindow = UIWindow(windowScene: windowScene)
        let bridgeViewController = CAPBridgeViewController()

        // Match the web product before WKWebView paints its first frame so
        // launch/resume never flashes Apple's default white background.
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
