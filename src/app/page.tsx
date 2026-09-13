const INVITE_URL = "https://aashishkarki.com/projects/vision";

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-20">
      <p className="text-xs font-semibold tracking-[0.18em] text-indigo-600 uppercase">Vision</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        See how AI answers describe your brand
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
        Vision asks the questions your prospects ask — to ChatGPT, Gemini, Perplexity, and
        Google&rsquo;s AI Overview &amp; AI Mode — and shows whether you&rsquo;re named, where you
        rank, and who beats you to the answer.
      </p>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">This is an invite-only demo.</p>
        <p className="mt-1.5 text-sm text-slate-600">
          Request access and you&rsquo;ll get a personal link to run a free 3-prompt demo.
        </p>
        <a
          href={INVITE_URL}
          className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Request access
        </a>
      </div>
      <p className="mt-6 text-xs text-slate-400">Built by Aashish Karki.</p>
    </main>
  );
}
