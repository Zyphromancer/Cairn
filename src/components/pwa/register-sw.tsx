"use client";

import { useEffect } from "react";

// Registers the app-shell service worker (public/sw.js). Production
// only: in dev, a service worker intercepting Turbopack's HMR and
// on-demand-compiled assets causes far more confusion than it's worth.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Install-ability is progressive enhancement — a failed
      // registration (old browser, private mode) never blocks the app.
    });
  }, []);

  return null;
}
