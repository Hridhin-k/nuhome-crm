import { describe, expect, it } from "vitest";
import { STATUS_BADGE_CLASS, STATUS_DOT_CLASS } from "@/lib/workflow/labels";
import { WORKFLOW_STATUSES } from "@/lib/workflow/types";

describe("status colors", () => {
  it("gives every status a unique badge and dot", () => {
    const badges = WORKFLOW_STATUSES.map((status) => STATUS_BADGE_CLASS[status]);
    const dots = WORKFLOW_STATUSES.map((status) => STATUS_DOT_CLASS[status]);
    expect(new Set(badges).size).toBe(WORKFLOW_STATUSES.length);
    expect(new Set(dots).size).toBe(WORKFLOW_STATUSES.length);
  });
});
