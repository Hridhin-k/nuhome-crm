import { describe, expect, it } from "vitest";
import {
  STATUS_BADGE_CLASS,
  STATUS_DOT_CLASS,
  STATUS_TILE_CLASS,
} from "@/lib/workflow/labels";
import { WORKFLOW_STATUSES } from "@/lib/workflow/types";

describe("status colors", () => {
  it("gives every status a tile, a badge class, and a unique dot", () => {
    const badges = WORKFLOW_STATUSES.map((status) => STATUS_BADGE_CLASS[status]);
    const tiles = WORKFLOW_STATUSES.map((status) => STATUS_TILE_CLASS[status]);
    const dots = WORKFLOW_STATUSES.map((status) => STATUS_DOT_CLASS[status]);
    expect(badges.every((cls) => cls.length > 0)).toBe(true);
    expect(tiles.every((cls) => cls.length > 0)).toBe(true);
    expect(new Set(dots).size).toBe(WORKFLOW_STATUSES.length);
  });
});
