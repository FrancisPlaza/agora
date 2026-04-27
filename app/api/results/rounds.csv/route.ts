import { requireApproved } from "@/lib/auth";
import { getResults, getResultsTopicMap } from "@/lib/data/results";
import { csvResponse, csvRow, notFoundResponse } from "../csv-shared";

export async function GET() {
  await requireApproved();

  const [results, topicMap] = await Promise.all([
    getResults(),
    getResultsTopicMap(),
  ]);
  if (!results) return notFoundResponse();

  const lines: string[] = [];
  lines.push(
    csvRow([
      "run",
      "round",
      "topic_id",
      "philosopher",
      "theme",
      "votes",
      "pct",
      "eliminated",
      "winner",
    ]),
  );

  for (const run of results.runs) {
    for (const round of run.rounds) {
      for (const c of round.candidates) {
        const topic = topicMap.get(c.topicId);
        lines.push(
          csvRow([
            run.runNum,
            round.round,
            c.topicId,
            topic?.philosopher ?? "",
            topic?.theme ?? "",
            c.votes,
            c.pct.toFixed(1),
            String(round.eliminated === c.topicId),
            String(round.winner === c.topicId),
          ]),
        );
      }
    }
  }

  return csvResponse("agora-rounds.csv", lines.join("\r\n") + "\r\n");
}
