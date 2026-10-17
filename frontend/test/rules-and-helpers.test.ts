import { describe, it, expect } from "vitest";
import { notify } from "@/utils/notify";
import { logAction } from "@/utils/audit";

describe("Global Rules & Helpers", () => {
  describe("Notifications helper (utils/notify)", () => {
    it("never crashes when called with missing or invalid parameters", async () => {
      // Must not throw when userId is null/undefined or invalid
      await expect(notify(null, "test", "Title", "Body", "/url")).resolves.not.toThrow();
      await expect(notify(undefined, "test", "Title", "Body")).resolves.not.toThrow();
      await expect(notify(0, "test", "Title", "Body")).resolves.not.toThrow();
    });
  });

  describe("Audit helper (utils/audit)", () => {
    it("never crashes when called with various payloads", async () => {
      await expect(
        logAction(
          null,
          "TEST_ACTION",
          "test_entity",
          "123",
          { password: "secret_value", normal: "visible" },
          { token: "my_token", refresh_token: "ref_tok", smtp_password: "smtp", api_key: "api123" },
        ),
      ).resolves.not.toThrow();
    }, 15000);
  });
});
