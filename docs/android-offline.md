# SnapBerry Android

SnapBerry bundles its production web files inside Capacitor. No development server, remote fonts, CDN, or online QR service is used. Camera, four-photo countdown, preview, customization, PNG generation, Gallery saving, and thermal preparation work offline. Opening the Facebook link requires internet.

## Build an APK

Requirements: Node 22+, JDK 21, Android SDK 36 and build-tools 36.0.0. Android Studio 2025.2.1 or newer is recommended. The app supports Android 10 and newer, including OPPO Reno5.

```powershell
npm ci
npm run lint
npm test
npm run android:sync
npm run android:open
```

In Android Studio, allow Gradle to synchronize and use **Build > Generate App Bundles or APKs > Generate APKs**. The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`.

Alternatively, set `JAVA_HOME` to Android Studio's `jbr` directory and `ANDROID_HOME` to your SDK directory, then run `npm run android:apk`. This creates `output/SnapBerry-debug.apk`. The build script also recognizes the local tools in `.android-build`. `scripts/setup-android-tools.ps1` downloads those tools and accepts the SDK licenses; run it only after reviewing and accepting those licenses. Dependencies and build tools require internet for initial setup; the installed application does not.

Install the APK by copying it to your phone and opening it, allowing installation from that source when Android asks. With USB debugging enabled you can instead run:

```powershell
adb install -r output/SnapBerry-debug.apk
```

A debug APK is suitable for testing. For distribution, generate a **signed release APK** in Android Studio and keep its signing key safe. Do not commit signing keys. After every web change, run `npm run android:sync` before rebuilding. Do not add `server.url` to the production Capacitor configuration.

## Native behavior

The Print screen defaults to a C15 starting preset: 57mm paper with a centered
48mm strip and 4.5mm outer margins. Other 58mm and 80mm options remain available.
The preview, browser page, and Android PDF use the same proportions and margins.
This sizing is provisional until a physical test confirms the actual roll and
printable area; it does not certify Bluetooth compatibility. WalkPrint controls
its own scaling when importing a Gallery image. Faces retain the existing photo
composition; print sizing adds no cropping or stretching.

- Camera permission is requested before the existing webcam preview starts. Denial displays a retry message; permanently denied permission must be enabled in Android Settings.
- **Save to Gallery** writes the full PNG into `Pictures/SnapBerry` through Android MediaStore. No broad storage permission is needed on supported Android versions. Web browsers retain Download.
- Android Back returns from Print to the completed strip popup, where frame colors and caption are edited directly. Leaving the session or exiting requires confirmation.
- **Print Now** uses native Bluetooth for a confirmed YHK printer. **Android System Print** retains the system dialog; the web version retains browser printing.
- Direct Bluetooth printing requires the documented YHK service profile and a physically successful test print. See [Bluetooth setup and first test](bluetooth-printer-setup.md). No Web Bluetooth is used inside Android WebView.

## Airplane-mode device checklist

These steps require a real phone; passing desktop checks does not verify Android camera, Gallery, or physical printer behavior.

1. Install the APK. Enable airplane mode, leave Wi-Fi/mobile data off, and manually turn Bluetooth back on. Force-stop and reopen SnapBerry so cached network access cannot mask missing assets.
2. Open the photobooth and grant camera permission. Confirm the preview, four separate 3â€“2â€“1 countdowns, four distinct photos, and completed popup. Rapid repeated taps must not duplicate the sequence.
3. In the completed strip popup, change each frame color and caption directly. Open Print and use Back. Photos and selected options must remain intact. Test Retake confirmation and cancellation.
4. Save to Gallery. Open the PNG in Gallery and inspect all four photos, footer text, QR code, and alignment. Scan the QR with another device: its payload must be `https://www.facebook.com/profile.php?id=61570602811270`. Facebook itself needs internet.
5. Test Normal and Thermal previews at 58mm and 80mm. Use Android System Print and Android's Save as PDF if available. Check that the entire strip fits without stretching. A print service may substitute a paper size; verify its settings before physical printing.
6. Check portrait/landscape, OPPO Reno5 display scaling, small screens, keyboard while entering captions, Android Back, and returning after the app is backgrounded.
7. Deny camera permission and retry after enabling it in Settings. Test an unavailable camera and low-storage Gallery failure. Confirm friendly errors and no duplicate saves.
8. Follow the Bluetooth setup guide: connect the paired YHK printer, print and confirm a small test, then send a full strip directly in SnapBerry. Check faces, all four photos and the QR physically. Test Bluetooth off, permission denial, disconnection during transfer, and retry. A transfer message must not claim physical completion.

Official references: [Capacitor Android](https://capacitorjs.com/docs/android), [Capacitor environment](https://capacitorjs.com/docs/getting-started/environment-setup), [Android MediaStore](https://developer.android.com/training/data-storage/shared/media), [Android Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions).

