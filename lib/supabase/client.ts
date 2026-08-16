"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

export function createBrowserSupabaseClient() {
  if (browserClient) {
    return browserClient;
  }
  const { url, publishableKey } = getSupabasePublicEnv();
  browserClient = createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}

/** Realtime RLS needs the JWT on the websocket. HttpOnly cookies are invisible here. */
export function bindRealtimeAuth(accessToken: string | null) {
  const client = createBrowserSupabaseClient();
  return (async () => {
    if (accessToken) {
      await client.realtime.setAuth(accessToken);
    }
  })();
}
