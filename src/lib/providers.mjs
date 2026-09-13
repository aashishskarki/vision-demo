/**
 * One adapter per answer engine. Copied verbatim from the Kraftshala Vision
 * tool — these are the load-bearing, hard-won integrations. Each returns
 * { text, citations: [{ url, title, domain }], fanOut, empty } or throws.
 *
 * Model ids and geo are env-overridable on purpose.
 */

const SYSTEM = null; // No system prompt: we want the default consumer answer.

function snippet(obj) {
  return JSON.stringify(obj).slice(0, 400);
}

function dedupe(citations) {
  const seen = new Set();
  const out = [];
  for (const c of citations) {
    if (!c?.url || seen.has(c.url)) continue;
    seen.add(c.url);
    out.push({ url: c.url, title: c.title ?? null, domain: c.domain ?? null });
  }
  return out;
}

/** Host from a URL, or null. */
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const GOOGLE_REDIRECT_HOST = "vertexaisearch.cloud.google.com";

async function resolveRedirect(url, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal });
    return res.url && hostOf(res.url) !== GOOGLE_REDIRECT_HOST ? res.url : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveAll(citations) {
  if (process.env.RESOLVE_REDIRECTS === "false") return citations;

  return Promise.all(
    citations.map(async (c) => {
      if (hostOf(c.url) !== GOOGLE_REDIRECT_HOST) return c;
      const real = await resolveRedirect(c.url);
      if (!real) return c;
      return { ...c, url: real, domain: hostOf(real) ?? c.domain };
    })
  );
}
// ---------------------------------------------------------------- DataForSEO

const DFS_LOCATION = process.env.DATAFORSEO_LOCATION ?? "United States";

function dfsAuth() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// DataForSEO's 401xx codes are internal/server-side errors (e.g. 40101
// "Internal SE Server Error") that are transient — a fresh call usually
// succeeds. Client errors (405xx) are not retried.
const isTransientDfs = (code) => typeof code === "number" && code >= 40100 && code <= 40199;

async function dfsPost(path, body, attempt = 1) {
  let res;
  let json;
  try {
    res = await fetch(`https://api.dataforseo.com/v3/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: dfsAuth() },
      body: JSON.stringify([body]),
    });
    json = await res.json();
  } catch (e) {
    if (attempt < 2) {
      await sleep(1500);
      return dfsPost(path, body, attempt + 1);
    }
    throw e;
  }

  if (!res.ok) {
    if (res.status >= 500 && attempt < 2) {
      await sleep(1500);
      return dfsPost(path, body, attempt + 1);
    }
    throw new Error(`DataForSEO ${res.status}: ${snippet(json)}`);
  }

  const task = json.tasks?.[0];
  if (task?.status_code && task.status_code >= 40000) {
    if (isTransientDfs(task.status_code) && attempt < 2) {
      await sleep(1500);
      return dfsPost(path, body, attempt + 1);
    }
    throw new Error(`DataForSEO task ${task.status_code}: ${task.status_message}`);
  }
  return task?.result?.[0] ?? null;
}

// ------------------------------------------------- DataForSEO: LLM Responses

const LLM_SURFACES = {
  chatgpt: {
    path: "ai_optimization/chat_gpt/llm_responses/live",
    model: process.env.DFS_CHATGPT_MODEL ?? "gpt-5.4-mini",
    geo: true,
    force: false,
  },
  claude: {
    path: "ai_optimization/claude/llm_responses/live",
    model: process.env.DFS_CLAUDE_MODEL ?? "claude-sonnet-5",
    geo: true,
    force: true,
  },
  perplexity: {
    path: "ai_optimization/perplexity/llm_responses/live",
    model: process.env.DFS_PERPLEXITY_MODEL ?? "sonar",
    geo: true,
    force: false,
  },
};

/** ISO country for web-search grounding. Mirrors DFS_LOCATION. */
const DFS_COUNTRY = process.env.DATAFORSEO_COUNTRY ?? "US";

function parseLlmResponse(result) {
  const answer = [];
  const reasoning = [];
  const citations = [];

  for (const item of result?.items ?? []) {
    for (const section of item?.sections ?? []) {
      const t = typeof section?.text === "string" ? section.text : "";
      if (t) (section.type === "text" ? answer : reasoning).push(t);
      for (const a of section?.annotations ?? []) {
        if (a?.url) citations.push({ url: a.url, title: a.title ?? null, domain: hostOf(a.url) });
      }
    }
  }

  const text = (answer.length ? answer : reasoning).join("\n\n").trim();
  const fanOut = Array.isArray(result?.fan_out_queries)
    ? result.fan_out_queries.filter((q) => typeof q === "string" && q.trim()).map((q) => q.trim())
    : [];

  return { text, citations, fanOut };
}

function askLlm(surfaceId) {
  const cfg = LLM_SURFACES[surfaceId];

  return async function ask(prompt) {
    const body = {
      user_prompt: prompt,
      model_name: cfg.model,
      web_search: true,
      max_output_tokens: Number(process.env.DFS_MAX_TOKENS ?? 2048),
    };
    if (cfg.force) body.force_web_search = true;
    if (cfg.geo) body.web_search_country_iso_code = DFS_COUNTRY;

    const result = await dfsPost(cfg.path, body);
    const { text, citations, fanOut } = parseLlmResponse(result);

    if (!text) {
      return {
        text: `(no answer returned by ${surfaceId})`,
        citations: [],
        fanOut,
        empty: true,
      };
    }

    return { text, citations: await resolveAll(dedupe(citations)), fanOut };
  };
}

export const askChatGPT = askLlm("chatgpt");
export const askClaude = askLlm("claude");
export const askPerplexity = askLlm("perplexity");

// ---------------------------------------------------------------- Gemini

export async function askGemini(prompt) {
  const model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    }
  );

  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${snippet(json)}`);

  const candidate = json.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  const citations = [];
  for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
    const web = chunk?.web;
    if (!web?.uri) continue;
    const host = hostOf(web.uri);
    const isRedirect = host === GOOGLE_REDIRECT_HOST;
    citations.push({
      url: web.uri,
      title: web.title,
      domain: web.domain ?? (isRedirect ? web.title : host),
    });
  }

  if (!text) throw new Error(`Gemini returned no text: ${snippet(json)}`);
  return { text, citations: dedupe(await resolveAll(citations)), fanOut: [] };
}

