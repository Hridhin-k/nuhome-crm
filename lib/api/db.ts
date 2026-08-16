import { createServerSupabaseClient } from "@/lib/supabase/server";

export const getDb = createServerSupabaseClient;

export async function throwQuery<T>(
  result: PromiseLike<{ data: T; error: { message: string } | null }>,
  message: string,
): Promise<NonNullable<T>> {
  const { data, error } = await result;
  if (error) {
    throw new Error(`${message}: ${error.message}`);
  }
  return data as NonNullable<T>;
}
