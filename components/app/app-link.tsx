import Link from "next/link";
import type { ComponentProps } from "react";

/** Full-route prefetch so in-app clicks paint from cache instead of waiting on the server. */
export function AppLink({
  prefetch = true,
  ...props
}: ComponentProps<typeof Link>) {
  return <Link prefetch={prefetch} {...props} />;
}
