import type { DepartmentRecord } from "@/lib/types";

/** Keyword overlap (original behavior). */
const departmentKeywords: Record<string, string[]> = {
  building: ["building", "permit", "inspection", "inspector", "code", "construction", "contractor", "flooring", "renovation", "remodel", "deck", "fence", "addition", "occupancy", "certificate"],
  planning: ["planning", "zoning", "variance", "land", "development", "site plan", "board approval", "subdivision", "plat", "setback", "rezoning", "land use"],
  "public-works": ["public works", "road", "water", "sewer", "sidewalk", "sanitation", "infrastructure", "street", "pothole", "storm drain"],
  clerk: ["clerk", "records", "public record", "opra", "foil", "license", "minutes", "list", "document", "agenda", "foia"],
  procurement: ["procurement", "purchasing", "vendor", "bid", "rfp", "contract", "supplier"],
  health: ["health", "restaurant", "environmental", "sanitary", "clinic", "food", "public health"],
  education: ["school", "education", "board", "district", "superintendent", "student"],
  finance: ["finance", "treasury", "budget", "accounting", "tax", "fiscal", "revenue", "audit"],
  fire: ["fire", "firefighter", "fire department", "fire prevention", "fire code", "fire inspection", "emergency response"],
  police: ["police", "public safety", "law enforcement", "sheriff", "emergency management", "security"],
  parks: ["parks", "recreation", "park", "open space", "playground", "trails", "sports", "leisure"],
  it: ["it", "technology", "tech", "digital", "software", "data", "systems", "cybersecurity", "network", "gis"],
  legal: ["legal", "attorney", "city attorney", "counsel", "ordinance", "contract", "litigation"],
  hr: ["human resources", "hr", "employment", "hiring", "benefits", "labor", "personnel", "workforce"],
  engineering: ["engineering", "civil", "capital project", "infrastructure design", "survey", "drainage"],
  environment: ["environmental", "sustainability", "recycling", "stormwater", "green", "conservation", "waste"],
  "community-dev": ["community development", "economic development", "housing", "grants", "community programs", "cdbg"],
  assessor: ["assessor", "appraisal", "valuation", "property tax", "mill levy"],
  "city-manager": ["city manager", "town manager", "town administrator", "chief administrative", "administration"],
  housing: ["housing authority", "affordable housing", "section 8", "voucher"],
  "code-enforcement": ["code enforcement", "nuisance", "property maintenance", "zoning violation", "complaint"],
  airport: ["airport", "aviation"],
  utilities: ["municipal utility", "public utility", "electric department", "water department"],
  library: ["library", "librarian"],
  court: ["municipal court", "magistrate"]
};

/** Phrase / token patterns → department (first match wins). */
const INTENT_RULES: { test: RegExp; deptId: string }[] = [
  { test: /\b(subdivid|subdivision|subdivide|lot split|lot line|parcel|platting|replat|boundary line adjustment|easement|setback|rezon|re-zon|variance|special use|conditional use|site plan|land use|master plan|pud|planned unit)\b/i, deptId: "planning" },
  { test: /\b(property line|fence height|home occupation|accessory dwelling|adu)\b/i, deptId: "planning" },
  { test: /\b(building permit|certificate of occupancy|construction permit|demolition permit|electrical permit|plumbing permit|mechanical permit|inspection scheduled|code official)\b/i, deptId: "building" },
  { test: /\b(build|renovat|remodel|addition|deck|shed|garage|foundation|roof|hvac|structur)\b/i, deptId: "building" },
  { test: /\b(opra|foil|foia|public record|records request|minutes|agenda packet)\b/i, deptId: "clerk" },
  { test: /\b(bid|rfp|rfq|vendor registration|procurement|purchase order)\b/i, deptId: "procurement" },
  { test: /\b(food license|restaurant inspection|septic|well permit|pool fence)\b/i, deptId: "health" },
  { test: /\b(school board|enrollment|district office|iep|superintendent)\b/i, deptId: "education" },
  { test: /\b(tax bill|property tax|assessment|appraisal appeal|millage)\b/i, deptId: "assessor" },
  { test: /\b(water main break|sewer backup|pothole|street light|trash pickup|snow removal|leaf pickup)\b/i, deptId: "public-works" },
  { test: /\b(nuisance complaint|tall grass|junk vehicle|property maintenance|code violation)\b/i, deptId: "code-enforcement" },
  { test: /\b(park reservation|field rental|recreation program|athletic)\b/i, deptId: "parks" }
];

function scoreKeywords(normalized: string, departments: DepartmentRecord[]) {
  return departments
    .map((department) => {
      const keywords = departmentKeywords[department.id] ?? [];
      const score = keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
      return { department, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function scoreTokenOverlap(normalized: string, departments: DepartmentRecord[]) {
  const tokens = normalized.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return [] as { department: DepartmentRecord; score: number }[];

  return departments
    .map((department) => {
      const blob = `${department.name} ${department.description}`.toLowerCase();
      const keywords = departmentKeywords[department.id] ?? [];
      let score = 0;
      for (const tok of tokens) {
        if (blob.includes(tok)) score += 2;
        for (const kw of keywords) {
          if (kw.includes(tok) || tok.includes(kw)) score += 1;
        }
      }
      return { department, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Best department for display / routing when user typed an intent (no neutral fallback).
 */
export function inferBestDepartment(departments: DepartmentRecord[], query: string): DepartmentRecord | undefined {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return undefined;

  for (const rule of INTENT_RULES) {
    if (rule.test.test(normalized)) {
      const d = departments.find((x) => x.id === rule.deptId);
      if (d) return d;
    }
  }

  const kw = scoreKeywords(normalized, departments);
  if (kw.length > 0) return kw[0].department;

  const tok = scoreTokenOverlap(normalized, departments);
  if (tok.length > 0) return tok[0].department;

  return undefined;
}

/** Broad web search target when intent did not map to a specific function. */
export function neutralSearchDepartment(departments: DepartmentRecord[]): DepartmentRecord {
  return departments.find((d) => d.id === "city-manager") ?? departments[0];
}
