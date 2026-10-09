import { ChangePasswordForm } from "@/components/change-password-form";
import { getProfile } from "@/lib/auth";
import { departmentLabel } from "@/lib/departments";
import { getDepartments } from "@/lib/departments-server";
import { roleLabel } from "@/lib/types";

export const metadata = { title: "Profile" };

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

// One row of the account list: the label on the left, the value on the
// right, like a settings screen. The old card set each label as a tiny
// uppercase eyebrow over its value, four times, which read as a form to fill
// in rather than facts to check.
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-3 [&+div]:border-t [&+div]:border-border/70">
      <dt className="type-callout text-muted-foreground">{label}</dt>
      <dd className="type-headline min-w-0 truncate text-right">{value}</dd>
    </div>
  );
}

export default async function ProfilePage() {
  const profile = await getProfile();
  const departments = await getDepartments();
  const name = profile.full_name || profile.email;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 sm:space-y-12">
      {/* Who you are, as a heading: initials, your role above your name, your
          email below. The page is about one person, and it says so before it
          says anything else. */}
      <header className="flex items-center gap-5">
        <span
          aria-hidden
          className="grid size-20 shrink-0 place-items-center rounded-full bg-primary/10 font-heading text-2xl font-semibold text-primary sm:size-24 sm:text-3xl"
        >
          {initials(name)}
        </span>
        <div className="min-w-0 space-y-1.5">
          <p className="type-eyebrow">{roleLabel(profile.role)}</p>
          <h1 className="type-title truncate">{name}</h1>
          <p className="type-subtitle truncate">{profile.email}</p>
        </div>
      </header>

      <section aria-labelledby="profile-account" className="space-y-3">
        <div className="space-y-1">
          <h2 id="profile-account" className="type-section">
            Account
          </h2>
          <p className="type-callout text-muted-foreground">
            Your role and department are set by an administrator.
          </p>
        </div>
        <dl className="overflow-hidden rounded-[1.25rem] bg-card">
          <Row label="Name" value={profile.full_name || "—"} />
          <Row label="Email" value={profile.email} />
          <Row label="Role" value={roleLabel(profile.role)} />
          <Row
            label="Department"
            value={
              departmentLabel(profile.department, departments) ?? "Unassigned"
            }
          />
        </dl>
      </section>

      <section aria-labelledby="profile-password" className="space-y-3">
        <div className="space-y-1">
          <h2 id="profile-password" className="type-section">
            Change password
          </h2>
          <p className="type-callout text-muted-foreground">
            If you signed in with the temporary password from your invite, set
            your own here.
          </p>
        </div>
        <div className="rounded-[1.25rem] bg-card p-5 sm:p-6">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
