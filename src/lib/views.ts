import "server-only";
import { getSql } from "./db";
import { PROVIDERS } from "./providers.mjs";

export function surfaceLabel(id: string): string {
  return (PROVIDERS as Record<string, { label?: string }>)[id]?.label ?? id;
}

export type SovRow = {
  brand: string;
  own: boolean;
  tracked: boolean;
  answers: number;
  coverage: number;
  firsts: number;
  firstRate: number;
  avgPosition: number | null;
  slots: number;
  share: number;
};

export type SurfaceRow = {
  surface: string;
  answers: number;
  namedIn: number;
  coverage: number;
  ourSlots: number;
  slots: number;
  share: number;
  leader: string | null;
};

export type CoverageRow = { surface: string; responses: number; extracted: number; noAnswer: number };
export type AboveRow = { brand: string; times: number };

export type Citation = { url: string; title: string | null; domain: string | null };
export type PromptAnswer = {
  surface: string;
  answer: string;
  noAnswer: boolean;
  error: string | null;
  ownNamed: boolean;
  ownPos: number | null;
  citations: Citation[];
};
export type PromptBlock = { text: string; answers: PromptAnswer[] };

export type Results = {
  run: { id: string; website: string; own_brand: string; competitors: string[]; status: string };
  totals: { answers: number; slots: number; brands: number; slotsPerAnswer: number };
  own: SovRow | null;
  rows: SovRow[];
  bySurface: SurfaceRow[];
  coverage: CoverageRow[];
  above: AboveRow[];
  prompts: PromptBlock[];
};

