import { ArtPlaceholder } from "@/components/art-placeholder";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { getTopicArtUrl } from "@/lib/data/storage";
import type { ResultsRunView } from "@/lib/data/results";

interface PodiumProps {
  runs: ResultsRunView[];
}

/** Five-card grid. Vacant runs render a muted "—" card. */
export async function Podium({ runs }: PodiumProps) {
  const cards = await Promise.all(
    runs.slice(0, 5).map(async (run) => {
      if (!run.winner) {
        return { run, artUrl: null as string | null };
      }
      const artUrl =
        run.winner.state === "published" && run.winner.art_image_path
          ? await getTopicArtUrl(run.winner.art_image_path, {
              w: 400,
              h: 400,
              version: run.winner.art_uploaded_at,
            })
          : null;
      return { run, artUrl };
    }),
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-9">
      {cards.map(({ run, artUrl }, i) => (
        <div
          key={run.runNum}
          className="bg-white border border-line rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(10,37,64,0.06),0_1px_2px_rgba(10,37,64,0.04)] flex flex-col"
        >
          <div className="aspect-square overflow-hidden">
            {!run.winner ? (
              <div className="w-full h-full flex items-center justify-center text-text-2 bg-surface-alt text-[13px] text-center px-3">
                Insufficient<br />preferences
              </div>
            ) : artUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artUrl}
                alt={run.winner.art_title ?? run.winner.theme}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              <ArtPlaceholder
                orderNum={run.winner.order_num}
                philosopher={run.winner.philosopher}
                theme={run.winner.theme}
                artTitle={run.winner.art_title}
              />
            )}
          </div>
          <div className="p-3.5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <div className="font-mono text-[11px] text-text-2 tracking-[0.08em]">
                RUN {run.runNum}
              </div>
              {i === 0 ? (
                <Badge tone="amber" icon="trophy">
                  #{run.runNum}
                </Badge>
              ) : (
                <Badge tone="navy">#{run.runNum}</Badge>
              )}
            </div>
            {run.winner ? (
              <>
                <div className="font-serif text-[17px] font-semibold leading-snug">
                  {run.winner.philosopher}
                </div>
                <div className="text-text-2 text-xs mt-0.5 italic">
                  {run.winner.art_title ?? run.winner.theme}
                </div>
                {run.winner.presenter ? (
                  <div className="text-text-2 text-xs mt-1.5">
                    by {run.winner.presenter.full_name}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-text-2 text-[13px] flex-1 flex items-center gap-1">
                <Icon name="info" size={12} />
                Vacant — no candidate reached majority.
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
