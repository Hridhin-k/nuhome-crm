import { describe, expect, it } from "vitest";
import { parseAppRole } from "@/lib/auth/roles";

describe("parseAppRole", () => {
  it("accepts app roles and delivery alias", () => {
    expect(parseAppRole("Sales")).toBe("sales");
    expect(parseAppRole("delivery")).toBe("store");
    expect(parseAppRole("operations")).toBe("operations");
    expect(parseAppRole("super_accounts")).toBe("operations");
    expect(parseAppRole("superuser")).toBe("operations");
    expect(parseAppRole("nope")).toBeNull();
  });
});
