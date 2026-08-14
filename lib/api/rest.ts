import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import type { FetchCache } from "@/lib/api/cache";

const accessToken = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return session.access_token;
});

function restUrl(path: string) {
  const { url } = getSupabasePublicEnv();
  return `${url}/rest/v1/${path.replace(/^\//, "")}`;
}

async function restHeaders(single?: boolean) {
  const { publishableKey } = getSupabasePublicEnv();
  const token = await accessToken();
  const headers: Record<string, string> = {
    apikey: publishableKey,
    Authorization: `Bearer ${token}`,
    Accept: single ? "application/vnd.pgrst.object+json" : "application/json",
  };
  return headers;
}

async function parseBody<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    let detail = fallback;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        detail = body.message;
      }
    } catch {
      /* keep fallback */
    }
    throw new Error(detail);
  }
  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
}

export async function restGet<T>(
  path: string,
  cacheMode: FetchCache,
  options?: { single?: boolean; message?: string },
): Promise<T> {
  const response = await fetch(restUrl(path), {
    method: "GET",
    headers: await restHeaders(options?.single),
    ...cacheMode,
  });

  if (options?.single && response.status === 406) {
    return null as T;
  }

  return parseBody<T>(response, options?.message ?? "Failed to fetch");
}

export async function restRpc<T>(
  fn: string,
  body: Record<string, unknown>,
  cacheMode: FetchCache,
  message = "Failed to fetch",
): Promise<T> {
  const response = await fetch(restUrl(`rpc/${fn}`), {
    method: "POST",
    headers: {
      ...(await restHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    ...cacheMode,
  });
  return parseBody<T>(response, message);
}
