import type { Metadata } from "next";
import Link from "next/link";
import { ArtPlaceholder } from "@/components/art-placeholder";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signOut } from "@/lib/actions/auth";
import { requireApproved } from "@/lib/auth";
import { getTopicArtUrl } from "@/lib/data/storage";
import { getMyTopic } from "@/lib/data/topics";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

function fmtDate(input: string | null): string {
  if (!input) return "";
  return new Date(input).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Manila",
  });
}

export default async function Profile() {
  const profile = await requireApproved();
  const myTopic = await getMyTopic();
  const myTopicArtUrl =
    myTopic?.state === "published" && myTopic.art_image_path
      ? await getTopicArtUrl(myTopic.art_image_path, { w: 88, h: 88 })
      : null;

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-8 py-6 md:py-10">
      <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight mb-6">
        Profile
      </h1>

      <Card className="p-5 md:p-6">
        <div className="flex gap-3.5 mb-6 items-center">
          <Avatar name={profile.full_name} size={56} />
          <div>
            <div className="font-serif text-xl font-semibold">
              {profile.full_name}
            </div>
            <div className="text-text-2 text-[13px]">JDN101 · A.Y. 2025-26</div>
          </div>
        </div>
        <ProfileForm
          initialName={profile.full_name}
          email={profile.email}
          studentId={profile.student_id}
        />
      </Card>

      {myTopic ? (
        <Card className="p-5 md:p-6 mt-4">
          <div className="font-medium mb-1">Your assigned topic</div>
          <div className="text-text-2 text-[13px] mb-3.5">
            You&rsquo;re presenting one of the 32 topics.
          </div>
          <div className="flex items-center gap-3.5 p-3.5 bg-surface-alt rounded">
            <div className="w-11 h-11 rounded overflow-hidden shrink-0">
              {myTopicArtUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={myTopicArtUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ArtPlaceholder
                  orderNum={myTopic.order_num}
                  philosopher={myTopic.philosopher}
                  theme={myTopic.theme}
                  showLabel={false}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif font-semibold truncate">
                {myTopic.philosopher}
              </div>
              <div className="text-text-2 text-[13px] truncate">
                {myTopic.theme}
              </div>
            </div>
            {myTopic.state === "presented" ? (
              <Link href={`/topic/${myTopic.id}/upload`}>
                <Button kind="primary" size="sm">
                  Upload art
                </Button>
              </Link>
            ) : myTopic.state === "published" ? (
              <div className="flex items-center gap-2">
                <Badge tone="success" icon="check">
                  Published
                </Badge>
                <Link href={`/topic/${myTopic.id}/upload`}>
                  <Button kind="ghost" size="sm">
                    Edit
                  </Button>
                </Link>
              </div>
            ) : myTopic.state === "assigned" ? (
              <Badge tone="violet">
                {myTopic.scheduled_for
                  ? fmtDate(myTopic.scheduled_for)
                  : "Upcoming"}
              </Badge>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card className="p-5 md:p-6 mt-4">
        <div className="font-medium mb-3.5">Session</div>
        <form action={signOut}>
          <Button kind="ghost" icon="log-out" type="submit">
            Sign out
          </Button>
        </form>
      </Card>
    </div>
  );
}
