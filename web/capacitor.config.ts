import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "dev.kohan.kanjo",
  appName: "Kanjo",
  webDir: "dist",
  // Native-layer HTTP so sync fetches skip WebView CORS (server needs no headers).
  plugins: { CapacitorHttp: { enabled: true } },
}

export default config
