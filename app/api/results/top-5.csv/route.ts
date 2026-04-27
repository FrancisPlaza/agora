import { requireApproved } from "@/lib/auth";
import { getResults } from "@/lib/data/results";
import { csvResponse, csvRow, notFoundResponse } from "../csv-shared";

export async function GET() {
  // RLS already permits any approved voter to read tally_results.
  // Gate the route at the same level as the page itself.
  await requireApproved();

  const results = await getResults();
  if (!results) return notFoundResponse();

  const lines: string[] = [];
  lines.push(
    csvRow([
      "position",
      "topic_id",
      "philosopher",
      "theme",
      "art_title",
      "presenter",
      "final_share",
      "total_ballots",
    ]),
  );

  for (const run of results.runs) {
    if (!run.winner) {
      lines.push(
        csvRow([
          run.runNum,
          "",
          "",
          "",
          "",
          "",
          "",
          run.totalBallots,
        ]),
      );
      continue;
    }
    lines.push(
      csvRow([
        run.runNum,
        run.winner.id,
        run.winner.philosopher,
        run.winner.theme,
        run.winner.art_title ?? "",
        run.winner.presenter?.full_name ?? "",
        run.finalShare,
        run.totalBallots,
      ]),
    );
  }

  return csvResponse("agora-top-5.csv", lines.join("\r\n") + "\r\n");
}
