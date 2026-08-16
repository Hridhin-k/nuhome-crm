import { describe, expect, it } from "vitest";
import { orderStatusExplanation } from "@/lib/workflow/status-explanation";
import { flowStageIndex, FLOW_STAGES } from "@/lib/workflow/stages";
import {
  STATUS_LABELS,
  STATUS_NEXT_LINE,
  STATUS_TONE,
  TIMELINE_STEPS,
  timelineIndex,
} from "@/lib/workflow/labels";
import { WORKFLOW_STATUSES } from "@/lib/workflow/types";

describe("status copy completeness", () => {
  it("gives every status a label, tone, next line, and explanation", () => {
    for (const status of WORKFLOW_STATUSES) {
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
      expect(STATUS_TONE[status].length).toBeGreaterThan(0);
      expect(STATUS_NEXT_LINE[status].length).toBeGreaterThan(0);
      expect(
        orderStatusExplanation({ status, outstanding: 1000 }).length,
      ).toBeGreaterThan(0);
    }
    expect(new Set(Object.values(STATUS_LABELS)).size).toBe(WORKFLOW_STATUSES.length);
    expect(new Set(Object.values(STATUS_TONE)).size).toBe(WORKFLOW_STATUSES.length);
  });

  it("mentions the outstanding amount when delivery is locked", () => {
    expect(
      orderStatusExplanation({
        status: "order_on_hold",
        outstanding: 50_000,
      }),
    ).toMatch(/50,000/);
    expect(
      orderStatusExplanation({
        status: "items_received",
        outstanding: 0,
      }),
    ).toMatch(/Payment complete/);
    expect(
      orderStatusExplanation({
        status: "payment_pending_verification",
        outstanding: 0,
        activated: false,
      }),
    ).toMatch(/activate/);
    expect(
      orderStatusExplanation({
        status: "payment_pending_verification",
        outstanding: 0,
        activated: true,
      }),
    ).toMatch(/delivery/);
  });
});

describe("timelineIndex", () => {
  it("maps every status onto the floor timeline", () => {
    expect(TIMELINE_STEPS).toHaveLength(11);
    expect(timelineIndex("quote_draft")).toBe(-1);
    expect(timelineIndex("quote_pending_accounts")).toBe(-1);
    expect(timelineIndex("quote_rejected")).toBe(-1);
    expect(timelineIndex("cancelled")).toBe(-1);
    expect(timelineIndex("quote_approved")).toBe(0);
    expect(timelineIndex("quote_sent_to_customer")).toBe(1);
    expect(timelineIndex("payment_pending_verification")).toBe(2);
    expect(timelineIndex("payment_pending_verification", true)).toBe(7);
    expect(timelineIndex("order_active")).toBe(3);
    expect(timelineIndex("sent_to_vendor")).toBe(4);
    expect(timelineIndex("vendor_dispatched")).toBe(5);
    expect(timelineIndex("items_received")).toBe(6);
    expect(timelineIndex("delivery_pending_payment")).toBe(6);
    expect(timelineIndex("order_on_hold")).toBe(6);
    expect(timelineIndex("delivery_unlocked")).toBe(8);
    expect(timelineIndex("delivered")).toBe(9);
    expect(timelineIndex("closed")).toBe(10);
  });
});

describe("flow stages", () => {
  it("walks the business diagram from walk-in to closed", () => {
    expect(FLOW_STAGES).toHaveLength(15);
    expect(FLOW_STAGES[0].id).toBe("walk_in");
    expect(FLOW_STAGES.at(-1)?.id).toBe("closed");
    expect(flowStageIndex("quote_draft")).toBe(3);
    expect(flowStageIndex("quote_rejected")).toBe(3);
    expect(flowStageIndex("quote_pending_accounts")).toBe(4);
    expect(flowStageIndex("quote_approved")).toBe(5);
    expect(flowStageIndex("quote_sent_to_customer")).toBe(6);
    expect(flowStageIndex("payment_pending_verification")).toBe(7);
    expect(flowStageIndex("order_active")).toBe(8);
    expect(flowStageIndex("sent_to_vendor")).toBe(9);
    expect(flowStageIndex("vendor_dispatched")).toBe(10);
    expect(flowStageIndex("items_received", 0)).toBe(11);
    expect(flowStageIndex("items_received", 1)).toBe(12);
    expect(flowStageIndex("delivery_pending_payment", 0)).toBe(11);
    expect(flowStageIndex("order_on_hold")).toBe(12);
    expect(flowStageIndex("delivery_unlocked")).toBe(13);
    expect(flowStageIndex("delivered")).toBe(14);
    expect(flowStageIndex("closed")).toBe(15);
    expect(flowStageIndex("cancelled")).toBe(-1);
  });
});
