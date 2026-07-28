import { describe, expect, it } from "vitest";
import {
  buildInvitePath,
  buildInviteShareText,
  buildInviteUrl,
  buildLineShareUrl,
  readInviteCodeFromSearch,
} from "@/lib/auth/invite-link";

describe("invite-link", () => {
  it("招待パスとURLを組み立てる", () => {
    expect(buildInvitePath("77dfdao0f")).toBe("/join?code=77DFDAO0F");
    expect(buildInviteUrl("77DFDAO0F", "https://example.com")).toBe(
      "https://example.com/join?code=77DFDAO0F",
    );
  });

  it("LINE共有URLを作る", () => {
    const url = buildLineShareUrl("こんにちは");
    expect(url.startsWith("https://line.me/R/share?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1] ?? "")).toBe("こんにちは");
  });

  it("共有文にリンクとコードを含める", () => {
    const text = buildInviteShareText({
      householdName: "平元家",
      code: "77DFDAO0F",
      inviteUrl: "https://example.com/join?code=77DFDAO0F",
    });
    expect(text).toContain("平元家");
    expect(text).toContain("https://example.com/join?code=77DFDAO0F");
    expect(text).toContain("77DFDAO0F");
  });

  it("クエリからコードを読む", () => {
    expect(readInviteCodeFromSearch("?code=77dfdao0f")).toBe("77DFDAO0F");
    expect(readInviteCodeFromSearch("?code=bad")).toBeNull();
  });
});
