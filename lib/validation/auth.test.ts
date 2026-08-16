import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
} from "@/lib/validation/auth";

describe("loginSchema", () => {
  it("accepts a valid email and 8+ character password", () => {
    expect(loginSchema.parse({ email: "sales@nuhome.demo", password: "password123" })).toEqual({
      email: "sales@nuhome.demo",
      password: "password123",
    });
  });

  it("rejects missing, invalid, or short credentials", () => {
    expect(() => loginSchema.parse({ email: "", password: "password123" })).toThrow();
    expect(() => loginSchema.parse({ email: "not-an-email", password: "password123" })).toThrow();
    expect(() => loginSchema.parse({ email: "sales@nuhome.demo", password: "short" })).toThrow();
    expect(() => loginSchema.parse({ email: "sales@nuhome.demo", password: "" })).toThrow();
  });
});

describe("forgotPasswordSchema", () => {
  it("requires a valid email", () => {
    expect(forgotPasswordSchema.parse({ email: "admin@nuhome.demo" }).email).toBe(
      "admin@nuhome.demo",
    );
    expect(() => forgotPasswordSchema.parse({ email: "nope" })).toThrow();
  });
});

describe("changePasswordSchema", () => {
  it("requires matching new passwords of at least 8 characters", () => {
    expect(
      changePasswordSchema.parse({
        current_password: "password123",
        new_password: "newpass12",
        confirm_password: "newpass12",
      }).new_password,
    ).toBe("newpass12");
  });

  it("rejects a mismatch and a short new password", () => {
    expect(() =>
      changePasswordSchema.parse({
        current_password: "password123",
        new_password: "newpass12",
        confirm_password: "different",
      }),
    ).toThrow(/do not match/);
    expect(() =>
      changePasswordSchema.parse({
        current_password: "password123",
        new_password: "short",
        confirm_password: "short",
      }),
    ).toThrow();
  });
});
