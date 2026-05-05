/**
 * Optional OpenAI pass: chooses which discovered rows matter for the user's intent.
 * Emails and names always come from the candidate list—we never surface model-invented addresses.
 */

export type ContactGuideRow = {
  /** Index into the candidate array served to the model (0-based). */
  index: number;
  label: string;
  name: string;
  email: string;
  phone: string;
};

export type ContactAssistantBrief = {
  startHere: ContactGuideRow | null;
  alsoTry: ContactGuideRow[];
  /** Short process context (Planning Board vs ZBA, etc.). May omit facts not in the list. */
  processNote: string;
};

export type CandidateForAssistant = {
  index: number;
  name: string;
  title: string;
  email: string;
  phone: string;
  snippet: string;
};

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

type RawPick = { index?: unknown; label?: unknown };
type RawResponse = {
  startHere?: RawPick | null;
  alsoTry?: unknown;
  processNote?: unknown;
};

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function normalizeLabel(s: string, max = 140): string {
  return s.trim().slice(0, max);
}

/**
 * Calls OpenAI; returns picks validated against candidates (indices + copied contact fields).
 */
export async function buildContactAssistantBrief(
  candidates: {
    name: string;
    title: string;
    email: string;
    phone: string;
    snippet: string;
    pageTitle: string;
  }[],
  context: {
    municipality: string;
    state: string;
    department: string;
    intent?: string;
  }
): Promise<ContactAssistantBrief | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || candidates.length === 0) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const maxRows = Math.min(candidates.length, 14);
  const rows: CandidateForAssistant[] = candidates.slice(0, maxRows).map((c, i) => ({
    index: i,
    name: c.name.trim(),
    title: c.title.trim(),
    email: c.email.trim().toLowerCase(),
    phone: c.phone.trim(),
    snippet: truncate(`${c.pageTitle} — ${c.snippet}`, 400)
  }));

  const system = `You help users reach the right municipal contact for their topic.
You MUST output a single JSON object only. Never invent emails, phone numbers, or names.
Reference people ONLY by their "index" from the candidates array. Indices are 0..${rows.length - 1}.

Choosing rows:
- For subdivision, site plan, lot split, zoning: prefer a departmental/shared inbox (e.g. bpz@, planning@, zoning@, permits@, building@, clerk@) for "startHere" when reasonable.
- Pick individual staff emails as secondary "alsoTry" when they look like zoning/planning reviewers.
- "processNote": 2-4 sentences of neutral process guidance (Planning Board handles many subdivision applications; ZBA only if dimensional relief is needed, etc.). Do NOT state addresses, phone numbers, or emails in processNote—they will be omitted if you do—but you may describe roles.

JSON schema:
{
  "startHere": null | { "index": number, "label": string },
  "alsoTry": [{ "index": number, "label": string }],
  "processNote": string
}`;

  const user = JSON.stringify({
    place: { municipality: context.municipality, state: context.state },
    department: context.department,
    userIntent: context.intent ?? "",
    candidates: rows
  });

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      }),
      signal: AbortSignal.timeout(22_000)
    });
    if (!res.ok) return null;
    const data: { choices?: { message?: { content?: string } }[] } = await res.json();
    const rawText = data.choices?.[0]?.message?.content?.trim();
    if (!rawText) return null;
    let parsed: RawResponse;
    try {
      parsed = JSON.parse(rawText) as RawResponse;
    } catch {
      return null;
    }

    const n = rows.length;
    function rowFromPick(pick: RawPick | null | undefined): ContactGuideRow | null {
      if (!pick || typeof pick.index !== "number") return null;
      const idx = Math.floor(pick.index);
      if (idx < 0 || idx >= n || !Number.isFinite(idx)) return null;
      if (!isNonEmptyString(pick.label)) return null;
      const base = candidates[idx];
      if (!base?.email) return null;
      return {
        index: idx,
        label: normalizeLabel(pick.label),
        name: base.name.trim(),
        email: base.email.trim(),
        phone: base.phone.trim()
      };
    }

    let startHere = rowFromPick(parsed.startHere ?? null);
    const used = new Set<number>();
    if (startHere) used.add(startHere.index);

    const alsoTryRaw = Array.isArray(parsed.alsoTry) ? parsed.alsoTry : [];
    const alsoTry: ContactGuideRow[] = [];
    for (const item of alsoTryRaw) {
      const pick = item as RawPick;
      const row = rowFromPick(pick);
      if (!row || used.has(row.index)) continue;
      used.add(row.index);
      alsoTry.push(row);
      if (alsoTry.length >= 8) break;
    }

    const processNote = isNonEmptyString(parsed.processNote) ? normalizeLabel(String(parsed.processNote), 900) : "";

    /** Strip stray contact-like lines from note (belt and suspenders). */
    const cleanedNote = processNote
      .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email in list above]")
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[phone in list above]");

    return { startHere, alsoTry, processNote: cleanedNote };
  } catch {
    return null;
  }
}
