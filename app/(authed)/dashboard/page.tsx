import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Chips } from "@/components/ui/chips";
import { StatusBanner } from "@/components/ui/status-banner";
import { TopicCard } from "@/components/topic-card";
import { getAllTopics, getMyTopic } from "@/lib/data/topics";
import { getMyNotedTopics } from "@/lib/data/notes";

type Filter = "all" | "published" | "presented" | "unassigned" | "mynotes";

const FILTERS: Filter[] = ["all", "published", "presented", "unassigned", "mynotes"];
const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  published: "Published",
  presented: "Presented",
  unassigned: "Unassigned",
  mynotes: "My notes",
};

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function Dashboard({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterParam = (params.filter ?? "all") as Filter;
  const filter: Filter = FILTERS.includes(filterParam) ? filterParam : "all";

  const [topics, myTopic, myNotedTopics] = await Promise.all([
    getAllTopics(),
    getMyTopic(),
    getMyNotedTopics(),
  ]);

  const myNotedSet = new Set(myNotedTopics);

  const counts = {
    all: topics.length,
    published: topics.filter((t) => t.state === "published").length,
    presented: topics.filter((t) => t.state === "presented").length,
    unassigned: topics.filter((t) => t.state === "unassigned").length,
    mynotes: topics.filter((t) => myNotedSet.has(t.id)).length,
  };

  const visible = topics.filter((t) => {
    if (filter === "all") return true;
    if (filter === "mynotes") return myNotedSet.has(t.id);
    return t.state === filter;
  });

  // Status banner: presenter whose own topic is in `presented` state gets
  // the amber "Your turn" variant. Otherwise, neutral informational copy.
  const banner =
    myTopic && myTopic.state === "presented"
      ? {
          tone: "amber" as const,
          title: "Your turn — upload your presentation",
          sub: "Add your art and a 5-7 sentence explanation so it appears in the gallery.",
          action: (
            <Link href="/profile">
              <Button kind="primary">Upload now</Button>
            </Link>
          ),
        }
      : {
          tone: "violet" as const,
          title: "Take notes as presentations happen",
          sub: "They're private until you flip the switch.",
        };

  const publishedCount = counts.published;

  return (
    <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-4 md:py-6 pb-10">
      <div className="flex items-baseline flex-wrap gap-3 mb-5">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight m-0">
          Class Gallery
        </h1>
        <div className="text-text-2 text-[13px]">
          JDN101 · {publishedCount} of {topics.length} published
        </div>
      </div>

      <div className="mb-5">
        <StatusBanner {...banner} />
      </div>

      <div className="mb-4">
        <Chips
          paramKey="filter"
          defaultId="all"
          items={FILTERS.map((id) => ({
            id,
            label: FILTER_LABEL[id],
            count: counts[id],
          }))}
        />
      </div>

      {visible.length === 0 ? (
        <div className="bg-white border border-dashed border-line rounded-lg p-10 text-center text-text-2">
          No topics match this filter.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <TopicCard key={t.id} topic={t} isMine={t.id === myTopic?.id} />
          ))}
        </div>
      )}
    </div>
  );
}
