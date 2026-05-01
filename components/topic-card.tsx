import Link from "next/link";
import { Badge, type BadgeTone } from "./ui/badge";
import { getTopicArtUrl } from "@/lib/data/storage";
import type { TopicState, TopicView } from "@/lib/data/topics";

export type Medal = 1 | 2 | 3 | 4 | 5;

interface TopicCardProps {
  topic: TopicView;
  isMine?: boolean;
  medal?: Medal;
}

const MEDAL_STYLES: Record<Medal, { bg: string; ring: string; label: string }> = {
  1: { bg: "bg-[#F4C95B] text-[#5A4413]", ring: "ring-[#E0AA2A]", label: "1st" },
  2: { bg: "bg-[#C8CDD3] text-[#3B4148]", ring: "ring-[#9BA1A8]", label: "2nd" },
  3: { bg: "bg-[#D1A77C] text-[#4A2E15]", ring: "ring-[#9C7B53]", label: "3rd" },
  4: { bg: "bg-surface-alt text-text-2", ring: "ring-line", label: "4th" },
  5: { bg: "bg-surface-alt text-text-2", ring: "ring-line", label: "5th" },
};

// Footer right-side status pill, keyed by topic state. Unassigned is
// omitted (no pill rendered).
const STATUS_PILL: Partial<Record<TopicState, { tone: BadgeTone; label: string }>> = {
  assigned: { tone: "neutral", label: "Upcoming" },
  presented: { tone: "amber", label: "Presented" },
  published: { tone: "success", label: "Published" },
};

function MedalPill({ medal }: { medal: Medal }) {
  const s = MEDAL_STYLES[medal];
  return (
    <span
      className={[
        "inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[11px] font-mono font-semibold ring-1 leading-none",
        s.bg,
        s.ring,
      ].join(" ")}
      title={`${s.label} place in the class tally`}
      aria-label={`${s.label} place`}
    >
      {medal === 1 ? "★ #1" : `#${medal}`}
    </span>
  );
}

/**
 * Top-left card chrome: the order-number pill. Visible on every card
 * across all four states. `bg-white/90` reads on both white-background
 * unpublished heroes and over published artwork without a backdrop
 * blur. The subtle ring + monospace numerals match the existing card
 * typography.
 */
function OrderPill({ orderNum }: { orderNum: number }) {
  return (
    <span className="absolute top-3 left-3 z-10 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold tabular-nums tracking-[0.04em] bg-white/90 text-text-2 ring-1 ring-line/60 leading-none">
      Nº {String(orderNum).padStart(2, "0")}
    </span>
  );
}

/**
 * Backdrop for any card without uploaded artwork — every state except
 * `published` with a working signed URL. Soft brand-violet linear
 * gradient: saturated enough to read as designed brand chrome, muted
 * enough to recede when sitting next to real student artwork. The
 * bottom darkening gradient + white text overlay layer on top.
 *
 * Tunable: bump toward #ABA8C9 / #C2B5CE if real artwork still finds
 * this too strong; lift toward #8B86F0 / #B79DE3 if it reads too
 * faded against the white card border.
 */
function NoArtBackdrop() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: "linear-gradient(135deg, #A6A2EA 0%, #C7B6E0 100%)",
      }}
      aria-hidden
    />
  );
}

export async function TopicCard({ topic, isMine, medal }: TopicCardProps) {
  const artUrl =
    topic.state === "published" && topic.art_image_path
      ? await getTopicArtUrl(topic.art_image_path, { w: 400, h: 300 })
      : null;

  const statusPill = STATUS_PILL[topic.state];

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={[
        "group block bg-white border border-line rounded-lg overflow-hidden relative",
        "shadow-[0_1px_3px_rgba(10,37,64,0.06),0_1px_2px_rgba(10,37,64,0.04)]",
        "transition-[box-shadow,border-color] duration-100 ease-out",
        "hover:shadow-[0_4px_14px_rgba(10,37,64,0.08),0_1px_3px_rgba(10,37,64,0.05)] hover:border-[#D7DEE7]",
      ].join(" ")}
    >
      <OrderPill orderNum={topic.order_num} />

      {isMine || medal ? (
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
          {isMine ? <Badge tone="amber">Yours</Badge> : null}
          {medal ? <MedalPill medal={medal} /> : null}
        </div>
      ) : null}

      <div className="aspect-[4/3] overflow-hidden relative">
        {/* Backdrop: artwork when we have it, gradient otherwise. The
            criterion is "do we have artwork" rather than the lifecycle
            state — every non-published card and every published card
            with a broken signed URL gets the gradient backdrop. */}
        {artUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artUrl}
            alt={topic.art_title ?? topic.theme}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <NoArtBackdrop />
        )}
        {/* Bottom darkening gradient — readability lever for the text
            overlay. Sandbox-tunable: nudge to black/75 if specific
            artwork makes the overlay hard to read. */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-black/65 pointer-events-none"
          aria-hidden
        />
        {/* Philosopher + theme overlay. Single-line truncation so long
            values don't wrap; full text is on the topic detail page.
            Uniform across all states — lifecycle reads from the
            footer status pill, not the backdrop treatment. */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-2 text-white">
          <div className="font-serif font-semibold text-[17px] leading-tight tracking-tight truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
            {topic.philosopher}
          </div>
          <div className="font-serif italic text-[12px] text-white/85 truncate mt-0.5">
            {topic.theme}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-line-2 flex items-center justify-between gap-2">
        <span className="text-xs text-text-2 truncate flex-1 min-w-0">
          {topic.state === "unassigned" ? (
            <span className="italic">Presenter TBA</span>
          ) : (
            <>by {topic.presenter?.full_name}</>
          )}
        </span>

        {statusPill ? (
          <Badge tone={statusPill.tone}>{statusPill.label}</Badge>
        ) : null}
      </div>
    </Link>
  );
}
