import UIKit
import UserNotifications
import Capacitor

let stockGPTPushTokenDefaultsKey = "stockgpt.push.token"
let stockGPTPushEnvironmentDefaultsKey = "stockgpt.push.environment"

extension Notification.Name {
    static let stockGPTPushToken = Notification.Name("StockGPTPushToken")
    static let stockGPTPushRegistrationError = Notification.Name("StockGPTPushRegistrationError")
    static let stockGPTPushOpenPath = Notification.Name("StockGPTPushOpenPath")
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif

        let defaults = UserDefaults.standard
        defaults.set(token, forKey: stockGPTPushTokenDefaultsKey)
        defaults.set(environment, forKey: stockGPTPushEnvironmentDefaultsKey)

        NotificationCenter.default.post(
            name: .stockGPTPushToken,
            object: nil,
            userInfo: ["token": token, "environment": environment]
        )
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .stockGPTPushRegistrationError,
            object: nil,
            userInfo: ["message": error.localizedDescription]
        )
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound, .badge])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let path = userInfo["path"] as? String, path.hasPrefix("/") {
            NotificationCenter.default.post(
                name: .stockGPTPushOpenPath,
                object: nil,
                userInfo: ["path": path]
            )
        }
        completionHandler()
    }

    func applicationWillResignActive(_ application: UIApplication) {}

    func applicationDidEnterBackground(_ application: UIApplication) {}

    func applicationWillEnterForeground(_ application: UIApplication) {}

    func applicationDidBecomeActive(_ application: UIApplication) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
                return
            }

            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
