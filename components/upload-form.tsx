"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UploadPreview } from "@/components/upload-preview";
import { uploadPresentation } from "@/lib/actions/presentation";
import {
  countSentences,
  isAcceptedArtFile,
  isHeic,
  isPdf,
} from "@/lib/validation";

interface UploadFormProps {
  topicId: number;
  orderNum: number;
  philosopher: string;
  theme: string;
  presenterName: string;
  noteCount: number;
  isEdit: boolean;
  initialArtTitle: string;
  initialArtExplanation: string;
  /** Signed URL for the existing artwork preview, used when editing. */
  existingPreviewUrl: string | null;
  /**
   * Submit-button copy. The page knows the topic state; the form just
   * renders. Default ("Save and publish") covers the original first-time
   * 'presented' case.
   */
  submitLabel?: string;
}

interface FormState {
  error?: string;
}

const PDF_RENDER_WIDTH = 600;

export function UploadForm({
  topicId,
  orderNum,
  philosopher,
  theme,
  presenterName,
  noteCount,
  isEdit,
  initialArtTitle,
  initialArtExplanation,
  existingPreviewUrl,
  submitLabel,
}: UploadFormProps) {
  const [artTitle, setArtTitle] = useState(initialArtTitle);
  const [artExplanation, setArtExplanation] = useState(initialArtExplanation);
  const [file, setFile] = useState<File | null>(null);
  const [pdfPreviewBlob, setPdfPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingPreviewUrl,
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [isHeicPlaceholder, setIsHeicPlaceholder] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Revoke blob URLs we created so we don't leak them between picks.
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const sentenceCount = useMemo(
    () => countSentences(artExplanation),
    [artExplanation],
  );
  const sentenceTone: "success" | "amber" | "neutral" =
    sentenceCount >= 5 && sentenceCount <= 7
      ? "success"
      : sentenceCount > 0
        ? "amber"
        : "neutral";

  const action = async (
    _prev: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    formData.set("topicId", String(topicId));
    formData.set("artTitle", artTitle);
    formData.set("artExplanation", artExplanation);
    if (file) {
      formData.set("file", file);
      if (pdfPreviewBlob) {
        formData.set("pdfPreview", pdfPreviewBlob, "preview.png");
      }
    } else {
      // Make sure a stale blank file input doesn't sneak through.
      formData.delete("file");
    }
    const result = await uploadPresentation(formData);
    return { error: result.error };
  };

  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    action,
    null,
  );

  async function adoptFile(picked: File) {
    setFileError(null);
    const check = isAcceptedArtFile({
      type: picked.type,
      name: picked.name,
      size: picked.size,
    });
    if (!check.ok) {
      setFileError(check.reason);
      return;
    }

    setFile(picked);
    setPdfPreviewBlob(null);

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    const meta = { type: picked.type, name: picked.name, size: picked.size };

    if (isPdf(meta)) {
      setIsHeicPlaceholder(false);
      setRenderingPdf(true);
      try {
        const blob = await renderPdfFirstPage(picked);
        setPdfPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not render PDF preview.";
        setFileError(`PDF preview failed: ${message}`);
        setFile(null);
        setPdfPreviewBlob(null);
        setPreviewUrl(existingPreviewUrl);
      } finally {
        setRenderingPdf(false);
      }
    } else if (isHeic(meta)) {
      setIsHeicPlaceholder(true);
      setPreviewUrl(null);
    } else {
      setIsHeicPlaceholder(false);
      setPreviewUrl(URL.createObjectURL(picked));
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) void adoptFile(picked);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const picked = e.dataTransfer.files?.[0];
    if (picked) void adoptFile(picked);
  }

  function clearFile() {
    setFile(null);
    setPdfPreviewBlob(null);
    setIsHeicPlaceholder(false);
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(existingPreviewUrl);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_320px]">
      <form action={formAction} className="flex flex-col gap-4">
        {/* Art title */}
        <section className="bg-white border border-line rounded-lg p-5">
          <Field
            label="Art title"
            hint="A short title for the work itself."
            htmlFor="artTitle"
          >
            <Input
              id="artTitle"
              value={artTitle}
              onChange={(e) => setArtTitle(e.target.value)}
              placeholder="e.g. The Cave at Dawn"
              maxLength={200}
              required
            />
          </Field>
        </section>

        {/* File picker */}
        <section className="bg-white border border-line rounded-lg p-5">
          <div className="text-[13px] font-medium text-text mb-1.5">
            Artwork
          </div>
          <div className="text-xs text-text-2 mb-3">
            JPG, PNG, WEBP, HEIC or PDF · 10 MB max. PDFs use the first page
            as preview.
          </div>
          {file ? (
            <FilePicked
              file={file}
              onReplace={() => fileInputRef.current?.click()}
              onClear={clearFile}
              renderingPdf={renderingPdf}
            />
          ) : (
            <DropZone
              dragOver={dragOver}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onBrowse={() => fileInputRef.current?.click()}
              hasExistingFile={isEdit && !!existingPreviewUrl}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif,.pdf"
            onChange={onPick}
          />
          {fileError ? (
            <div className="mt-3 text-xs text-danger">{fileError}</div>
          ) : null}
        </section>

        {/* Explanation */}
        <section className="bg-white border border-line rounded-lg p-5">
          <Field
            htmlFor="artExplanation"
            label={
              <span className="flex items-center justify-between gap-2 w-full">
                <span>Explanation</span>
                <Badge tone={sentenceTone}>
                  {sentenceCount} of 5–7 sentences
                </Badge>
              </span>
            }
            hint="A single paragraph. Conversational. What is the philosopher claiming, and what does the art ask us to see?"
          >
            <Textarea
              id="artExplanation"
              value={artExplanation}
              onChange={(e) => setArtExplanation(e.target.value)}
              rows={8}
              placeholder="Begin with the central claim, then bring the artwork in alongside it."
              maxLength={5000}
              required
            />
          </Field>
        </section>

        {/* Errors + actions */}
        {state?.error ? (
          <div className="bg-[#FCEBE8] border border-[#ECCFCB] text-danger text-[13px] px-3.5 py-2.5 rounded">
            {state.error}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Link href="/dashboard">
            <Button kind="ghost" type="button" disabled={isPending}>
              Cancel
            </Button>
          </Link>
          <Button kind="primary" type="submit" disabled={isPending || renderingPdf}>
            {isPending
              ? "Saving…"
              : submitLabel ?? (isEdit ? "Update" : "Save and publish")}
          </Button>
        </div>
      </form>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-4 self-start">
        <div className="font-mono text-[11px] text-text-2 uppercase tracking-[0.08em] mb-2">
          Live preview · gallery card
        </div>
        <UploadPreview
          orderNum={orderNum}
          philosopher={philosopher}
          theme={theme}
          artTitle={artTitle}
          previewUrl={previewUrl}
          noteCount={noteCount}
          presenterName={presenterName}
          heicFileName={isHeicPlaceholder ? file?.name ?? null : null}
        />
        <div className="text-xs text-text-2 mt-3">
          This is how your card will appear on every voter&rsquo;s dashboard.
        </div>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function DropZone({
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
  hasExistingFile,
}: {
  dragOver: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onBrowse: () => void;
  hasExistingFile: boolean;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={[
        "border-2 border-dashed rounded-lg p-9 text-center transition-colors duration-100",
        dragOver
          ? "border-violet bg-violet-100"
          : "border-line bg-surface-alt",
      ].join(" ")}
    >
      <div className="mb-2 flex justify-center text-text-2">
        <Icon name="upload" size={24} strokeWidth={1.4} />
      </div>
      <div className="font-medium text-text">
        Drop a file here, or{" "}
        <button
          type="button"
          onClick={onBrowse}
          className="text-violet-600 hover:underline cursor-pointer"
        >
          browse
        </button>
      </div>
      <div className="text-xs text-text-2 mt-1">
        {hasExistingFile
          ? "Leave empty to keep the current artwork."
          : "One file. You can replace it later."}
      </div>
    </div>
  );
}

function FilePicked({
  file,
  onReplace,
  onClear,
  renderingPdf,
}: {
  file: File;
  onReplace: () => void;
  onClear: () => void;
  renderingPdf: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-surface-alt rounded border border-line-2">
      <div className="w-10 h-10 rounded bg-white border border-line flex items-center justify-center shrink-0 text-text-2">
        <Icon
          name={file.type === "application/pdf" ? "file" : "upload"}
          size={18}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[13px] truncate">{file.name}</div>
        <div className="text-text-2 text-xs">
          {formatBytes(file.size)}
          {renderingPdf ? " · rendering preview…" : ""}
        </div>
      </div>
      <Button kind="ghost" size="sm" type="button" onClick={onReplace}>
        Replace
      </Button>
      <Button kind="ghost" size="sm" type="button" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── PDF first-page render (client-side) ──────────────────────────────────

async function renderPdfFirstPage(pdfFile: File): Promise<Blob> {
  // Dynamic import keeps pdfjs-dist out of the main bundle. The lib is
  // only loaded if the user actually picks a PDF.
  const pdfjs = await import("pdfjs-dist");

  // Worker setup. With Turbopack, `new URL('pdfjs-dist/build/...', import.meta.url)`
  // resolves to a bundled asset URL the worker can fetch.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await pdfFile.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = PDF_RENDER_WIDTH / viewport.width;
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable.");

    await page.render({
      canvas,
      canvasContext: context,
      viewport: scaled,
    }).promise;

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("Could not export preview as PNG.");
    return blob;
  } finally {
    await doc.destroy();
  }
}
