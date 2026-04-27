import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function AdminResultsStub() {
  const supabase = await createClient();
  const { data: results } = await supabase
    .from("tally_results")
    .select("run_num, winner_topic_id, total_ballots, exhausted, created_at")
    .order("run_num", { ascending: true });

  const lastComputedAt = results?.[0]?.created_at ?? null;
  const totalBallots = results?.[0]?.total_ballots ?? 0;

  return (
    <div>
      <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight m-0 mb-1">
        Tally results
      </h1>
      <p className="text-text-2 mb-6">
        The full Phase 7 results page (top-5 podium, IRV round breakdown,
        exports) ships separately. This is a Phase 6 stub that confirms the
        run-tally action wrote rows.
      </p>

      <Card pad>
        {!results || results.length === 0 ? (
          <div className="text-center py-8 text-text-2">
            <div className="font-serif text-lg mb-1">No tally yet</div>
            <div className="text-[13px]">
              Lock ballots and run the tally from{" "}
              <Link href="/admin/voting" className="text-violet-600 hover:underline">
                Voting controls
              </Link>
              .
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-text-2 text-xs uppercase tracking-[0.04em] mb-0.5">
                  Last run
                </div>
                <div className="text-sm">
                  <b>{totalBallots}</b> ballot{totalBallots === 1 ? "" : "s"} ·{" "}
                  {lastComputedAt
                    ? new Date(lastComputedAt).toLocaleString("en-GB")
                    : "—"}
                </div>
              </div>
              <Link href="/admin/voting">
                <Button kind="ghost" size="sm">
                  Re-run
                </Button>
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-alt">
                  <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2 border-b border-line">
                    Run
                  </th>
                  <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2 border-b border-line">
                    Winner topic id
                  </th>
                  <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2 border-b border-line">
                    Exhausted
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.run_num} className="border-b border-line-2 last:border-0">
                    <td className="px-3 py-2.5 font-mono tabular-nums">
                      #{r.run_num}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.winner_topic_id != null ? (
                        <Badge tone="success">Topic {r.winner_topic_id}</Badge>
                      ) : (
                        <Badge tone="neutral">Vacant</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-text-2">{r.exhausted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}
