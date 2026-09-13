"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Drives the async run: calls /api/run/step in a loop (each step processes one
 * prompt's surfaces in parallel) until the run is done, then refreshes so the
 * server renders the results dashboard.
 */
export default function RunProgress({ runId, failed }: { runId: string; failed: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(failed ? "This run failed. Please request a new demo link." : null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || failed) return;
    started.current = true;

    let cancelled = false;
    (async () => {
      for (;;) {
        if (cancelled) return;
        let data: { status?: string; done_units?: number; total_units?: number; error?: string; detail?: string };
        try {
          const res = await fetch("/api/run/step", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ runId }),
          });
          data = await res.json();
          if (!res.ok) {
            setErr(data?.detail || data?.error || "The run hit an error.");
            return;
          }
        } catch {
          setErr("Network error while running. Refresh to resume.");
          return;
        }
        setDone(data.done_units ?? 0);
        setTotal(data.total_units ?? 0);
        if (data.status === "done") {
          router.refresh();
          return;
        }
        if (data.status === "failed") {
          setErr("The run failed.");
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runId, failed, router]);

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Running your AI-visibility check…</h1>
      <p className="mt-2 text-sm text-slate-600">
        Querying every engine and reading each answer. This takes a couple of minutes — keep this
        tab open.
      </p>

      <div className="mt-8">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="tnum mt-2 text-xs text-slate-500">
          {done} of {total || "…"} answers collected ({pct}%)
        </p>
      </div>

      {err && (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}
    </div>
  );
}
