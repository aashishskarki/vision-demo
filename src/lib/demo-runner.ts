import "server-only";
import { getSql } from "./db";
// The pipeline modules are plain ESM (.mjs); TS imports them fine.
import { PROVIDERS } from "./providers.mjs";
import { extractDemo, classifyBrand, makeClient } from "./demo-extractor.mjs";

export const SURFACES: string[] = Object.keys(PROVIDERS);
const EXTRACT_MODEL = process.env.EXTRACT_MODEL ?? "claude-haiku-4-5";

export type RunStatus = {
  status: string;
  total_units: number;
  done_units: number;
  error: string | null;
};

export type RunInput = {
  website: string;
  own_brand: string;
  competitors: string[];
  prompts: string[];
};

export type CreateResult = { runId: string } | { error: string };

type RunRow = {
  id: string;
  own_brand: string;
  competitors: string[];
  status: string;
  total_units: number;
  done_units: number;
  error: string | null;
};

/**
 * Creates a run for a valid, unused invite. Flips invite.used_at inside the
 * same transaction, which makes a demo one-shot: a second attempt with the same
 * token returns "already_used". Also enforces the global daily cap.
 */
export async function createRun(inviteToken: string, input: RunInput): Promise<CreateResult> {
  const sql = getSql();

  const [invite] = await sql<{ id: string; used_at: string | null }[]>`
    select id, used_at from invites where token = ${inviteToken}`;
  if (!invite) return { error: "invalid_invite" };
  if (invite.used_at) return { error: "already_used" };

  const cap = Number(process.env.DEMO_DAILY_RUN_CAP ?? 25);
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from demo_runs where created_at >= date_trunc('day', now())`;
  if (Number(n) >= cap) return { error: "daily_cap" };

  const prompts = input.prompts.map((p) => p.trim()).filter(Boolean).slice(0, 3);
  if (!prompts.length) return { error: "no_prompts" };
  const competitors = (input.competitors ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 5);
  const total = prompts.length * SURFACES.length;

  const runId = await sql.begin(async (tx) => {
    const [run] = await tx<{ id: string }[]>`
      insert into demo_runs (invite_id, website, own_brand, competitors, status, total_units)
      values (${invite.id}, ${input.website}, ${input.own_brand},
              ${sql.array(competitors)}::text[], 'pending', ${total})
      returning id`;
    for (let i = 0; i < prompts.length; i++) {
      await tx`insert into demo_prompts (run_id, ordinal, text) values (${run.id}, ${i + 1}, ${prompts[i]})`;
    }
    await tx`update invites set used_at = now() where id = ${invite.id}`;
    return run.id;
  });

  return { runId: runId as string };
}

/**
 * Processes the next prompt that still has outstanding surfaces, running that
 * prompt's surfaces in parallel (≈3 steps for a 3-prompt run). Resume-safe:
 * work is derived from which (prompt, surface) rows are missing.
 */
export async function processNextUnits(runId: string): Promise<RunStatus> {
  const sql = getSql();
  const [run] = await sql<RunRow[]>`
    select id, own_brand, competitors, status, total_units, done_units, error
    from demo_runs where id = ${runId}`;
  if (!run) throw new Error("run not found");
  if (run.status === "done" || run.status === "failed") return toStatus(run);

  const prompts = await sql<{ id: string; text: string }[]>`
    select id, text from demo_prompts where run_id = ${runId} order by ordinal`;
  const existing = await sql<{ prompt_id: string; surface: string }[]>`
    select prompt_id, surface from demo_responses where run_id = ${runId}`;
  const done = new Set(existing.map((r) => `${r.prompt_id}|${r.surface}`));

  let target: { id: string; text: string } | null = null;
  let outstanding: string[] = [];
  for (const p of prompts) {
    const missing = SURFACES.filter((s) => !done.has(`${p.id}|${s}`));
    if (missing.length) {
      target = p;
      outstanding = missing;
      break;
    }
  }

  if (!target) {
    await sql`update demo_runs set status='done', finished_at=now(), done_units=${done.size} where id=${runId}`;
    return { status: "done", total_units: run.total_units, done_units: done.size, error: null };
  }

  if (run.status === "pending") {
    await sql`update demo_runs set status='running' where id=${runId}`;
  }

  const client = makeClient();
  await Promise.all(outstanding.map((surface) => processUnit(sql, client, run, target!, surface)));

  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from demo_responses where run_id = ${runId}`;
  const finished = Number(n) >= run.total_units;
  await sql`
    update demo_runs
    set done_units=${Number(n)}${finished ? sql`, status='done', finished_at=now()` : sql``}
    where id=${runId}`;

  return { status: finished ? "done" : "running", total_units: run.total_units, done_units: Number(n), error: null };
}

async function processUnit(
  sql: ReturnType<typeof getSql>,
  client: unknown,
  run: RunRow,
  prompt: { id: string; text: string },
  surface: string
) {
  const provider = (PROVIDERS as Record<
    string,
    { fn: (p: string) => Promise<{ text?: string; citations?: unknown[]; empty?: boolean }> }
  >)[surface];

  let text = "";
  let citations: unknown[] = [];
  let noAnswer = false;
  let errMsg: string | null = null;

  try {
    const out = await provider.fn(prompt.text);
    text = out.text ?? "";
    citations = out.citations ?? [];
    noAnswer = Boolean(out.empty);
  } catch (e) {
    errMsg = String((e as Error)?.message ?? e).slice(0, 500);
  }

  let brands: { name: string; ordinal_position: number | null }[] = [];
  if (!errMsg && !noAnswer && text) {
    try {
      brands = await extractDemo({ client, model: EXTRACT_MODEL, prompt: prompt.text, answer: text });
    } catch (e) {
      errMsg = "extract: " + String((e as Error)?.message ?? e).slice(0, 300);
    }
  }

  await sql.begin(async (tx) => {
    const [resp] = await tx<{ id: string }[]>`
      insert into demo_responses (run_id, prompt_id, surface, raw_text, no_answer, citations, extracted_at, error)
      values (${run.id}, ${prompt.id}, ${surface}, ${text || null}, ${noAnswer},
              ${JSON.stringify(citations)}::jsonb, ${brands.length ? new Date() : null}, ${errMsg})
      on conflict (run_id, prompt_id, surface) do update
        set raw_text = excluded.raw_text, no_answer = excluded.no_answer,
            citations = excluded.citations, extracted_at = excluded.extracted_at, error = excluded.error
      returning id`;

    await tx`delete from demo_mentions where response_id = ${resp.id}`;
    for (const b of brands) {
      const name = String(b?.name ?? "").trim();
      if (!name) continue;
      const cls = classifyBrand(name, run.own_brand, run.competitors ?? []);
      await tx`
        insert into demo_mentions (response_id, brand, is_own, tracked, ordinal_position)
        values (${resp.id}, ${name}, ${cls.is_own}, ${cls.tracked}, ${b.ordinal_position ?? null})`;
    }
  });
}

export async function getRunStatus(runId: string): Promise<RunStatus | null> {
  const sql = getSql();
  const [run] = await sql<
    { status: string; total_units: number; done_units: number; error: string | null }[]
  >`select status, total_units, done_units, error from demo_runs where id = ${runId}`;
  return run ? toStatus(run) : null;
}

function toStatus(run: {
  status: string;
  total_units: number;
  done_units: number;
  error: string | null;
}): RunStatus {
  return {
    status: run.status,
    total_units: run.total_units,
    done_units: run.done_units,
    error: run.error ?? null,
  };
}
