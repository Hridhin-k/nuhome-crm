import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_KINDS,
  companySettingsSchema,
  installationSchema,
  uploadAttachmentSchema,
  warrantySchema,
} from "@/lib/validation/documents";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("uploadAttachmentSchema", () => {
  it("accepts every attachment kind on customer, quote, and order", () => {
    for (const entity_type of ["customer", "quote", "order"] as const) {
      for (const kind of ATTACHMENT_KINDS) {
        expect(
          uploadAttachmentSchema.parse({
            entity_type,
            entity_id: UUID,
            kind,
            return_to: "/quotes/1",
          }).kind,
        ).toBe(kind);
      }
    }
  });

  it("rejects an unknown kind, entity, or an external return path", () => {
    expect(() =>
      uploadAttachmentSchema.parse({
        entity_type: "payment",
        entity_id: UUID,
        kind: "photo",
      }),
    ).toThrow();
    expect(() =>
      uploadAttachmentSchema.parse({
        entity_type: "order",
        entity_id: UUID,
        kind: "invoice",
      }),
    ).toThrow();
    expect(() =>
      uploadAttachmentSchema.parse({
        entity_type: "order",
        entity_id: UUID,
        kind: "photo",
        return_to: "https://evil.example/",
      }),
    ).toThrow();
  });
});

describe("companySettingsSchema", () => {
  it("requires a legal name and a GST rate between 0 and 100", () => {
    expect(
      companySettingsSchema.parse({
        legal_name: "Nuhome Interiors",
        gstin: "32AAAAA0000A1Z5",
        email: "",
        default_gst_rate: 18,
      }).legal_name,
    ).toBe("Nuhome Interiors");
    expect(() =>
      companySettingsSchema.parse({ legal_name: "", default_gst_rate: 18 }),
    ).toThrow();
    expect(() =>
      companySettingsSchema.parse({ legal_name: "Nuhome", default_gst_rate: 101 }),
    ).toThrow();
    expect(() =>
      companySettingsSchema.parse({
        legal_name: "Nuhome",
        default_gst_rate: 18,
        gstin: "1234567890123456",
      }),
    ).toThrow();
  });
});

describe("installationSchema / warrantySchema", () => {
  it("requires an order and a scheduled date", () => {
    expect(
      installationSchema.parse({
        order_id: UUID,
        scheduled_on: "2026-08-20",
        status: "scheduled",
      }).status,
    ).toBe("scheduled");
    expect(() =>
      installationSchema.parse({ order_id: UUID, scheduled_on: "" }),
    ).toThrow();
    for (const status of ["scheduled", "done", "cancelled"] as const) {
      expect(
        installationSchema.parse({
          order_id: UUID,
          scheduled_on: "2026-08-20",
          status,
        }).status,
      ).toBe(status);
    }
  });

  it("accepts warranty and AMC with start and end dates", () => {
    for (const kind of ["warranty", "amc"] as const) {
      expect(
        warrantySchema.parse({
          order_id: UUID,
          kind,
          starts_on: "2026-08-17",
          ends_on: "2027-08-17",
        }).kind,
      ).toBe(kind);
    }
    expect(() =>
      warrantySchema.parse({
        order_id: UUID,
        kind: "extended",
        starts_on: "2026-08-17",
        ends_on: "2027-08-17",
      }),
    ).toThrow();
    expect(() =>
      warrantySchema.parse({
        order_id: UUID,
        kind: "warranty",
        starts_on: "",
        ends_on: "2027-08-17",
      }),
    ).toThrow();
  });
});
