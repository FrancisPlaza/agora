import { Card } from "@/components/ui/card";
import {
  getPendingApprovals,
  getUnassignedTopics,
} from "@/lib/data/admin";
import { ApprovalRow } from "./approval-row";

export default async function AdminApprovals() {
  const [pending, unassignedTopics] = await Promise.all([
    getPendingApprovals(),
    getUnassignedTopics(),
  ]);

  return (
    <div>
      <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight m-0 mb-1">
        Approval queue
      </h1>
      <p className="text-text-2 mb-6">
        Assign each voter to one of the remaining topics, then approve.
      </p>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt">
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Voter
                </th>
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Student ID
                </th>
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Registered
                </th>
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Assign topic
                </th>
                <th className="text-right text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center px-3 py-12 text-text-2"
                  >
                    <div className="font-serif text-lg mb-1">
                      Nothing in the queue
                    </div>
                    <div className="text-[13px]">
                      You&rsquo;re all caught up. New registrations will land
                      here.
                    </div>
                  </td>
                </tr>
              ) : (
                pending.map((v) => (
                  <ApprovalRow
                    key={v.id}
                    voter={v}
                    unassignedTopics={unassignedTopics}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
