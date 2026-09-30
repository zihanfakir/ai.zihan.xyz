# Alokpoth (iOS Native Application)

Ultra-optimized, 120Hz ProMotion Native iOS client for **Alokpoth (আলোকপথ)**.

## ✨ Features
- **Pure Swift & SwiftUI Architecture**: Native performance, instant startup, zero lag.
- **Hardware-Accelerated WebKit**: Backed by WKWebView with custom hardware layer compositing and zero white flashes.
- **ProMotion 120Hz Smooth Scrolling**: Designed for iPhone Pro (13 Pro - 16 Pro Max) and iPad Pro displays.
- **Native Taptic Engine Haptics**: Realistic physical tactile feedback on button presses and AI actions via `UIImpactFeedbackGenerator`.
- **Integrated Native Bridge**:
  - Two-way communication between web app and iOS
  - Session and token persistence via `UserDefaults`
  - Native iOS Share Sheet (`UIActivityViewController`)
  - Camera & Photo Library access for multi-modal chat uploads
- **AMOLED Dark Experience**: Custom color themes matching pure `#060709` deep black.
- **Offline Resilient**: Smart network state detector with animated native retry view.

---

## 🚀 How to Build & Run on Mac

### Requirements:
- macOS Sonoma or Sequoia
- Xcode 15.0 or later
- iOS 15.0+ device or simulator

### Steps:
1. Open the project in Xcode:
   ```bash
   open ios/AloAI.xcodeproj
   ```
2. Select your development team in **Signing & Capabilities**.
3. Choose your target (iPhone 16 Pro Simulator or Connected iPhone).
4. Press `Cmd + R` to Build and Run!

---

## ☁️ Automated Cloud Build with GitHub Actions (No Mac Required)
To automatically compile an `.ipa` for testing on your iPhone via AltStore, Sideloadly, or TestFlight:

1. Create `.github/workflows/build-ios.yml`:
```yaml
name: Build iOS App

on:
  push:
    branches: [ master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode_15.4.app
      - name: Build IPA
        run: |
          cd ios
          xcodebuild -project AloAI.xcodeproj \
                     -scheme AloAI \
                     -configuration Release \
                     -destination 'generic/platform=iOS' \
                     -derivedDataPath build \
                     CODE_SIGNING_ALLOWED=NO
      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: AloAI-iOS
          path: ios/build/Build/Products/Release-iphoneos/AloAI.app
```
