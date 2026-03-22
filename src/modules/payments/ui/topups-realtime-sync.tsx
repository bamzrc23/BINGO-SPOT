"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type TopupsRealtimeSyncProps = {
  userId?: string;
  refreshThrottleMs?: number;
};

export function TopupsRealtimeSync({
  userId,
  refreshThrottleMs = 700
}: TopupsRealtimeSyncProps) {
  const router = useRouter();
  const refreshTimeoutRef = useRef<number | null>(null);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        return;
      }

      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshTimeoutRef.current = null;
        router.refresh();
      }, refreshThrottleMs);
    };

    const channelName = userId ? `topups:user:${userId}` : "topups:admin";
    const channel = supabase.channel(channelName);

    const listenConfig = {
      event: "*",
      schema: "public",
      table: "topups"
    } as const;

    if (userId) {
      channel.on(
        "postgres_changes",
        {
          ...listenConfig,
          filter: `user_id=eq.${userId}`
        },
        scheduleRefresh
      );
    } else {
      channel.on("postgres_changes", listenConfig, scheduleRefresh);
    }

    channel.subscribe();

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [refreshThrottleMs, router, supabase, userId]);

  return null;
}
