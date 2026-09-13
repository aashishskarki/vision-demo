import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Results as ResultsData } from "@/lib/views";
import { surfaceLabel } from "@/lib/views";
import Cta from "@/components/Cta";

const pct = (n: number, dp = 0) => `${(n * 100).toFixed(dp)}%`;

function Card({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-medium tracking-wider text-slate-500 uppercase">{label}</div>
      <div className="tnum mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="tnum mt-1 text-xs text-slate-500">{caption}</div>
    </div>
  );
}

export default function Results({
  results,
  invite,
}: {
  results: ResultsData;
  invite: { name: string; email: string; company: string };
}) {
  const { run, totals, own, rows, bySurface, above, prompts } = results;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-8 lg:items-start">
      <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        How AI answers describe {run.own_brand}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {run.website} · across {totals.answers} answers from{" "}
        {bySurface.length} AI surfaces. Every figure traces to the raw answers below.
      </p>

      {/* headline cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Coverage"
          value={pct(own?.coverage ?? 0)}
          caption={`named in ${own?.answers ?? 0} of ${totals.answers} answers`}
        />
        <Card
          label="Share of voice"
          value={pct(own?.share ?? 0, 1)}
          caption={`${own?.slots ?? 0} of ${totals.slots} brand mentions`}
        />
        <Card
          label="Times #1"
          value={String(own?.firsts ?? 0)}
          caption={`of ${own?.answers ?? 0} mentions · ${pct(own?.firstRate ?? 0)}`}
        />
        <Card
          label="Avg position"
          value={own?.avgPosition ? own.avgPosition.toFixed(1) : "—"}
          caption={`across ${own?.answers ?? 0} mentions`}
        />
      </div>

      {/* share of voice */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Share of voice</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Every brand the answers named — yours, your competitors, and everyone else. Answers name{" "}
          <b className="tnum">{totals.slotsPerAnswer.toFixed(1)}</b> brands on average.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] tracking-wider text-slate-500 uppercase">
                <th className="w-10 px-3 py-2.5 text-left font-semibold">#</th>
                <th className="px-3 py-2.5 text-left font-semibold">Brand</th>
                <th className="px-3 py-2.5 text-right font-semibold">Answers</th>
                <th className="px-3 py-2.5 text-right font-semibold">Coverage</th>
                <th className="px-3 py-2.5 text-right font-semibold">Times #1</th>
                <th className="px-3 py-2.5 text-right font-semibold">Avg pos</th>
                <th className="px-3 py-2.5 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 15).map((r, i) => (
                <tr
                  key={r.brand + i}
                  className={"border-t border-slate-100 " + (r.own ? "bg-indigo-50 font-semibold" : "")}
                >
                  <td className="tnum px-3 py-2.5 text-slate-500">{i + 1}</td>
                  <td className={"px-3 py-2.5 " + (r.own ? "text-indigo-700" : "text-slate-900")}>
                    {r.brand}
                    {!r.tracked && (
                      <span className="ml-2 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        untracked
                      </span>
                    )}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right">{r.answers}</td>
                  <td className="tnum px-3 py-2.5 text-right">{pct(r.coverage)}</td>
                  <td className="tnum px-3 py-2.5 text-right">{r.firsts}</td>
                  <td className="tnum px-3 py-2.5 text-right">{r.avgPosition ? r.avgPosition.toFixed(1) : "—"}</td>
                  <td className="tnum px-3 py-2.5 text-right">{pct(r.share, 1)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    No brands were named in these answers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* by surface */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">By AI surface</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] tracking-wider text-slate-500 uppercase">
                <th className="px-3 py-2.5 text-left font-semibold">Surface</th>
                <th className="px-3 py-2.5 text-right font-semibold">Answers</th>
                <th className="px-3 py-2.5 text-right font-semibold">You named in</th>
                <th className="px-3 py-2.5 text-right font-semibold">Coverage</th>
                <th className="px-3 py-2.5 text-right font-semibold">Your share</th>
                <th className="px-3 py-2.5 text-left font-semibold">Most-named brand</th>
              </tr>
            </thead>
            <tbody>
              {bySurface.map((s) => (
                <tr key={s.surface} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 text-slate-900">{surfaceLabel(s.surface)}</td>
                  <td className="tnum px-3 py-2.5 text-right">{s.answers}</td>
                  <td className="tnum px-3 py-2.5 text-right">{s.namedIn}</td>
                  <td className="tnum px-3 py-2.5 text-right">{pct(s.coverage)}</td>
                  <td className="tnum px-3 py-2.5 text-right">{pct(s.share, 1)}</td>
                  <td className="px-3 py-2.5 text-slate-700">{s.leader ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* who ranks above */}
      {above.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Who ranks above you</h2>
          <p className="mt-1 text-sm text-slate-500">
            Counted only where you&rsquo;re named but not first.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] tracking-wider text-slate-500 uppercase">
                  <th className="px-3 py-2.5 text-left font-semibold">Brand</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Times above you</th>
                </tr>
              </thead>
              <tbody>
                {above.slice(0, 12).map((r) => (
                  <tr key={r.brand} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 text-slate-900">{r.brand}</td>
                    <td className="tnum px-3 py-2.5 text-right">{r.times}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* prompts & answers — the evidence behind every number */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Prompts &amp; answers</h2>
        <p className="mt-1 text-sm text-slate-500">
          Exactly what each engine said. Expand any answer to read it in full.
        </p>
        <div className="mt-3 space-y-6">
          {prompts.map((p, pi) => (
            <div key={pi} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[13px] font-semibold text-slate-900">
                <span className="text-slate-400">Q{pi + 1}.</span> {p.text}
              </p>
              <div className="mt-3 space-y-2">
                {p.answers.map((a, ai) => {
                  const status = a.error
                    ? "engine error"
                    : a.noAnswer
                      ? "no answer"
                      : a.ownNamed
                        ? `named ${run.own_brand}${a.ownPos ? ` at #${a.ownPos}` : ""}`
                        : `did not name ${run.own_brand}`;
                  const tone = a.ownNamed
                    ? "text-indigo-700"
                    : a.error || a.noAnswer
                      ? "text-slate-400"
                      : "text-slate-500";
                  return (
                    <details key={ai} className="group rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <summary className="flex cursor-pointer items-center justify-between gap-3 text-[13px] font-medium text-slate-800 marker:content-['']">
                        <span>{surfaceLabel(a.surface)}</span>
                        <span className={"text-xs font-normal " + tone}>{status}</span>
                      </summary>
                      <div className="mt-2 max-h-[28rem] overflow-y-auto border-t border-slate-200 pt-3">
                        {a.error ? (
                          <p className="text-[13px] text-slate-500">Couldn&rsquo;t fetch this answer ({a.error}).</p>
                        ) : a.noAnswer || !a.answer ? (
                          <p className="text-[13px] text-slate-500">(no answer returned for this query)</p>
                        ) : (
                          <div className="prose prose-sm max-w-none prose-slate prose-a:text-indigo-600 prose-headings:mt-3">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: ({ node: _node, ...props }) => (
                                  <a target="_blank" rel="noopener noreferrer" {...props} />
                                ),
                              }}
                            >
                              {a.answer}
                            </ReactMarkdown>
                          </div>
                        )}
                        {a.citations.length > 0 && (
                          <div className="mt-3 border-t border-slate-100 pt-2">
                            <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                              Sources ({a.citations.length})
                            </p>
                            <ol className="mt-1 space-y-1 text-xs">
                              {a.citations.map((c, ci) => (
                                <li key={ci} className="truncate">
                                  <span className="tnum text-slate-400">{ci + 1}.</span>{" "}
                                  <a
                                    href={c.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:underline"
                                  >
                                    {c.title || c.domain || c.url}
                                  </a>
                                  {c.domain && c.title ? <span className="text-slate-400"> · {c.domain}</span> : null}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

        <Cta invite={invite} runId={run.id} />
      </div>

      <aside className="mt-8 hidden lg:sticky lg:top-6 lg:mt-0 lg:block">
        <Cta invite={invite} runId={run.id} variant="sidebar" />
      </aside>
    </div>
  );
}
