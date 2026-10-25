"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";

/**
 * Requests a refresh when reservations change in Supabase. Polling remains the
 * fallback for environments without public browser Supabase configuration.
 */
export function useReservationRealtime(onChange: () => void) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let timer: number | undefined;
    const channel = supabase
      .channel("staff-reservations")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = window.setTimeout(() => callback.current(), 250);
      })
      .subscribe();

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);
}
