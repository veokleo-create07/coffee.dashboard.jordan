"use client";

import { useEffect, useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
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
  async function handleEnable() {
    if (busy || enabled || !publicKey) return;
    setFailed(false);
    setBusy(true);
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setFailed(true);
        return;
      }
      // Keep this directly inside the click handler. Safari requires the
      // permission prompt to be initiated by a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setFailed(true);
        return;
      }
      const subscribed = await registerSubscription(publicKey);
      setEnabled(subscribed);
      if (!subscribed) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button
      type="button"
      className="notification-setup"
      disabled={busy || enabled}
      aria-label={enabled ? t("notificationsEnabled") : t("enableNotifications")}
      title={enabled ? t("notificationsEnabled") : t("enableNotifications")}
      onClick={() => void handleEnable()}
    >
      {enabled ? <Bell size={14} /> : <BellOff size={14} />}
      <span>{enabled ? t("notificationsEnabled") : t("enableNotifications")}</span>
    </button>
    {failed ? <span className="notification-setup-error" role="status">{t("notificationsUnavailable")}</span> : null}
  </>;
}