function parseAiElement(items, wanted) {
  for (const item of items ?? []) {
    if (wanted && item?.type !== wanted) continue;

    const citations = [];
    for (const ref of item.references ?? []) {
      if (ref?.url) {
        citations.push({
          url: ref.url,
          title: ref.title ?? ref.source ?? null,
          domain: hostOf(ref.url) ?? ref.domain?.replace(/^www\./, "") ?? null,
        });
      }
    }

    let text = typeof item.markdown === "string" ? item.markdown.trim() : "";

    if (!text) {
      const parts = [];
      const walk = (node) => {
        if (!node || typeof node !== "object") return;
        if (typeof node.text === "string" && node.text.trim()) parts.push(node.text.trim());
        for (const child of node.items ?? []) walk(child);
      };
      walk(item);
      text = parts.join("\n\n");
    }

    for (const m of text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
      citations.push({ url: m[1], title: null, domain: hostOf(m[1]) });
    }

    if (text || citations.length) return { text, citations };
  }
  return null;
}

export async function askAiOverview(prompt) {
  const result = await dfsPost("serp/google/organic/live/advanced", {
    keyword: prompt,
    location_name: DFS_LOCATION,
    language_code: "en",
    device: "desktop",
    load_async_ai_overview: true,
  });

  const found = parseAiElement(result?.items, "ai_overview");
  if (!found) {
    return { text: "(no AI Overview shown for this query)", citations: [], empty: true };
  }
  return { text: found.text, citations: dedupe(found.citations) };
}

export async function askAiMode(prompt) {
  const result = await dfsPost("serp/google/ai_mode/live/advanced", {
    keyword: prompt,
    location_name: DFS_LOCATION,
    language_code: "en",
    device: "desktop",
  });

  const found = parseAiElement(result?.items, null);
  if (!found) {
    return { text: "(no AI Mode answer returned for this query)", citations: [], empty: true };
  }
  return { text: found.text, citations: dedupe(found.citations) };
}

// ---------------------------------------------------------------- registry

/**
 * All six surfaces. Five route through DataForSEO (one credential:
 * DATAFORSEO_LOGIN/PASSWORD); Gemini uses Google's own API (GEMINI_API_KEY).
 */
export const PROVIDERS = {
  chatgpt: { label: "ChatGPT", fn: askChatGPT, key: "DATAFORSEO_LOGIN" },
  claude: { label: "Claude", fn: askClaude, key: "DATAFORSEO_LOGIN" },
  gemini: { label: "Gemini", fn: askGemini, key: "GEMINI_API_KEY" },
  perplexity: { label: "Perplexity", fn: askPerplexity, key: "DATAFORSEO_LOGIN" },
  google_ai_overviews: { label: "Google AI Overview", fn: askAiOverview, key: "DATAFORSEO_LOGIN" },
  google_ai_mode: { label: "Google AI Mode", fn: askAiMode, key: "DATAFORSEO_LOGIN" },
};

export { SYSTEM };
