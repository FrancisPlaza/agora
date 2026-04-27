"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { saveDraftRankings, submitBallot } from "@/lib/actions/ballot";

interface TopicLite {
  id: number;
  philosopher: string;
  theme: string;
}

interface RankingEditorProps {
  topics: TopicLite[];
  /** Pre-rendered <RankingThumbnail> per topic id, server-resolved. */
  thumbnails: Map<number, ReactNode>;
  /** Current draft ranking (topic ids in rank order). */
  initialRanked: number[];
  /** Total topics for the "ranked N of M" copy. */
  totalTopics: number;
  /** Optional topic id to scroll into view + highlight on mount. */
  focusTopicId?: number;
}

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

const DEBOUNCE_MS = 800;

const RANKED_DROPPABLE_ID = "__ranked_drop__";

export function RankingEditor({
  topics,
  thumbnails,
  initialRanked,
  totalTopics,
  focusTopicId,
}: RankingEditorProps) {
  const [ranked, setRanked] = useState<number[]>(initialRanked);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const lastSaved = useRef<number[]>(initialRanked);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedRowRef = useRef<HTMLDivElement | null>(null);

  const byId = useMemo(
    () => new Map(topics.map((t) => [t.id, t])),
    [topics],
  );

  const unranked = useMemo(() => {
    const s = search.trim().toLowerCase();
    return topics
      .filter((t) => !ranked.includes(t.id))
      .filter((t) =>
        s
          ? `${t.philosopher} ${t.theme}`.toLowerCase().includes(s)
          : true,
      );
  }, [topics, ranked, search]);

  // ── Autosave ─────────────────────────────────────────────────────────
  function scheduleSave(next: number[]) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => flushSave(next), DEBOUNCE_MS);
  }

  function flushSave(snapshot: number[]) {
    debounceTimer.current = null;
    if (
      snapshot.length === lastSaved.current.length &&
      snapshot.every((id, i) => id === lastSaved.current[i])
    ) {
      return;
    }
    const previous = lastSaved.current;
    setStatus({ kind: "saving" });
    startTransition(async () => {
      const payload = snapshot.map((topicId, i) => ({
        topicId,
        rank: i + 1,
      }));
      const result = await saveDraftRankings(payload);
      if (result.error) {
        // Revert to last known good state
        setRanked(previous);
        setStatus({ kind: "error", message: result.error });
        return;
      }
      lastSaved.current = snapshot;
      setStatus({ kind: "saved" });
    });
  }

  function applyChange(next: number[]) {
    setRanked(next);
    scheduleSave(next);
  }

  // ── DnD ──────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const activeIdNum = Number(active.id);
    const overIdNum = Number(over.id);
    const overContainer =
      over.id === RANKED_DROPPABLE_ID ? RANKED_DROPPABLE_ID : null;

    const fromRanked = ranked.includes(activeIdNum);
    const toRanked = ranked.includes(overIdNum) || overContainer === RANKED_DROPPABLE_ID;

    if (fromRanked && toRanked) {
      // Re-order within ranked
      if (over.id === RANKED_DROPPABLE_ID) return;
      const oldIndex = ranked.indexOf(activeIdNum);
      const newIndex = ranked.indexOf(overIdNum);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      applyChange(arrayMove(ranked, oldIndex, newIndex));
      return;
    }

    if (!fromRanked && toRanked) {
      // Add from unranked → ranked
      const insertAt =
        over.id === RANKED_DROPPABLE_ID
          ? ranked.length
          : ranked.indexOf(overIdNum);
      const next = [...ranked];
      next.splice(insertAt, 0, activeIdNum);
      applyChange(next);
      return;
    }
  }

  function removeRanked(topicId: number) {
    applyChange(ranked.filter((id) => id !== topicId));
  }

  function addRanked(topicId: number) {
    if (ranked.includes(topicId)) return;
    applyChange([...ranked, topicId]);
  }

  // ── Submit ───────────────────────────────────────────────────────────
  function openSubmit() {
    setSubmitError(null);
    setSubmitOpen(true);
  }

  function doSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    startTransition(async () => {
      const payload = ranked.map((topicId, i) => ({ topicId, rank: i + 1 }));
      const result = await submitBallot(payload);
      setSubmitting(false);
      if (result.error) {
        setSubmitError(result.error);
        return;
      }
      // Page revalidates via revalidatePath inside the action chain;
      // forcing a navigation reload to ensure the locked state appears.
      window.location.assign("/vote");
    });
  }

  // ── Focus / scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (!focusTopicId || !focusedRowRef.current) return;
    focusedRowRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [focusTopicId]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const indicator =
    status.kind === "saving"
      ? "Saving…"
      : status.kind === "saved"
        ? "Draft saved · just now"
        : status.kind === "error"
          ? status.message
          : `Draft saves automatically.`;

  const activeTopic = activeId != null ? byId.get(activeId) : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* Unranked pane */}
          <section className="bg-white border border-line rounded-lg p-4">
            <h3 className="m-0 mb-3 text-sm font-semibold flex items-center justify-between">
              <span>
                Unranked{" "}
                <span className="text-text-2 font-normal ml-1">
                  {unranked.length}
                </span>
              </span>
            </h3>
            <div className="relative">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search philosopher or theme…"
                className="pl-8"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3">
                <Icon name="search" size={14} />
              </span>
            </div>
            <div className="mt-3 max-h-[360px] lg:max-h-[580px] overflow-auto pr-1">
              {unranked.length === 0 ? (
                <div className="rounded border border-dashed border-line p-8 text-center text-text-2">
                  Everything ranked. Reorder on the right.
                </div>
              ) : (
                unranked.map((t) => (
                  <UnrankedRow
                    key={t.id}
                    topic={t}
                    thumb={thumbnails.get(t.id)}
                    onAdd={() => addRanked(t.id)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Ranked pane */}
          <RankedPane
            ranked={ranked}
            byId={byId}
            thumbnails={thumbnails}
            focusTopicId={focusTopicId}
            focusedRowRef={focusedRowRef}
            onRemove={removeRanked}
          />
        </div>

        <DragOverlay>
          {activeTopic ? (
            <div className="rank-row-overlay flex items-center gap-3 px-3 py-2.5 bg-white border border-line rounded shadow-[0_12px_32px_rgba(10,37,64,0.12),0_2px_8px_rgba(10,37,64,0.06)]">
              <Icon name="drag" size={14} />
              {thumbnails.get(activeTopic.id)}
              <div className="text-[13px] min-w-0 flex-1">
                <b className="font-serif font-semibold text-sm block truncate">
                  {activeTopic.philosopher}
                </b>
                <span className="text-text-2 truncate">{activeTopic.theme}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 bg-white border-t border-line z-30 px-4 md:px-8 py-3 flex items-center gap-3">
        <div className="flex-1 text-[13px] min-w-0">
          <span className="font-medium">
            Ranked {ranked.length} of {totalTopics}.
          </span>{" "}
          <span className="text-text-2">Unranked count as no preference.</span>
          <div
            className={[
              "text-xs mt-0.5 truncate",
              status.kind === "error" ? "text-danger" : "text-text-2",
            ].join(" ")}
          >
            {indicator}
          </div>
        </div>
        <Button kind="primary" size="lg" onClick={openSubmit}>
          Submit final ballot
        </Button>
      </div>

      {/* Submit modal */}
      {submitOpen ? (
        <div
          className="fixed inset-0 bg-[rgba(10,37,64,0.45)] z-50 flex items-center justify-center p-5"
          onClick={() => !submitting && setSubmitOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-[0_12px_32px_rgba(10,37,64,0.12),0_2px_8px_rgba(10,37,64,0.06)] w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-2xl font-semibold tracking-tight m-0 mb-2">
              Submit your final ballot?
            </h2>
            <p className="text-text-2 m-0 mb-2">
              You ranked{" "}
              <b className="text-text">
                {ranked.length} of {totalTopics}
              </b>{" "}
              topics. Unranked topics count as no preference.
            </p>
            <p className="bg-surface-alt text-text-2 px-3 py-2.5 rounded text-[13px] m-0">
              Once submitted, your ballot is locked.
            </p>
            {submitError ? (
              <p className="mt-3 text-[13px] text-danger m-0">{submitError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                kind="ghost"
                onClick={() => setSubmitOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button kind="primary" onClick={doSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit ballot"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function UnrankedRow({
  topic,
  thumb,
  onAdd,
}: {
  topic: TopicLite;
  thumb: ReactNode;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: topic.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex items-center gap-3 px-3 py-2.5 bg-white border border-line rounded mb-2 cursor-grab",
        isDragging ? "opacity-40" : "",
      ].join(" ")}
      {...attributes}
      {...listeners}
    >
      <span className="text-text-3"><Icon name="drag" size={14} /></span>
      {thumb}
      <div className="text-[13px] min-w-0 flex-1">
        <b className="font-serif font-semibold text-sm block truncate">
          {topic.philosopher}
        </b>
        <span className="text-text-2 truncate">{topic.theme}</span>
      </div>
      <Button kind="ghost" size="sm" icon="plus" onClick={onAdd}>
        Add
      </Button>
    </div>
  );
}

function RankedPane({
  ranked,
  byId,
  thumbnails,
  focusTopicId,
  focusedRowRef,
  onRemove,
}: {
  ranked: number[];
  byId: Map<number, TopicLite>;
  thumbnails: Map<number, ReactNode>;
  focusTopicId?: number;
  focusedRowRef: React.RefObject<HTMLDivElement | null>;
  onRemove: (topicId: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: RANKED_DROPPABLE_ID });

  return (
    <section
      ref={setNodeRef}
      className={[
        "bg-white border rounded-lg p-4",
        isOver ? "border-violet" : "border-line",
      ].join(" ")}
    >
      <h3 className="m-0 mb-3 text-sm font-semibold flex items-center justify-between">
        <span>
          My ranking{" "}
          <span className="text-text-2 font-normal ml-1">{ranked.length}</span>
        </span>
      </h3>
      {ranked.length === 0 ? (
        <div className="rounded border border-dashed border-line p-8 text-center text-text-2">
          <div className="font-serif text-3xl opacity-40 mb-2">Nº</div>
          <div className="font-medium text-text">No rankings yet</div>
          <div className="mt-1 text-[13px]">
            Drag a topic from the left to start your ranking.
          </div>
        </div>
      ) : (
        <SortableContext items={ranked} strategy={verticalListSortingStrategy}>
          {ranked.map((id, i) => {
            const t = byId.get(id);
            if (!t) return null;
            const focused = focusTopicId === id;
            return (
              <RankedRow
                key={id}
                topic={t}
                thumb={thumbnails.get(id)}
                index={i}
                focused={focused}
                rowRef={focused ? focusedRowRef : null}
                onRemove={() => onRemove(id)}
              />
            );
          })}
        </SortableContext>
      )}
    </section>
  );
}

function RankedRow({
  topic,
  thumb,
  index,
  focused,
  rowRef,
  onRemove,
}: {
  topic: TopicLite;
  thumb: ReactNode;
  index: number;
  focused: boolean;
  rowRef: React.RefObject<HTMLDivElement | null> | null;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: topic.id });

  const isFirst = index === 0;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (rowRef) rowRef.current = node;
      }}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={[
        "flex items-center gap-3 px-3 py-2.5 bg-white border border-line rounded mb-2",
        isFirst ? "border-l-[3px] border-l-amber" : "",
        isDragging ? "opacity-40" : "",
        focused ? "ring-2 ring-amber" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className="text-text-3 cursor-grab active:cursor-grabbing p-1 -m-1"
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        <Icon name="drag" size={14} />
      </button>
      <div className="font-mono tabular-nums text-sm font-semibold text-navy w-6 text-right">
        #{index + 1}
      </div>
      {thumb}
      <div className="text-[13px] min-w-0 flex-1">
        <b className="font-serif font-semibold text-sm block truncate">
          {topic.philosopher}
        </b>
        <span className="text-text-2 truncate">{topic.theme}</span>
      </div>
      <Button kind="ghost" size="sm" icon="x" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
