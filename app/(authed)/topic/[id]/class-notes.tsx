import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { getClassNotes } from "@/lib/data/notes";
import { formatRelative } from "@/lib/relative-time";

export async function ClassNotes({ topicId }: { topicId: number }) {
  const notes = await getClassNotes(topicId);

  if (notes.length === 0) {
    return (
      <div className="py-10 text-center text-text-2 text-[13px]">
        No shared notes yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      {notes.map((n) => (
        <Card key={n.id} className="p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <Avatar name={n.author.full_name} size={26} />
            <div className="min-w-0">
              <div className="font-medium text-[13px]">{n.author.full_name}</div>
              <div className="text-text-2 text-xs">
                {formatRelative(n.updated_at)}
              </div>
            </div>
          </div>
          <div className="font-serif text-[15px] leading-relaxed whitespace-pre-wrap">
            {n.body || (
              <span className="text-text-2 italic">
                (Note marked as shared but no body yet.)
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
