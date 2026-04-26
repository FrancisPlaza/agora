import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { signOut } from "@/lib/actions/auth";
import { requireApproved } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export default async function Profile() {
  const profile = await requireApproved();

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

      <Card className="p-5 md:p-6 mt-4">
        <div className="font-medium mb-3.5">Session</div>
        <form action={signOut}>
          <Button kind="ghost" icon="log-out" type="submit">
            Sign out
          </Button>
        </form>
      </Card>

      <div className="mt-4 text-text-2 text-[13px] flex items-center gap-2">
        <Icon name="info" size={14} />
        Your assigned-topic card ships with the presenter flow in Phase 5.
      </div>
    </div>
  );
}
