import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildGoogleMapsUrl, isMobileUA, openInGoogleMaps } from "./geo";

describe("buildGoogleMapsUrl", () => {
  it("uses maps.google.com with lat,lng query", () => {
    expect(buildGoogleMapsUrl(0.3476, 32.5825)).toBe(
      "https://maps.google.com/maps?q=0.3476,32.5825"
    );
  });

  it("handles negative coordinates", () => {
    expect(buildGoogleMapsUrl(-1.2921, 36.8219)).toBe(
      "https://maps.google.com/maps?q=-1.2921,36.8219"
    );
  });

  it("never references www.google.com (blocked by ERR_BLOCKED_BY_RESPONSE in iframes)", () => {
    expect(buildGoogleMapsUrl(10, 20)).not.toContain("www.google.com");
  });
});

describe("isMobileUA", () => {
  it("detects iPhone", () => {
    expect(isMobileUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(true);
  });
  it("detects Android", () => {
    expect(isMobileUA("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(true);
  });
  it("returns false for desktop Chrome", () => {
    expect(
      isMobileUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")
    ).toBe(false);
  });
});

describe("openInGoogleMaps", () => {
  let appendSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node: any) => {
      // Replace .click on the anchor so we can assert it was invoked.
      if (node && node.tagName === "A") node.click = clickSpy;
      return node;
    });
  });

  afterEach(() => {
    appendSpy.mockRestore();
  });

  it("opens a new-tab anchor pointing at the correct coordinates", () => {
    openInGoogleMaps(0.3476, 32.5825, "Kampala");

    expect(appendSpy).toHaveBeenCalledTimes(1);
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe("A");
    expect(anchor.href).toBe("https://maps.google.com/maps?q=0.3476,32.5825");
    expect(anchor.target).toBe("_blank");
    expect(anchor.rel).toBe("noopener noreferrer");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("uses the same URL on mobile and desktop (no in-frame geo: scheme)", () => {
    openInGoogleMaps(-1.2921, 36.8219);
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.href.startsWith("https://maps.google.com/maps?q=")).toBe(true);
    expect(anchor.href).not.toContain("geo:");
  });
});
