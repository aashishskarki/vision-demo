/**
 * Trimmed extractor for the demo.
 *
 * The Kraftshala tool extracts tier, verdict, sentiment and attributes. The
 * demo needs only what share-of-voice requires: which brands the answer named
 * and in what order. That keeps each run cheap (one small Haiku call per
 * answer) and fast.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const SYSTEM = `You analyse one answer produced by an AI search engine, to measure how brands share the conversation.

List every distinct brand, company, product or named programme the answer NAMES as something a person could actually choose, enrol in, or use — in the order the answer ranks them.

- ordinal_position: the brand's rank among ALL brands the answer names (1 = top pick). A numbered or bulleted list is the ranking. Where the answer names a single top pick in prose and lists alternatives below, the prose pick is 1. Use null only when a brand is named but the answer implies no ordering at all.
- Record only real, nameable options. Do NOT record generic categories ("an MBA", "a data analytics course", "top universities", "a CRM tool").

Report what the answer says, not what is true. If the answer names no brands, return an empty list.`;

const schema = z.object({
  brands: z.array(
    z.object({
      name: z.string().describe("exact brand/company/product name as written"),
      ordinal_position: z.number().int().nullable(),
    })
  ),
});

export function makeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

/** Loose normaliser for own/competitor matching. */
function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.(com|in|io|co|org|net|ai)(\/.*)?$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Decides whether a named brand is the visitor's own, a listed competitor, or
 * an untracked brand. Substring-based, which is deliberately generous: "Kraft"
 * vs "Kraftshala" should still match a two-word brand a model abbreviated.
 */
export function classifyBrand(name, ownBrand, competitors) {
  const n = norm(name);
  if (!n) return { is_own: false, tracked: false };

  const own = norm(ownBrand);
  if (own && (n === own || n.includes(own) || own.includes(n))) {
    return { is_own: true, tracked: true };
  }
  for (const c of competitors ?? []) {
    const cn = norm(c);
    if (cn && (n === cn || n.includes(cn) || cn.includes(n))) {
      return { is_own: false, tracked: true };
    }
  }
  return { is_own: false, tracked: false };
}

/** Runs one answer through Haiku. Returns [{ name, ordinal_position }]. Throws on failure. */
export async function extractDemo({ client, model, prompt, answer }) {
  const res = await client.messages.parse({
    model,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `The user asked: "${prompt}"\n\nThe answer given:\n---\n${answer}\n---`,
      },
    ],
    output_config: { format: zodOutputFormat(schema) },
  });

  if (!res.parsed_output) throw new Error("model returned no parsable output");
  return res.parsed_output.brands ?? [];
}
