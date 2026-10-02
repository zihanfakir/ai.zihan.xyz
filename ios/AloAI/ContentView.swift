//
//  ContentView.swift
//  AloAI
//
//  Master Container with Native State Management and Offline Handling
//

import SwiftUI

struct ContentView: View {
    @State private var isLoading = false
    @State private var canGoBack = false
    @State private var loadError: Error?
    @State private var webViewId = UUID()

    private let appUrl = URL(string: "https://alora.zihan.xyz/")!

    var body: some View {
        ZStack {
            Color(red: 0.024, green: 0.027, blue: 0.035)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Top Slim Progress Bar
                if isLoading {
                    ProgressView()
                        .progressViewStyle(LinearProgressViewStyle(tint: Color(red: 0.23, green: 0.51, blue: 0.96)))
                        .frame(height: 2)
                        .transition(.opacity)
                }

                // Main Web Container or Offline Fallback
                if let _ = loadError {
                    OfflineFallbackView {
                        let haptic = UIImpactFeedbackGenerator(style: .medium)
                        haptic.impactOccurred()
                        loadError = nil
                        webViewId = UUID() // Force reload
                    }
                } else {
                    AloWebView(
                        url: appUrl,
                        isLoading: $isLoading,
                        canGoBack: $canGoBack,
                        loadError: $loadError
                    )
                    .id(webViewId)
                    .ignoresSafeArea(.keyboard, edges: .bottom)
                }
            }
        }
    }
}

struct OfflineFallbackView: View {
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            ZStack {
                Circle()
                    .fill(Color(red: 0.09, green: 0.10, blue: 0.14))
                    .frame(width: 96, height: 96)

                Image(systemName: "wifi.slash")
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundColor(Color(red: 0.94, green: 0.27, blue: 0.27))
            }

            VStack(spacing: 8) {
                Text("ইন্টারনেট সংযোগ নেই")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.white)

                Text("অনুগ্রহ করে আপনার Wi-Fi বা মোবাইল ডাটা পরীক্ষা করে আবার চেষ্টা করুন।")
                    .font(.system(size: 15))
                    .foregroundColor(Color(red: 0.6, green: 0.64, blue: 0.72))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Button(action: onRetry) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 16, weight: .semibold))
                    Text("আবার চেষ্টা করুন")
                        .font(.system(size: 16, weight: .semibold))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 28)
                .padding(.vertical, 14)
                .background(Color(red: 0.23, green: 0.51, blue: 0.96))
                .cornerRadius(14)
            }
            .padding(.top, 8)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.024, green: 0.027, blue: 0.035))
    }
}
