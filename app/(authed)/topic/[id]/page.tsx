import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtPlaceholder } from "@/components/art-placeholder";
import { ArtworkLightbox } from "@/components/artwork-lightbox";
import { NoteEditor } from "@/components/note-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { getMyNote } from "@/lib/data/notes";
import { getTopicArtUrl } from "@/lib/data/storage";
import { getTopic } from "@/lib/data/topics";
import { getMyBallot } from "@/lib/data/voting";
import { AddToRankingForm } from "./add-to-ranking-form";
import { ClassNotes } from "./class-notes";
import { RemoveFromRankingForm } from "./remove-from-ranking-form";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

function fmtDate(input: string | null): string {
  if (!input) return "";
  return new Date(input).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Manila",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) return { title: "Topic" };
  // getTopic is React-cache()-wrapped, so the call inside the page
  // body below dedupes — no extra DB hit.
  const topic = await getTopic(id);
  return { title: topic?.philosopher ?? "Topic" };
}

export default async function TopicDetail({ params, searchParams }: PageProps) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) notFound();

  const topic = await getTopic(id);
  if (!topic) notFound();

  const { tab } = await searchParams;
  const activeTab = tab === "class" ? "class" : "mine";

  const user = await getCurrentUser();
  // presenter_voter_id !== null implies state ≥ assigned (deriveState
  // returns "unassigned" iff the FK is null), so the match alone is
  // sufficient. Phase 7.6 lets presenters work pre-presentation.
  const isMyTopic = !!user && topic.presenter_voter_id === user.id;

  const [myNote, artUrl, ballot] = await Promise.all([
    getMyNote(id),
    // Privacy is enforced upstream by maskArtForViewer: voters see
    // art_image_path = null on pre-presented topics; the presenter
    // sees their own. Render whatever the mask hands us.
    topic.art_image_path
      ? getTopicArtUrl(topic.art_image_path, {
          w: 1200,
          h: 700,
          version: topic.art_uploaded_at,
        })
      : Promise.resolve(null),
    getMyBallot(),
  ]);

  const isRanked = !!ballot?.rankings.some((r) => r.topicId === id);

  const isPublished = topic.state === "published";
  const stateBadge =
    topic.state === "presented"
      ? { tone: "violet" as const, label: "Presented · awaiting upload" }
      : topic.state === "assigned"
        ? {
            tone: "neutral" as const,
            label: topic.scheduled_for
              ? `Upcoming · ${fmtDate(topic.scheduled_for)}`
              : "Upcoming",
          }
        : topic.state === "unassigned"
          ? { tone: "neutral" as const, label: "Presenter TBA" }
          : null;

  return (
    <div className="max-w-[920px] mx-auto px-4 md:px-8 py-4 md:py-6 pb-10">
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[13px] text-text-2 hover:text-text"
        >
          <span aria-hidden>←</span> Back to gallery
        </Link>
      </div>

      {/* Hero — clickable lightbox only when there's real artwork. The
          gradient/placeholder branches stay plain <div>s; the lightbox
          affordance shouldn't appear over content that isn't the
          actual student work. */}
      {artUrl ? (
        <ArtworkLightbox src={artUrl} alt={topic.art_title ?? topic.theme}>
          <div className="rounded-lg overflow-hidden border border-line bg-white aspect-[4/3] md:aspect-[16/7]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artUrl}
              alt={topic.art_title ?? topic.theme}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        </ArtworkLightbox>
      ) : (
        <div className="rounded-lg overflow-hidden border border-line bg-white aspect-[4/3] md:aspect-[16/7]">
          {isPublished ? (
            <ArtPlaceholder
              orderNum={topic.order_num}
              philosopher={topic.philosopher}
              theme={topic.theme}
              artTitle={topic.art_title}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
              <div className="font-mono text-[11px] text-text-2 tracking-[0.1em] uppercase mb-3">
                Number {String(topic.order_num).padStart(2, "0")}
              </div>
              <div className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">
                {topic.philosopher}
              </div>
              <div className="font-serif italic text-text-2 mt-1.5">
                {topic.theme}
              </div>
              {stateBadge ? (
                <div className="mt-4">
                  <Badge tone={stateBadge.tone}>{stateBadge.label}</Badge>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Below hero — title block on the left, AddToRanking on the
          right. The "Your topic" badge sits inline at the end of the
          byline; the Edit-upload affordance gets its own row beneath
          the byline so it reads as an action rather than identity.
          md:items-start keeps the rank button aligned with the top of
          the title block (same baseline as the eyebrow line),
          regardless of whether Edit upload renders below the byline. */}
      <div className="mt-5 flex flex-col md:flex-row md:items-start md:justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] text-text-2 uppercase tracking-[0.08em]">
            {topic.philosopher} · {topic.theme}
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight m-0 mt-1">
            {topic.art_title ?? topic.theme}
          </h1>
          <div className="text-text-2 text-[13px] mt-1.5">
            {topic.presenter ? (
              <>
                by {topic.presenter.full_name}
                {topic.presented_at
                  ? ` · presented ${fmtDate(topic.presented_at)}`
                  : null}
                {isMyTopic ? (
                  <>
                    {" · "}
                    <Badge tone="amber">Your topic</Badge>
                  </>
                ) : null}
              </>
            ) : (
              "Presenter TBA"
            )}
          </div>
          {isMyTopic ? (
            <div className="mt-3">
              <Link href={`/topic/${topic.id}/upload`}>
                <Button kind="secondary" size="sm" icon="upload">
                  {topic.art_image_path ? "Edit upload" : "Upload art"}
                </Button>
              </Link>
            </div>
          ) : null}
        </div>
        <div className="shrink-0 ml-auto md:ml-0">
          {topic.state === "unassigned" ? (
            <span className="text-text-2 text-[13px] italic">
              No presenter assigned yet
            </span>
          ) : isRanked ? (
            <RemoveFromRankingForm topicId={topic.id} />
          ) : (
            <AddToRankingForm topicId={topic.id} />
          )}
        </div>
      </div>

      {topic.art_explanation ? (
        <p className="mt-5 font-serif text-[16px] leading-[1.7] text-text max-w-[680px] whitespace-pre-wrap">
          {topic.art_explanation}
        </p>
      ) : null}

      {/* Notes */}
      <div className="mt-8">
        <Tabs
          paramKey="tab"
          defaultId="mine"
          items={[
            { id: "mine", label: "My notes" },
            { id: "class", label: "Class notes", count: topic.class_note_count },
          ]}
        />
        {activeTab === "mine" ? (
          <NoteEditor
            topicId={topic.id}
            initialBody={myNote?.body ?? ""}
            initialVisibility={myNote?.visibility ?? "private"}
          />
        ) : (
          <ClassNotes topicId={topic.id} />
        )}
      </div>

    </div>
  );
}
