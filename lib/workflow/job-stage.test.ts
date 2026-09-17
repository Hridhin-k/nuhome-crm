import { describe, expect, it } from "vitest";
import { jobStage, jobTracks } from "@/lib/workflow/job-stage";
import { WORKFLOW_STATUSES } from "@/lib/workflow/types";

describe("jobStage", () => {
  it("maps every status onto five shop stages", () => {
    for (const status of WORKFLOW_STATUSES) {
      expect(jobStage(status).length).toBeGreaterThan(0);
    }
    expect(jobStage("quote_draft")).toBe("quote");
    expect(jobStage("quote_approved")).toBe("quote");
    expect(jobStage("order_active")).toBe("live");
    expect(jobStage("sent_to_vendor")).toBe("production");
    expect(jobStage("delivery_unlocked")).toBe("ready");
    expect(jobStage("closed")).toBe("done");
    expect(jobStage("cancelled")).toBe("cancelled");
  });
});

describe("jobTracks", () => {
  it("keeps four parallel tracks on a live unpaid job", () => {
    const tracks = jobTracks({
      status: "items_received",
      outstanding: 20_000,
      paid: 10_000,
    });
    expect(tracks.map((t) => t.id)).toEqual(["quote", "money", "factory", "site"]);
    expect(tracks.find((t) => t.id === "quote")?.state).toBe("done");
    expect(tracks.find((t) => t.id === "money")?.state).toBe("blocked");
    expect(tracks.find((t) => t.id === "factory")?.state).toBe("done");
    expect(tracks.find((t) => t.id === "site")?.state).toBe("blocked");
  });

  it("marks a list-price draft as quote-current only", () => {
    const tracks = jobTracks({ status: "quote_draft" });
    expect(tracks.find((t) => t.id === "quote")?.state).toBe("current");
    expect(tracks.find((t) => t.id === "money")?.state).toBe("idle");
    expect(tracks.find((t) => t.id === "factory")?.state).toBe("idle");
  });

  it("treats approved credit delivery as money clear and site unlocked", () => {
    const tracks = jobTracks({
      status: "delivery_pending_payment",
      outstanding: 40_000,
      paid: 0,
      creditApproved: true,
    });
    expect(tracks.find((t) => t.id === "money")?.state).toBe("done");
    expect(tracks.find((t) => t.id === "money")?.detail).toMatch(/Credit delivery/);
    expect(tracks.find((t) => t.id === "site")?.state).toBe("current");
  });
});
