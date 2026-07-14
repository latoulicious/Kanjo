import { Capacitor } from "@capacitor/core"

// UI-only flag; transport picks its own (lib/api.ts). `?native` previews the
// native layout in a dev browser while data still flows over HTTP.
export const isNative =
  Capacitor.isNativePlatform() ||
  (import.meta.env.DEV && new URLSearchParams(window.location.search).has("native"))
