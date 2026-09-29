//
//  AloAIApp.swift
//  AloAI
//
//  Ultra-optimized Native iOS Application for Alo AI (আলো এআই)
//  Engineered for 120Hz ProMotion displays, fluid haptics, and zero lag.
//

import SwiftUI

@main
struct AloAIApp: App {
    init() {
        // Configure global appearance for immersive AMOLED Dark Experience
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(red: 0.024, green: 0.027, blue: 0.035, alpha: 1.0)
        appearance.titleTextAttributes = [.foregroundColor: UIColor.white]
        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().compactAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
                .background(Color(red: 0.024, green: 0.027, blue: 0.035))
        }
    }
}
