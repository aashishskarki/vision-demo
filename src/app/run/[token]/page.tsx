import { getSql } from "@/lib/db";
import { getResults } from "@/lib/views";
import SetupClient from "./SetupClient";
import RunProgress from "./RunProgress";
import Results from "./Results";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-[1000px] px-6 py-10">{children}</main>;
}

function DemoBadge() {
  return (
    <div className="mb-6 flex items-center justify-between">
      <p className="text-xs font-semibold tracking-[0.18em] text-indigo-600 uppercase">Vision</p>
      <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
        Demo · 3 prompts max
      </span>
    </div>
  );
}

export default async function RunPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sql = getSql();

  const [invite] = await sql`
    select id, name, email, company, used_at from invites where token = ${token}`;

  if (!invite) {
    return (
      <Shell>
        <DemoBadge />
        <h1 className="text-xl font-semibold text-slate-900">This link isn&rsquo;t valid</h1>
        <p className="mt-2 text-sm text-slate-600">
          The invite link is incorrect or has expired. Request a fresh one at{" "}
          <a className="text-indigo-600 underline" href="https://aashishkarki.com/projects/vision">
            aashishkarki.com/projects/vision
          </a>
          .
        </p>
      </Shell>
    );
  }

  const [run] = await sql`
    select id, status from demo_runs where invite_id = ${invite.id} order by created_at desc limit 1`;

  // No run yet → setup form.
  if (!run) {
    return (
      <Shell>
        <DemoBadge />
        <SetupClient token={token} defaultBrand={invite.company ?? ""} />
      </Shell>
    );
  }

  // Finished → results dashboard.
  if (run.status === "done") {
    const results = await getResults(run.id);
    if (!results) {
      return (
        <Shell>
          <DemoBadge />
          <p className="text-sm text-slate-600">Results are unavailable.</p>
        </Shell>
      );
    }
    return (
      <Shell>
        <DemoBadge />
        <Results
          results={results}
          invite={{ name: invite.name, email: invite.email, company: invite.company }}
        />
      </Shell>
    );
  }

  // pending / running / failed → progress driver.
  return (
    <Shell>
      <DemoBadge />
      <RunProgress runId={run.id} failed={run.status === "failed"} />
    </Shell>
  );
}
