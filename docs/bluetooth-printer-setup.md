# Direct Bluetooth printing in SnapBerry

The supplied label identifies GOTOOGO C15; the phone screenshot identifies its paired Bluetooth name as **YHK-1D08**. SnapBerry uses native Android BLE, without WalkPrint or Web Bluetooth, for devices matching the documented YHK/WalkPrint profile. The name alone is not proof of compatibility: the app checks its service and characteristic properties before enabling a test.

## First physical test

1. Install the updated `output/SnapBerry-debug.apk` over the existing app.
2. Turn on the printer and Bluetooth. Keep YHK-1D08 paired in Android Settings. Close WalkPrint so it does not hold the printer connection.
3. Take your photos, open Print, and keep the C15 or 58mm setting.
4. Tap **Connect Printer** and allow Nearby Devices if requested. Select your printer if several paired YHK devices are listed.
5. Tap **Print Test**. Check that `SnapBerry TEST` and the rectangle appear clearly on paper. Only then select **Yes, test printed clearly**. A new test clears any previous confirmation until you confirm it again.
6. Tap **Print Now** to send the complete strip directly within SnapBerry. Later sessions can reconnect from Print Now using the saved device confirmation.

The 384-dot raster output retains four photos, branding, the QR and its caption. Photos are dithered to monochrome; the QR is redrawn at whole printer dots with a white quiet zone. Direct printing rejects 80mm because this driver targets a narrow 384-dot head. Android System Print and web browser printing remain available for other printers/formats.

Bluetooth operates offline. Connection is initiated by a customer action. Leaving Print disconnects and stops pending transfers. Transfers are paced, with progress and duplicate-send protection. The app reports data sent, not physical completion: this printer profile does not provide a verified completion acknowledgement. Do not immediately retry a partial transfer; first check the paper.

If connection reports a different protocol, direct printing stays disabled. Report the exact error instead of trying guessed commands. This build has passed software/build checks, but the user's physical printer still needs the test above, including QR scanning. Test again in airplane mode with Bluetooth manually enabled.

## Driver source

Service: `49535343-fe7d-4ae5-8fa9-9fafd205e455`

Write characteristic: `49535343-8841-43f4-a8d4-ecbe34729bb3` (write without response)

Notify characteristic: `49535343-1e4d-4bd9-ba61-23c647249616`

The driver follows a [physically tested YHK implementation](https://www.joshmcarthur.com/case-studies/yhk-mini-printer/) and its [original raster encoder](https://github.com/joshmcarthur/yhk-mini-printer/blob/main/shared/escpos.ts). Matching services plus a successful small physical test are required; this does not claim that every C15 uses the same protocol. Native permissions follow [Android Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions). Paired-device access uses Nearby Devices on Android 12+, without scanning or location permission.
