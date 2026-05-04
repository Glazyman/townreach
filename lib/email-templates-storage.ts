import type { EmailTemplate } from "./types";
import { DEFAULT_EMAIL_TEMPLATES } from "./email-templates-data";

export const EMAIL_TEMPLATES_STORAGE_KEY = "townreach-email-templates";

function isValidTemplateList(x: unknown): x is EmailTemplate[] {
  return (
    Array.isArray(x) &&
    x.length > 0 &&
    x.every(
      (t) =>
        t &&
        typeof (t as EmailTemplate).id === "string" &&
        typeof (t as EmailTemplate).name === "string" &&
        typeof (t as EmailTemplate).subject === "string" &&
        typeof (t as EmailTemplate).body === "string"
    )
  );
}

export function loadStoredEmailTemplates(): EmailTemplate[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(EMAIL_TEMPLATES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidTemplateList(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredEmailTemplates(templates: EmailTemplate[]): void {
  try {
    localStorage.setItem(EMAIL_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    /* ignore quota */
  }
}

export function getDefaultEmailTemplates(): EmailTemplate[] {
  return DEFAULT_EMAIL_TEMPLATES.map((t) => ({ ...t }));
}
