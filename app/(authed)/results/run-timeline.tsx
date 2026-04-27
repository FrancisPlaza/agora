import { Icon } from "@/components/ui/icon";
import type { ResultsRunView } from "@/lib/data/results";
import type { TopicView } from "@/lib/data/topics";

interface RunTimelineProps {
  run: ResultsRunView;
  topicMap: Map<number, TopicView>;
}

function lastNamePart(full: string): string {
  return full.trim().split(/\s+/).slice(-1)[0] ?? full;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-text-2 text-[11px] uppercase tracking-[0.08em]">
        {label}
      </div>
      <div className="font-serif text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

export function RunTimeline({ run, topicMap }: RunTimelineProps) {
  if (run.rounds.length === 0) {
    return (
      <div className="text-center text-text-2 py-12">
        This run produced no rounds — no ballots had preferences for any
        candidate still in play.
      </div>
    );
  }

  const firstRound = run.rounds[0];
  const firstLeader =
    firstRound.candidates.length > 0
      ? topicMap.get(firstRound.candidates[0].topicId)
      : null;
  const winnerTopic = run.winner;

  return (
    <div>
      {/* Stats row */}
      <div className="flex flex-wrap items-start gap-y-3 gap-x-8 mb-6">
        <div className="min-w-0">
          <div className="text-text-2 text-[11px] uppercase tracking-[0.08em]">
            Winner
          </div>
          <div className="font-serif text-xl font-semibold">
            {winnerTopic ? winnerTopic.philosopher : "Vacant"}
          </div>
          {winnerTopic ? (
            <div className="text-text-2 text-[13px]">
              {winnerTopic.art_title ?? winnerTopic.theme}
              {winnerTopic.presenter
                ? ` · by ${winnerTopic.presenter.full_name}`
                : ""}
            </div>
          ) : null}
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <Stat label="Rounds" value={run.rounds.length} />
          <Stat
            label="First-round leader"
            value={firstLeader ? lastNamePart(firstLeader.philosopher) : "—"}
          />
          <Stat label="Decided in" value={`Round ${run.rounds.length}`} />
          <Stat
            label="Final share"
            value={winnerTopic ? `${run.finalShare}%` : "—"}
          />
        </div>
      </div>

      {/* Vertical timeline */}
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
        {run.rounds.map((round, idx) => {
          const isFinal = idx === run.rounds.length - 1;
          const wonHere = isFinal && winnerTopic != null;
          return (
            <div key={round.round} className="contents">
              <div className="relative">
                <div className="flex items-baseline gap-2.5">
                  <div
                    className={[
                      "w-8 h-8 rounded-full flex items-center justify-center text-white font-mono font-semibold text-[13px] shrink-0",
                      wonHere ? "bg-success" : "bg-navy",
                    ].join(" ")}
                  >
                    {round.round}
                  </div>
                  <div>
                    <div className="font-semibold">Round {round.round}</div>
                    <div className="text-text-2 text-xs">
                      {round.totalActive} votes counted
                      {round.exhausted > 0
                        ? ` · ${round.exhausted} exhausted`
                        : ""}
                    </div>
                  </div>
                </div>
                {!isFinal ? (
                  <div className="ml-4 mt-2 h-6 w-0.5 bg-line" />
                ) : null}
              </div>
              <div className="bg-white border border-line rounded-lg p-4">
                {round.candidates.map((c) => {
                  const topic = topicMap.get(c.topicId);
                  const eliminated = round.eliminated === c.topicId;
                  const winnerHere = round.winner === c.topicId;
                  return (
                    <div
                      key={c.topicId}
                      className="flex gap-3 py-2 border-b border-line-2 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className={[
                              "text-sm min-w-0 truncate",
                              winnerHere
                                ? "font-semibold text-text"
                                : "font-medium",
                              eliminated
                                ? "line-through text-text-2"
                                : "text-text",
                            ].join(" ")}
                          >
                            {topic?.philosopher ?? `Topic ${c.topicId}`}
                            {eliminated ? (
                              <span className="text-text-2 text-[11px] ml-2 no-underline">
                                · eliminated, redistributed
                              </span>
                            ) : null}
                          </div>
                          <div className="font-mono text-xs font-semibold whitespace-nowrap">
                            {c.votes}{" "}
                            <span className="text-text-2 font-normal">
                              · {c.pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-surface-sunk overflow-hidden">
                          <div
                            className={[
                              "h-full rounded-full",
                              winnerHere
                                ? "bg-success"
                                : eliminated
                                  ? "bg-[#CBD5E1]"
                                  : "bg-violet",
                            ].join(" ")}
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {round.eliminated != null ? (
                  <div className="text-text-2 text-xs pt-3 flex items-center gap-1.5">
                    <Icon name="arrow-r" size={12} />
                    {topicMap.get(round.eliminated)?.philosopher ?? "Topic"}
                    &rsquo;s votes redistribute to next preferences in Round{" "}
                    {round.round + 1}.
                  </div>
                ) : null}
                {wonHere && winnerTopic ? (
                  <div className="text-success text-xs pt-3 flex items-center gap-1.5 font-medium">
                    <Icon name="check" size={12} />
                    {winnerTopic.philosopher} wins with {run.finalShare}% of
                    non-exhausted ballots.
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
