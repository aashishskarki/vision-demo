"use client";

import { useState } from "react";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/917505511899";

export default function Cta({
  invite,
  runId,
  variant = "banner",
}: {
  invite: { name: string; email: string; company: string };
  runId: string;
  variant?: "banner" | "sidebar";
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return setErr("Please enter a phone number.");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "form",
          name: invite.name,
          email: invite.email,
          company: invite.company,
          phone: phone.trim(),
          runId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d?.error === "missing_phone" ? "Please enter a phone number." : "Something went wrong.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setErr("Network error. Please try again.");
      setBusy(false);
    }
  }

  const modal = open && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !busy && setOpen(false)}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-slate-900" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="text-center">
            <h3 className="text-lg font-semibold">Thanks, {invite.name.split(" ")[0] || "there"}!</h3>
            <p className="mt-2 text-sm text-slate-600">I&rsquo;ve got your details and will reach out shortly.</p>
            <button onClick={() => setOpen(false)} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3 className="text-lg font-semibold">Get in touch</h3>
            <p className="mt-1 text-sm text-slate-600">Leave your number and I&rsquo;ll reach out about a full setup.</p>
            <label className="mt-4 block text-sm font-medium text-slate-800">
              Phone number
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                placeholder="+91 …"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={busy}
                autoFocus
              />
            </label>
            {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {busy ? "Sending…" : "Submit"}
              </button>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (variant === "sidebar") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Liked this?</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          I can set this up for your brand at full scale — more prompts, more competitors, tracked over time.
        </p>
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-lg bg-emerald-500 px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
        >
          Chat on WhatsApp
        </a>
        <button
          onClick={() => setOpen(true)}
          className="mt-2 block w-full rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Get in touch
        </button>
        {modal}
      </div>
    );
  }

  return (
    <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">Liked this?</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">
        This was a 3-prompt demo. I can set this up for your brand at full scale — as many prompts, competitors, and
        engines as you like, tracked over time. Let&rsquo;s talk.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
        >
          Chat on WhatsApp
        </a>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
        >
          Get in touch
        </button>
      </div>
      {modal}
    </section>
  );
}
