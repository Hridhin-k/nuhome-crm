import { revalidatePath, revalidateTag } from "next/cache";

/** Drop cached RSC payloads and catalog fetches after a mutation. */
export function revalidateApp() {
  revalidatePath("/", "layout");
  revalidateTag("catalog", "max");
}
