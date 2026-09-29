//
//  AloWebView.swift
//  AloAI
//
//  Ultra-responsive Hardware-Accelerated WebKit Container
//  Direct native bridge with 120Hz ProMotion Taptic feedback and media handling.
//

import SwiftUI
import WebKit

struct AloWebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var canGoBack: Bool
    @Binding var loadError: Error?

    // Custom Native Bridge Script
    private let nativeBridgeJs = """
    (function() {
        window.isNativeApp = true;
        window.isIOSApp = true;
        if (document.documentElement) document.documentElement.classList.add('is-ios-app', 'is-native-app');
        if (document.body) document.body.classList.add('is-ios-app', 'is-native-app');

        var s = document.getElementById('alo-ios-native-style');
        if (!s) {
            s = document.createElement('style');
            s.id = 'alo-ios-native-style';
            s.textContent = '#heroAppDownloadBanner,#drawerDownloadAppWrap,#brandMenuDownloadAppBtn,#appDownloadModalOverlay,.hero-app-banner{display:none!important;visibility:hidden!important;height:0!important;margin:0!important;padding:0!important;}';
            (document.head || document.documentElement).appendChild(s);
        }

        window.AloIOS = {
            vibrate: function(ms) {
                try { window.webkit.messageHandlers.AloNative.postMessage({ action: 'haptic', style: 'medium' }); } catch(e){}
            },
            haptic: function(style) {
                try { window.webkit.messageHandlers.AloNative.postMessage({ action: 'haptic', style: style || 'light' }); } catch(e){}
            },
            showToast: function(msg) {
                try { window.webkit.messageHandlers.AloNative.postMessage({ action: 'toast', message: msg }); } catch(e){}
            },
            share: function(text, url) {
                try { window.webkit.messageHandlers.AloNative.postMessage({ action: 'share', text: text, url: url }); } catch(e){}
            },
            saveAuth: function(token, name, email, plan) {
                try { window.webkit.messageHandlers.AloNative.postMessage({ action: 'saveAuth', token: token, name: name, email: email, plan: plan }); } catch(e){}
            },
            isNativeApp: function() { return true; },
            getAppVersion: function() { return "1.1.0"; }
        };

        window.AloAI = window.AloIOS;
    })();
    """

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true

        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences = preferences
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = WKWebsiteDataStore.default()

        // Inject Native Bridge JS at document start
        let userScript = WKUserScript(
            source: nativeBridgeJs,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        config.userContentController.addUserScript(userScript)
        config.userContentController.add(context.coordinator, name: "AloNative")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator

        // ProMotion 120Hz & AMOLED Dark Optimization
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.024, green: 0.027, blue: 0.035, alpha: 1.0)
        webView.scrollView.backgroundColor = UIColor(red: 0.024, green: 0.027, blue: 0.035, alpha: 1.0)
        webView.scrollView.indicatorStyle = .white
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = true
        webView.allowsBackForwardNavigationGestures = true

        // Custom iOS User Agent
        let defaultUA = webView.customUserAgent ?? ""
        webView.customUserAgent = "\(defaultUA) AloAI-iOS/1.1.0 (Native iOS; ProMotion)"

        context.coordinator.webView = webView

        let request = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30)
        webView.load(request)

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Dynamic state updates if needed
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var parent: AloWebView
        weak var webView: WKWebView?
        private let lightHaptic = UIImpactFeedbackGenerator(style: .light)
        private let mediumHaptic = UIImpactFeedbackGenerator(style: .medium)
        private let heavyHaptic = UIImpactFeedbackGenerator(style: .heavy)
        private let notifyHaptic = UINotificationFeedbackGenerator()

        init(_ parent: AloWebView) {
            self.parent = parent
            super.init()
            lightHaptic.prepare()
            mediumHaptic.prepare()
            heavyHaptic.prepare()
        }

        // Handle JavaScript Bridge Messages
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "AloNative", let body = message.body as? [String: Any] else { return }
            let action = body["action"] as? String ?? ""

            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                switch action {
                case "haptic":
                    let style = body["style"] as? String ?? "light"
                    switch style {
                    case "heavy": self.heavyHaptic.impactOccurred()
                    case "medium": self.mediumHaptic.impactOccurred()
                    case "success": self.notifyHaptic.notificationOccurred(.success)
                    case "error": self.notifyHaptic.notificationOccurred(.error)
                    default: self.lightHaptic.impactOccurred()
                    }
                case "saveAuth":
                    if let token = body["token"] as? String {
                        UserDefaults.standard.set(token, forKey: "alo_auth_token")
                        UserDefaults.standard.set(body["name"] as? String ?? "", forKey: "alo_user_name")
                        UserDefaults.standard.set(body["email"] as? String ?? "", forKey: "alo_user_email")
                        UserDefaults.standard.set(body["plan"] as? String ?? "Free", forKey: "alo_user_plan")
                    }
                case "share":
                    if let text = body["text"] as? String {
                        let activityVC = UIActivityViewController(activityItems: [text], applicationActivities: nil)
                        if let rootVC = UIApplication.shared.windows.first?.rootViewController {
                            rootVC.present(activityVC, animated: true)
                        }
                    }
                default:
                    break
                }
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = true
                self.parent.loadError = nil
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.canGoBack = webView.canGoBack
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.loadError = error
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.loadError = error
            }
        }

        // Link navigation rules: Keep internal links inside webview, open external in Safari
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let targetUrl = navigationAction.request.url {
                let host = targetUrl.host?.lowercased() ?? ""
                if host.contains("ai.zihan.xyz") || host.contains("zihan.xyz") || host == "localhost" {
                    decisionHandler(.allow)
                    return
                } else if navigationAction.navigationType == .linkActivated {
                    UIApplication.shared.open(targetUrl)
                    decisionHandler(.cancel)
                    return
                }
            }
            decisionHandler(.allow)
        }
    }
}
