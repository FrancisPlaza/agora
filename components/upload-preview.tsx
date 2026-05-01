import { Badge } from "./ui/badge";

interface UploadPreviewProps {
  orderNum: number;
  philosopher: string;
  theme: string;
  artTitle: string;
  /** Object URL for an in-form preview (image or PDF first-page PNG). */
  previewUrl: string | null;
  noteCount?: number;
  presenterName?: string;
}

/**
 * Faux topic card showing how the published card will look on the
 * dashboard once the user saves. Matches the published-state hero
 * layout in components/topic-card.tsx; deliberately a separate
 * component because the real card expects a fully resolved TopicView
 * and we'd be jamming partial in-progress data into it.
 */
export function UploadPreview({
  orderNum,
  philosopher,
  theme,
  artTitle,
  previewUrl,
  noteCount = 0,
  presenterName,
}: UploadPreviewProps) {
  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden relative shadow-[0_1px_3px_rgba(10,37,64,0.06),0_1px_2px_rgba(10,37,64,0.04)]">
      <div className="absolute top-3 right-3 z-10">
        <Badge tone="amber">Yours</Badge>
      </div>
      <div className="aspect-[4/3] overflow-hidden bg-surface-alt">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={artTitle || theme}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-2 text-[13px]">
            No file selected yet
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-line-2">
        <div className="font-mono text-[11px] text-text-2 tabular-nums tracking-[0.04em] mb-1">
          Nº {String(orderNum).padStart(2, "0")}
        </div>
        <div className="font-serif text-[16px] font-semibold leading-snug tracking-tight truncate">
          {artTitle || philosopher}
        </div>
        <div className="font-serif italic text-[12px] text-text-2 mt-0.5 truncate">
          {theme}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-text-2">
          <span className="truncate">
            {presenterName ? `by ${presenterName}` : "by you"}
          </span>
          {noteCount > 0 ? (
            <Badge tone="neutral" icon="note">
              {noteCount}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}
