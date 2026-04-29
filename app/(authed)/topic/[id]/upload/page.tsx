import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UploadForm } from "@/components/upload-form";
import { requireApproved } from "@/lib/auth";
import { getTopicArtUrl } from "@/lib/data/storage";
import { getTopic } from "@/lib/data/topics";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UploadPage({ params }: PageProps) {
  const profile = await requireApproved();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) notFound();

  const topic = await getTopic(id);
  if (!topic) notFound();

  // Gate: only the assigned presenter, and only when the topic has a
  // presenter at all. Phase 7.6 widens this — assigned (pre-presented),
  // presented, and published are all valid upload destinations. The
  // storage RLS allows the write; the read policy hides the file from
  // non-presenters until presented_at is set.
  if (topic.presenter_voter_id !== profile.id) {
    redirect("/dashboard");
  }
  if (topic.state === "unassigned") {
    redirect("/dashboard");
  }

  const hasUploaded = !!topic.art_uploaded_at;
  const isEdit = hasUploaded;
  const isPresented = !!topic.presented_at;
  const existingPreviewUrl = hasUploaded
    ? await getTopicArtUrl(topic.art_image_path, { w: 600, h: 450 })
    : null;

  // Three header variants:
  //  • assigned + uploaded   → "Edit … visible once your beadle marks you presented."
  //  • presented + uploaded  → "Edit your presentation"
  //  • assigned (no upload yet) or presented (no upload yet) → "Upload your presentation"
  const headerTitle = hasUploaded
    ? isPresented
      ? "Edit your presentation"
      : "Edit your presentation"
    : "Upload your presentation";
  const headerSub =
    hasUploaded && !isPresented
      ? "Visible to the class once your beadle marks you presented."
      : null;

  // Submit-button copy mirrors the same three states.
  const submitLabel = hasUploaded
    ? "Update"
    : isPresented
      ? "Save and publish"
      : "Save (visible after beadle marks presented)";

  return (
    <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-4 md:py-6 pb-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-[13px] text-text-2 hover:text-text"
      >
        <span aria-hidden>←</span> Back to gallery
      </Link>

      <div className="mt-3 mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight m-0">
          {headerTitle}
        </h1>
        <div className="text-text-2 mt-1.5 text-sm">
          Topic Nº {String(topic.order_num).padStart(2, "0")} ·{" "}
          <b className="text-text">{topic.philosopher}</b> · {topic.theme}
        </div>
        {headerSub ? (
          <div className="text-text-2 mt-1.5 text-sm italic">{headerSub}</div>
        ) : null}
      </div>

      <UploadForm
        topicId={topic.id}
        orderNum={topic.order_num}
        philosopher={topic.philosopher}
        theme={topic.theme}
        presenterName={profile.full_name}
        noteCount={topic.class_note_count}
        isEdit={isEdit}
        initialArtTitle={topic.art_title ?? ""}
        initialArtExplanation={topic.art_explanation ?? ""}
        existingPreviewUrl={existingPreviewUrl}
        submitLabel={submitLabel}
      />
    </div>
  );
}
