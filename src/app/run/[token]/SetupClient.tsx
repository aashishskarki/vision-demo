"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ERRORS: Record<string, string> = {
  already_used: "This demo link has already been used — it's a one-time demo.",
  daily_cap: "The demo has hit today's usage limit. Please try again tomorrow.",
  invalid_invite: "This invite link isn't valid.",
  no_prompts: "Add at least one prompt.",
  missing_brand: "Enter your website and brand name.",
};

export default function SetupClient({ token, defaultBrand }: { token: string; defaultBrand: string }) {
  const router = useRouter();
  const [website, setWebsite] = useState("");
  const [ownBrand, setOwnBrand] = useState(defaultBrand);
  const [competitors, setCompetitors] = useState<string[]>(["", "", ""]);
  const [prompts, setPrompts] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setAt = (arr: string[], set: (v: string[]) => void, i: number, v: string) => {
    const next = [...arr];
    next[i] = v;
    set(next);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const cleanPrompts = prompts.map((p) => p.trim()).filter(Boolean);
    if (!website.trim() || !ownBrand.trim()) return setErr(ERRORS.missing_brand);
    if (!cleanPrompts.length) return setErr(ERRORS.no_prompts);

    setBusy(true);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          website: website.trim(),
          own_brand: ownBrand.trim(),
          competitors: competitors.map((c) => c.trim()).filter(Boolean),
          prompts: cleanPrompts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBusy(false);
        setErr(ERRORS[data?.error] ?? "Something went wrong. Please try again.");
        return;
      }
      router.refresh(); // server re-renders → progress view
    } catch {
      setBusy(false);
      setErr("Network error. Please try again.");
    }
  }

  const field = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Set up your AI-visibility check
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        We&rsquo;ll put your prompts to ChatGPT, Claude, Gemini, Perplexity, and Google&rsquo;s AI
        Overview &amp; AI Mode, then show how often you&rsquo;re named and who ranks above you.
        This demo runs <b>up to 3 prompts, once</b>.
      </p>

      {err && (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-800">
            Your website
            <input
              className={field}
              placeholder="example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Your brand name
            <input
              className={field}
              placeholder="Acme"
              value={ownBrand}
              onChange={(e) => setOwnBrand(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800">Competitors (optional, up to 5)</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {competitors.map((c, i) => (
              <input
                key={i}
                className={field}
                placeholder={`Competitor ${i + 1}`}
                value={c}
                onChange={(e) => setAt(competitors, setCompetitors, i, e.target.value)}
                disabled={busy}
              />
            ))}
          </div>
          {competitors.length < 5 && (
            <button
              type="button"
              onClick={() => setCompetitors([...competitors, ""])}
              className="mt-2 text-xs font-medium text-indigo-600 hover:underline"
              disabled={busy}
            >
              + Add another competitor
            </button>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800">Your prompts (up to 3)</p>
          <p className="text-xs text-slate-500">
            Ask what a prospect would ask — e.g. &ldquo;best digital marketing courses in India&rdquo;.
          </p>
          <div className="mt-2 space-y-3">
            {prompts.map((p, i) => (
              <input
                key={i}
                className={field}
                placeholder={`Prompt ${i + 1}`}
                value={p}
                onChange={(e) => setAt(prompts, setPrompts, i, e.target.value)}
                disabled={busy}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
        >
          {busy ? "Starting…" : "Run my demo"}
        </button>
      </form>
    </div>
  );
}