/** Everything the results dashboard needs for one run. */
export async function getResults(runId: string): Promise<Results | null> {
  const sql = getSql();
  const [run] = await sql`
    select id, website, own_brand, competitors, status from demo_runs where id = ${runId}`;
  if (!run) return null;

  // Pool: extracted answers that actually carried a response.
  const [pool] = await sql<{ answers: number; slots: number }[]>`
    select
      (select count(*)::int from demo_responses
        where run_id = ${runId} and extracted_at is not null and not no_answer) as answers,
      (select count(*)::int from demo_mentions m
        join demo_responses r on r.id = m.response_id
        where r.run_id = ${runId}) as slots`;
  const answers = Number(pool?.answers ?? 0);
  const slots = Number(pool?.slots ?? 0);

  // One row per brand. All own-brand variants collapse under '__own__'.
  const raw = await sql<
    { key: string; brand: string; own: boolean; tracked: boolean; answers: number; slots: number; firsts: number; avg_pos: string | null }[]
  >`
    select
      case when m.is_own then '__own__' else lower(m.brand) end as key,
      min(m.brand) as brand,
      bool_or(m.is_own) as own,
      bool_or(m.tracked) as tracked,
      count(distinct m.response_id)::int as answers,
      count(*)::int as slots,
      count(*) filter (where m.ordinal_position = 1)::int as firsts,
      avg(m.ordinal_position) filter (where m.ordinal_position is not null) as avg_pos
    from demo_mentions m
    join demo_responses r on r.id = m.response_id
    where r.run_id = ${runId}
    group by 1
    order by count(distinct m.response_id) desc,
             avg(m.ordinal_position) filter (where m.ordinal_position is not null) asc nulls last,
             min(m.brand) asc`;

  const rows: SovRow[] = raw.map((r) => {
    const a = Number(r.answers);
    const s = Number(r.slots);
    const f = Number(r.firsts);
    return {
      brand: r.own ? run.own_brand : r.brand,
      own: r.own,
      tracked: r.tracked,
      answers: a,
      coverage: answers ? a / answers : 0,
      firsts: f,
      firstRate: a ? f / a : 0,
      avgPosition: r.avg_pos === null ? null : Number(r.avg_pos),
      slots: s,
      share: slots ? s / slots : 0,
    };
  });

  const bySurfaceRaw = await sql<
    { surface: string; answers: number; named_in: number; our_slots: number; slots: number; leader: string | null }[]
  >`
    with per as (
      select r.surface,
        count(distinct r.id) filter (where r.extracted_at is not null and not r.no_answer)::int as answers,
        count(distinct m.response_id) filter (where m.is_own)::int as named_in,
        count(m.*) filter (where m.is_own)::int as our_slots,
        count(m.*)::int as slots
      from demo_responses r
      left join demo_mentions m on m.response_id = r.id
      where r.run_id = ${runId}
      group by r.surface
    ),
    leaders as (
      select distinct on (r.surface) r.surface, m.brand
      from demo_responses r
      join demo_mentions m on m.response_id = r.id
      where r.run_id = ${runId}
      group by r.surface, lower(m.brand), m.brand
      order by r.surface, count(*) desc, m.brand
    )
    select p.surface, p.answers, p.named_in, p.our_slots, p.slots, l.brand as leader
    from per p left join leaders l on l.surface = p.surface
    order by p.surface`;

  const bySurface: SurfaceRow[] = bySurfaceRaw.map((r) => {
    const a = Number(r.answers);
    const s = Number(r.slots);
    const our = Number(r.our_slots);
    return {
      surface: r.surface,
      answers: a,
      namedIn: Number(r.named_in),
      coverage: a ? Number(r.named_in) / a : 0,
      ourSlots: our,
      slots: s,
      share: s ? our / s : 0,
      leader: r.leader,
    };
  });

  const coverageRaw = await sql<{ surface: string; responses: number; extracted: number; no_answer: number }[]>`
    select surface, count(*)::int as responses,
      count(*) filter (where extracted_at is not null and not no_answer)::int as extracted,
      count(*) filter (where no_answer)::int as no_answer
    from demo_responses where run_id = ${runId}
    group by surface order by surface`;
  const coverage: CoverageRow[] = coverageRaw.map((r) => ({
    surface: r.surface,
    responses: Number(r.responses),
    extracted: Number(r.extracted),
    noAnswer: Number(r.no_answer),
  }));

  const aboveRaw = await sql<{ brand: string; times: number }[]>`
    with ids as (select id from demo_responses where run_id = ${runId}),
    ours as (
      select response_id, ordinal_position as pos from demo_mentions
      where is_own and ordinal_position is not null and response_id in (select id from ids)
    )
    select min(m.brand) as brand, count(*)::int as times
    from demo_mentions m
    join ours o on o.response_id = m.response_id
    where not m.is_own and m.ordinal_position is not null and m.ordinal_position < o.pos
      and m.response_id in (select id from ids)
    group by lower(m.brand)
    order by count(*) desc, min(m.brand)`;
  const above: AboveRow[] = aboveRaw.map((r) => ({ brand: r.brand, times: Number(r.times) }));

  // The prompts and every engine's raw answer — the evidence behind the numbers.
  const answerRows = await sql<
    {
      ordinal: number;
      prompt: string;
      surface: string | null;
      raw_text: string | null;
      no_answer: boolean | null;
      error: string | null;
      own_named: boolean | null;
      own_pos: number | null;
      citations: Citation[] | null;
    }[]
  >`
    select p.ordinal, p.text as prompt, r.surface, r.raw_text, r.no_answer, r.error, r.citations,
      exists(select 1 from demo_mentions m where m.response_id = r.id and m.is_own) as own_named,
      (select min(m.ordinal_position) from demo_mentions m where m.response_id = r.id and m.is_own) as own_pos
    from demo_prompts p
    left join demo_responses r on r.prompt_id = p.id
    where p.run_id = ${runId}
    order by p.ordinal, r.surface`;

  const promptMap = new Map<string, PromptBlock>();
  for (const r of answerRows) {
    let block = promptMap.get(r.prompt);
    if (!block) {
      block = { text: r.prompt, answers: [] };
      promptMap.set(r.prompt, block);
    }
    if (r.surface) {
      block.answers.push({
        surface: r.surface,
        answer: r.raw_text ?? "",
        noAnswer: Boolean(r.no_answer),
        error: r.error,
        ownNamed: Boolean(r.own_named),
        ownPos: r.own_pos === null ? null : Number(r.own_pos),
        citations: Array.isArray(r.citations) ? r.citations : [],
      });
    }
  }
  const prompts = [...promptMap.values()];

  return {
    run: {
      id: run.id,
      website: run.website,
      own_brand: run.own_brand,
      competitors: run.competitors ?? [],
      status: run.status,
    },
    totals: {
      answers,
      slots,
      brands: rows.length,
      slotsPerAnswer: answers ? slots / answers : 0,
    },
    own: rows.find((r) => r.own) ?? null,
    rows,
    bySurface,
    coverage,
    above,
    prompts,
  };
}
