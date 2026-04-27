import { describe, expect, it } from "vitest";
import {
  countSentences,
  fileExtensionForStorage,
  isAcceptedArtFile,
  isPdf,
} from "./validation";

describe("countSentences", () => {
  it("returns 0 for empty input", () => {
    expect(countSentences("")).toBe(0);
    expect(countSentences("   \n\t  ")).toBe(0);
  });

  it("counts a single sentence with terminal punctuation", () => {
    expect(countSentences("This is one.")).toBe(1);
    expect(countSentences("Wait!")).toBe(1);
    expect(countSentences("Really?")).toBe(1);
  });

  it("counts five sentences in a normal paragraph", () => {
    const text =
      "First. Second sentence here. Third one is longer? Fourth! Fifth, the last.";
    expect(countSentences(text)).toBe(5);
  });

  it("approximates — 'Mr. Smith said hi.' counts as 2 (known limitation)", () => {
    expect(countSentences("Mr. Smith said hi.")).toBe(2);
  });

  it("treats trailing punctuation without whitespace as a sentence", () => {
    expect(countSentences("One. Two.")).toBe(2);
  });
});

describe("isAcceptedArtFile", () => {
  it("accepts a 4 MB PNG", () => {
    expect(
      isAcceptedArtFile({
        type: "image/png",
        name: "art.png",
        size: 4 * 1024 * 1024,
      }),
    ).toEqual({ ok: true });
  });

  it("accepts HEIC by extension even when MIME is empty (iOS Safari edge case)", () => {
    expect(
      isAcceptedArtFile({ type: "", name: "iphone-shot.heic", size: 1000 }),
    ).toEqual({ ok: true });
  });

  it("rejects a 12 MB PDF as too large", () => {
    const result = isAcceptedArtFile({
      type: "application/pdf",
      name: "big.pdf",
      size: 12 * 1024 * 1024,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/10 MB/);
  });

  it("rejects an empty file", () => {
    const result = isAcceptedArtFile({ type: "image/png", name: "x.png", size: 0 });
    expect(result.ok).toBe(false);
  });

  it("rejects a .gif", () => {
    const result = isAcceptedArtFile({
      type: "image/gif",
      name: "anim.gif",
      size: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/JPG|PNG|WEBP|HEIC|PDF/);
  });

  it("rejects a .docx pretending to be an image", () => {
    const result = isAcceptedArtFile({
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: "evil.docx",
      size: 1000,
    });
    expect(result.ok).toBe(false);
  });
});

describe("isPdf and fileExtensionForStorage", () => {
  it("isPdf detects PDF by MIME or extension", () => {
    expect(isPdf({ type: "application/pdf", name: "x.pdf", size: 1 })).toBe(true);
    expect(isPdf({ type: "", name: "x.pdf", size: 1 })).toBe(true);
    expect(isPdf({ type: "image/png", name: "x.png", size: 1 })).toBe(false);
  });

  it("fileExtensionForStorage prefers the filename extension", () => {
    expect(
      fileExtensionForStorage({ type: "image/jpeg", name: "art.jpg", size: 1 }),
    ).toBe("jpg");
    expect(
      fileExtensionForStorage({ type: "image/jpeg", name: "art", size: 1 }),
    ).toBe("jpg");
  });
});
