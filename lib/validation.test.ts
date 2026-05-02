import { describe, expect, it } from "vitest";
import {
  countSentences,
  fileExtensionForStorage,
  isAcceptedArtFile,
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
  it("accepts a 2 MB PNG", () => {
    expect(
      isAcceptedArtFile({
        type: "image/png",
        name: "art.png",
        size: 2 * 1024 * 1024,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a 4 MB image as too large", () => {
    const result = isAcceptedArtFile({
      type: "image/png",
      name: "big.png",
      size: 4 * 1024 * 1024,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/3 MB/);
  });

  it("rejects PDFs (no longer an accepted type)", () => {
    const result = isAcceptedArtFile({
      type: "application/pdf",
      name: "doc.pdf",
      size: 1 * 1024 * 1024,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(
        "File type not accepted. Use JPG, PNG, GIF, or WEBP.",
      );
    }
  });

  it("rejects an empty file", () => {
    const result = isAcceptedArtFile({ type: "image/png", name: "x.png", size: 0 });
    expect(result.ok).toBe(false);
  });

  it("accepts a GIF by MIME", () => {
    expect(
      isAcceptedArtFile({ type: "image/gif", name: "anim.gif", size: 1000 }),
    ).toEqual({ ok: true });
  });

  it("accepts a GIF by extension when MIME is empty", () => {
    expect(
      isAcceptedArtFile({ type: "", name: "anim.gif", size: 1000 }),
    ).toEqual({ ok: true });
  });

  it("rejects HEIC with the accepted-types message", () => {
    const result = isAcceptedArtFile({
      type: "image/heic",
      name: "iphone-shot.heic",
      size: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(
        "File type not accepted. Use JPG, PNG, GIF, or WEBP.",
      );
    }
  });

  it("rejects a .docx pretending to be an image", () => {
    const result = isAcceptedArtFile({
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: "evil.docx",
      size: 1000,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a file with no extension and a non-art MIME", () => {
    const result = isAcceptedArtFile({
      type: "application/octet-stream",
      name: "mystery",
      size: 1000,
    });
    expect(result.ok).toBe(false);
  });
});

describe("fileExtensionForStorage", () => {
  it("prefers the filename extension", () => {
    expect(
      fileExtensionForStorage({ type: "image/jpeg", name: "art.jpg", size: 1 }),
    ).toBe("jpg");
    expect(
      fileExtensionForStorage({ type: "image/jpeg", name: "art", size: 1 }),
    ).toBe("jpg");
  });
});
