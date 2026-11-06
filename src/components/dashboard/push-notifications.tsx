"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { savePushSubscription } from "@/app/dashboard/actions";

function decodeKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function PushNotifications() {
  const t = useTranslations("Navigation");
  const [enabled, setEnabled] = useState(false);
  const [busy, startTransition] = useTransition();
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (!publicKey || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      void registerSubscription(publicKey).then(setEnabled);
    }
  }, [publicKey]);

  async function registerSubscription(key: string) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
      const result = await savePushSubscription({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, userAgent: navigator.userAgent });
      return result.ok;
    } catch {
      return false;
    }
  }

  if (!publicKey) return null;
  return <button
    type="button"
    className="notification-setup"
    disabled={busy || enabled}
    aria-label={enabled ? t("notificationsEnabled") : t("enableNotifications")}
    title={enabled ? t("notificationsEnabled") : t("enableNotifications")}
    onClick={() => startTransition(async () => {
      if (Notification.permission === "denied") return;
      const permission = await Notification.requestPermission();
      if (permission !== "granted" || !publicKey) return;
      setEnabled(await registerSubscription(publicKey));
    })}
  >
    {enabled ? <Bell size={14} /> : <BellOff size={14} />}
    <span>{enabled ? t("notificationsEnabled") : t("enableNotifications")}</span>
  </button>;
}
