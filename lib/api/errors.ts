export function isNavigationError(error: unknown) {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = String((error as { digest: unknown }).digest);
  return (
    digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")
  );
}

/** Rethrow Next.js redirect/notFound errors so they are not swallowed in catch blocks. */
export function rethrowNavigationError(error: unknown): void {
  if (isNavigationError(error)) {
    throw error;
  }
}

export function humanizeError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Something went wrong";
  const cleaned = raw
    .replace(/^.*ERROR:\s*/i, "")
    .replace(/\s+Where:[\s\S]*$/, "")
    .trim();

  if (/phone number already exists/i.test(cleaned)) {
    return cleaned;
  }
  if (/customers_phone_normalized/i.test(cleaned)) {
    return "A customer with this phone number already exists.";
  }
  if (/already registered|duplicate key value/i.test(cleaned)) {
    return "That record already exists.";
  }
  if (/permission|42501|not authenticated/i.test(cleaned)) {
    return "You don’t have permission to do that.";
  }
  if (/invalid transition/i.test(cleaned)) {
    return "This order isn’t in the right stage for that action.";
  }
  if (/own quote/i.test(cleaned)) {
    return "You can’t approve or reject your own quote.";
  }
  if (/you recorded/i.test(cleaned)) {
    return "You can’t verify or reject a payment you recorded.";
  }
  if (/delivery/i.test(cleaned) && /lock|outstanding|received/i.test(cleaned)) {
    return cleaned;
  }
  if (/rejection reason/i.test(cleaned)) {
    return "Please add a reason before sending this back.";
  }
  return cleaned || "Something went wrong. Try again.";
}
