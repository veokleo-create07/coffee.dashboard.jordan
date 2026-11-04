"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

/**
 * Requests a refresh when reservations change in Supabase. Polling remains the
 * fallback for environments without public browser Supabase configuration.
 */
function useRealtimeTables(channelName: string, tables: string[], onChange: () => void) {
  const callback = useRef(onChange);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [available, setAvailable] = useState(configured);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let timer: number | undefined;
    let channel = supabase.channel(channelName);
    for (const table of tables) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = window.setTimeout(() => callback.current(), 250);
      });
    }
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") setAvailable(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setAvailable(false);
    });

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [channelName, tables]);

  return available;
}

const reservationTables = ["reservations"];
const tableBoardTables = ["reservations", "reservation_table_assignments"];

export function useReservationRealtime(onChange: () => void) {
  return useRealtimeTables("staff-reservations", reservationTables, onChange);
}

export function useTableRealtime(onChange: () => void) {
  return useRealtimeTables("staff-table-board", tableBoardTables, onChange);
}
