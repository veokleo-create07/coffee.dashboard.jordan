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
  const [failure, setFailure] = useState<"permission" | "unsupported" | "configuration" | "database" | "unauthorized" | null>(null);
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (!publicKey || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      void registerSubscription(publicKey).then((result) => {
        setEnabled(result.ok);
        if (!result.ok) setFailure(result.reason);
      });
    }
  }, [publicKey]);

  async function registerSubscription(key: string): Promise<{ ok: true } | { ok: false; reason: "configuration" | "database" | "unauthorized" }> {
    try {
      const decodedKey = decodeKey(key.trim());
      if (decodedKey.length !== 65) return { ok: false, reason: "configuration" };
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodedKey });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return { ok: false, reason: "configuration" };
      const result = await savePushSubscription({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, userAgent: navigator.userAgent });
      return result.ok ? result : { ok: false, reason: result.reason === "unauthorized" ? "unauthorized" : "database" };
    } catch {
      return { ok: false, reason: "configuration" };
    }
  }

  if (!publicKey) return null;
  async function handleEnable() {
    if (busy || enabled || !publicKey) return;
    setFailure(null);
    setBusy(true);
    try {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setFailure("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setFailure("permission");
        return;
      }
      // Keep this directly inside the click handler. Safari requires the
      // permission prompt to be initiated by a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setFailure("permission");
        return;
      }
      const result = await registerSubscription(publicKey);
      setEnabled(result.ok);
      if (!result.ok) setFailure(result.reason);
    } catch {
      setFailure("configuration");
    } finally {
      setBusy(false);
    }
  }

  return <div className="notification-control">
    <button
      type="button"
      className={`notification-setup${enabled ? " is-enabled" : ""}`}
      disabled={busy || enabled}
      aria-label={enabled ? t("notificationsEnabled") : t("enableNotifications")}
      title={enabled ? t("notificationsEnabled") : t("enableNotifications")}
      onClick={() => void handleEnable()}
    >
      {enabled ? <Bell size={14} /> : <BellOff size={14} />}
      <span>{enabled ? t("notificationsEnabled") : t("enableNotifications")}</span>
    </button>
    {failure ? <span className="notification-setup-error" role="status">{t(`notifications${failure[0].toUpperCase()}${failure.slice(1)}`)}</span> : null}
  </div>;
}
