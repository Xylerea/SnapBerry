import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
    appId: 'com.fleura.snapberry',
    appName: 'SnapBerry',
    webDir: 'dist',
    // No server.url: production always serves bundled assets offline.
    android: { allowMixedContent: false },
}

export default config
