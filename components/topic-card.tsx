import Link from "next/link";
import { ArtPlaceholder } from "./art-placeholder";
import { Badge } from "./ui/badge";
import { Icon } from "./ui/icon";
import { getTopicArtUrl } from "@/lib/data/storage";
import type { TopicView } from "@/lib/data/topics";

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

function fmtDate(input: string | null): string {
  if (!input) return "";
  return new Date(input).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function PlainHero({ topic }: { topic: TopicView }) {
  // Hero used for unassigned / assigned / presented states. Muted text on
  // a pale or white background. Mirrors the prototype's `.topic-card__hero`.
  return (
    <div
      className={[
        "h-full flex flex-col justify-between p-4",
        topic.state === "unassigned" ? "bg-[#FAFCFE]" : "bg-white",
      ].join(" ")}
    >
      <div className="font-mono text-[11px] text-text-2 tabular-nums tracking-[0.04em]">
        Nº {String(topic.order_num).padStart(2, "0")}
      </div>
      <div>
        <div className="font-serif text-[22px] font-semibold leading-snug tracking-tight">
          {topic.philosopher}
        </div>
        <div className="font-serif italic text-[13px] text-text-2 mt-1">
          {topic.theme}
        </div>
      </div>
    </div>
  );
}

export async function TopicCard({ topic, isMine, medal }: TopicCardProps) {
  const artUrl =
    topic.state === "published" && topic.art_image_path
      ? await getTopicArtUrl(topic.art_image_path, { w: 400, h: 300 })
      : null;

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
      {isMine || medal ? (
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
          {isMine ? <Badge tone="amber">Yours</Badge> : null}
          {medal ? <MedalPill medal={medal} /> : null}
        </div>
      ) : null}

      <div className="aspect-[4/3] overflow-hidden">
        {topic.state === "published" ? (
          artUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artUrl}
              alt={topic.art_title ?? topic.theme}
              className="w-full h-full object-cover"
            />
          ) : (
            <ArtPlaceholder
              orderNum={topic.order_num}
              philosopher={topic.philosopher}
              theme={topic.theme}
              artTitle={topic.art_title}
            />
          )
        ) : (
          <PlainHero topic={topic} />
        )}
      </div>

      <div className="px-4 py-3 border-t border-line-2 flex items-center justify-between gap-2">
        <span className="text-xs text-text-2 truncate flex-1 min-w-0">
          {topic.state === "unassigned" ? (
            <span className="italic">Presenter TBA</span>
          ) : topic.state === "assigned" ? (
            <>
              {topic.presenter?.full_name}
              {topic.scheduled_for ? ` · ${fmtDate(topic.scheduled_for)}` : ""}
            </>
          ) : topic.state === "presented" ? (
            <>Presented {fmtDate(topic.presented_at)}</>
          ) : (
            <>by {topic.presenter?.full_name}</>
          )}
        </span>

        {topic.state === "assigned" ? (
          <Badge tone="neutral">Upcoming</Badge>
        ) : topic.state === "presented" ? (
          <span className="text-xs text-violet-600 font-medium inline-flex items-center gap-1">
            <Icon name="note" size={12} />
            Take notes
          </span>
        ) : topic.state === "published" && topic.class_note_count > 0 ? (
          <Badge tone="neutral" icon="note">
            {topic.class_note_count}
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}
