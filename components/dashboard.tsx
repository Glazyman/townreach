"use client";

import {
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  Gauge,
  HelpCircle,
  History,
  Inbox,
  Lightbulb,
  Mail,
  Map,
  Menu,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CoverageMap = dynamic(
  () => import("@/components/coverage-map").then((m) => m.CoverageMap),
  { ssr: false }
);
import { tokenReplace } from "@/lib/data";
import { getDefaultEmailTemplates, loadStoredEmailTemplates, saveStoredEmailTemplates } from "@/lib/email-templates-storage";
import type {
  ContactRecord,
  CountyRecord,
  DashboardData,
  DepartmentRecord,
  EmailTemplate,
  MunicipalityRecord,
  OutreachThread
} from "@/lib/types";

type DashboardProps = { data: DashboardData };
type SendState = "idle" | "sending" | "sent" | "error";
type ActivePanel = "dashboard" | "contacts" | "email-tracker" | "settings";
type EmailConnectionSettings = {
  gmailConnected: boolean;
  outlookConnected: boolean;
  senderName: string;
  senderCompany: string;
  senderEmail: string;
};
type WebSearchCandidate = {
  name: string;
  title: string;
  email: string;
  allEmails?: string[];
  phone: string;
  allPhones?: string[];
  sourceUrl: string;
  snippet: string;
  pageTitle: string;
  confidence: number;
};

type PastSearchEntry = {
  id: string;
  at: string;
  stateId: string;
  stateName: string;
  countyId: string;
  countyName: string;
  municipalityId: string;
  municipalityName: string;
  departmentId: string;
  departmentName: string;
  candidates: WebSearchCandidate[];
  error?: string;
  note?: string;
};

const PAST_SEARCHES_STORAGE_KEY = "townreach-past-searches";
const MAX_PAST_SEARCHES = 50;
const EMAIL_SETTINGS_STORAGE_KEY = "townreach-email-settings";
/** Department dropdown: user needs help picking a function — search uses recommended match from intent text. */
const DEPARTMENT_NOT_SURE = "not-sure";

const sender = { companyName: "Northstar Flooring", senderName: "Alex Rivers" };
const defaultEmailSettings: EmailConnectionSettings = {
  gmailConnected: false,
  outlookConnected: false,
  senderName: sender.senderName,
  senderCompany: sender.companyName,
  senderEmail: ""
};

const departmentKeywords: Record<string, string[]> = {
  building: ["building", "permit", "inspection", "inspector", "code", "construction", "contractor", "flooring", "renovation"],
  planning: ["planning", "zoning", "variance", "land", "development", "site plan", "board approval"],
  "public-works": ["public works", "road", "water", "sewer", "sidewalk", "sanitation", "infrastructure", "street"],
  clerk: ["clerk", "records", "public record", "opra", "license", "minutes", "list", "document"],
  procurement: ["procurement", "purchasing", "vendor", "bid", "rfp", "contract", "supplier"],
  health: ["health", "restaurant", "environmental", "sanitary", "clinic", "food", "public health"],
  education: ["school", "education", "board", "district", "superintendent", "student"],
  finance: ["finance", "treasury", "budget", "accounting", "tax", "fiscal", "revenue", "audit"],
  fire: ["fire", "firefighter", "fire department", "fire prevention", "fire code", "fire inspection", "emergency response"],
  police: ["police", "public safety", "law enforcement", "sheriff", "emergency management", "security"],
  parks: ["parks", "recreation", "park", "open space", "playground", "trails", "sports", "leisure"],
  it: ["it", "technology", "tech", "digital", "software", "data", "systems", "cybersecurity", "network"],
  legal: ["legal", "attorney", "city attorney", "counsel", "ordinance", "contract", "litigation"],
  hr: ["human resources", "hr", "employment", "hiring", "benefits", "labor", "personnel", "workforce"],
  engineering: ["engineering", "civil", "capital project", "infrastructure design", "survey", "drainage"],
  environment: ["environmental", "sustainability", "recycling", "stormwater", "green", "conservation", "waste"],
  "community-dev": ["community development", "economic development", "housing", "grants", "community programs", "cdbg"],
  assessor: ["assessor", "appraisal", "valuation", "property tax", "mill levy"],
  "city-manager": ["city manager", "town manager", "town administrator", "chief administrative"],
  housing: ["housing authority", "affordable housing", "section 8", "voucher"],
  "code-enforcement": ["code enforcement", "nuisance", "property maintenance", "zoning violation"],
  airport: ["airport", "aviation"],
  utilities: ["municipal utility", "public utility", "electric department", "water department"],
  library: ["library", "librarian"],
  court: ["municipal court", "magistrate"]
};

function recommendDepartment(departments: DepartmentRecord[], query: string) {
  const normalized = query.toLowerCase();
  if (!normalized.trim()) return undefined;
  const scored = departments
    .map((department) => {
      const keywords = departmentKeywords[department.id] ?? [];
      const score = keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
      return { department, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.department;
}

export function Dashboard({ data }: DashboardProps) {
  const [stateId, setStateId] = useState("");
  const [countyId, setCountyId] = useState("");
  const [municipalityId, setMunicipalityId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [countiesRemote, setCountiesRemote] = useState<CountyRecord[]>([]);
  const [municipalitiesRemote, setMunicipalitiesRemote] = useState<MunicipalityRecord[]>([]);
  const [countiesLoading, setCountiesLoading] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [geographyError, setGeographyError] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);
  const [composerMunicipality, setComposerMunicipality] = useState<MunicipalityRecord | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [threads, setThreads] = useState<OutreachThread[]>(data.threads);
  const [intentQuery, setIntentQuery] = useState("");
  const intentInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activePanel, setActivePanel] = useState<ActivePanel>("dashboard");
  const [sparkleMessage, setSparkleMessage] = useState("");
  const [searchResults, setSearchResults] = useState<WebSearchCandidate[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pastSearches, setPastSearches] = useState<PastSearchEntry[]>([]);
  const [pastSearchesHydrated, setPastSearchesHydrated] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailConnectionSettings>(defaultEmailSettings);
  const [emailSettingsHydrated, setEmailSettingsHydrated] = useState(false);
  const [emailTemplatesList, setEmailTemplatesList] = useState<EmailTemplate[]>(() => getDefaultEmailTemplates());
  const [emailTemplatesHydrated, setEmailTemplatesHydrated] = useState(false);

  useEffect(() => {
    const stored = loadStoredEmailTemplates();
    if (stored) setEmailTemplatesList(stored);
    setEmailTemplatesHydrated(true);
  }, []);

  useEffect(() => {
    if (!emailTemplatesHydrated) return;
    saveStoredEmailTemplates(emailTemplatesList);
  }, [emailTemplatesList, emailTemplatesHydrated]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PAST_SEARCHES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PastSearchEntry[];
        if (Array.isArray(parsed)) setPastSearches(parsed.slice(0, MAX_PAST_SEARCHES));
      }
    } catch {
      /* ignore */
    }
    setPastSearchesHydrated(true);
  }, []);

  useEffect(() => {
    if (!pastSearchesHydrated) return;
    try {
      localStorage.setItem(PAST_SEARCHES_STORAGE_KEY, JSON.stringify(pastSearches.slice(0, MAX_PAST_SEARCHES)));
    } catch {
      /* ignore */
    }
  }, [pastSearches, pastSearchesHydrated]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EMAIL_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<EmailConnectionSettings>;
        setEmailSettings((prev) => ({
          ...prev,
          // Gmail connection comes from the server cookie, not localStorage (avoids stale false).
          outlookConnected: Boolean(parsed.outlookConnected),
          senderName: parsed.senderName?.trim() || defaultEmailSettings.senderName,
          senderCompany: parsed.senderCompany?.trim() || defaultEmailSettings.senderCompany,
          senderEmail: parsed.senderEmail?.trim() || ""
        }));
      }
    } catch {
      /* ignore */
    }
    setEmailSettingsHydrated(true);
  }, []);

  useEffect(() => {
    if (!emailSettingsHydrated) return;
    try {
      localStorage.setItem(EMAIL_SETTINGS_STORAGE_KEY, JSON.stringify(emailSettings));
    } catch {
      /* ignore */
    }
  }, [emailSettings, emailSettingsHydrated]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const gmailConnected = url.searchParams.get("gmail_connected");
    if (gmailConnected === "1") {
      setEmailSettings((prev) => ({ ...prev, gmailConnected: true }));
      url.searchParams.delete("gmail_connected");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      setActivePanel("settings");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/gmail/status")
      .then(async (res) => {
        const json = (await res.json()) as { connected?: boolean };
        return Boolean(json.connected);
      })
      .then((connected) => {
        if (cancelled) return;
        setEmailSettings((prev) => ({ ...prev, gmailConnected: connected }));
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!stateId) {
      setCountiesRemote([]);
      setGeographyError("");
      return;
    }
    let cancelled = false;
    setCountiesLoading(true);
    setGeographyError("");
    fetch(`/api/geography/counties?state=${encodeURIComponent(stateId)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load counties");
        return json.counties as CountyRecord[];
      })
      .then((rows) => {
        if (!cancelled) setCountiesRemote(rows ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setCountiesRemote([]);
          setGeographyError(e instanceof Error ? e.message : "Failed to load counties");
        }
      })
      .finally(() => {
        if (!cancelled) setCountiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stateId]);

  useEffect(() => {
    if (!stateId || !countyId) {
      setMunicipalitiesRemote([]);
      return;
    }
    let cancelled = false;
    setPlacesLoading(true);
    fetch(`/api/geography/places?state=${encodeURIComponent(stateId)}&county=${encodeURIComponent(countyId)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load places");
        return json.places as MunicipalityRecord[];
      })
      .then((rows) => {
        if (!cancelled) setMunicipalitiesRemote(rows ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setMunicipalitiesRemote([]);
          setGeographyError((prev) => prev || "Failed to load towns for this county.");
        }
      })
      .finally(() => {
        if (!cancelled) setPlacesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stateId, countyId]);

  useEffect(() => {
    if (placesLoading) return;
    if (!municipalityId) return;
    if (!municipalitiesRemote.some((m) => m.id === municipalityId)) setMunicipalityId("");
  }, [placesLoading, municipalitiesRemote, municipalityId]);

  const filteredCounties = useMemo(
    () => countiesRemote.filter((c) => c.stateId === stateId).sort((a, b) => a.name.localeCompare(b.name)),
    [countiesRemote, stateId]
  );

  const filteredMunicipalities = useMemo(
    () => municipalitiesRemote.filter((m) => m.stateId === stateId && m.countyId === countyId).sort((a, b) => a.name.localeCompare(b.name)),
    [countyId, municipalitiesRemote, stateId]
  );

  const selectedMunicipality = filteredMunicipalities.find((m) => m.id === municipalityId);
  const selectedDepartment = departmentId === DEPARTMENT_NOT_SURE ? undefined : data.departments.find((d) => d.id === departmentId);

  const recommendedDepartment = useMemo(
    () => recommendDepartment(data.departments, intentQuery),
    [intentQuery, data.departments]
  );

  const effectiveDepartment = departmentId === DEPARTMENT_NOT_SURE ? recommendedDepartment : selectedDepartment;

  const readyForLookup = Boolean(
    stateId && countyId && municipalityId && effectiveDepartment
  );

  const filteredSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return searchResults;
    return searchResults.filter((r) => {
      const blob = `${r.name} ${r.email} ${r.pageTitle} ${r.snippet} ${r.sourceUrl}`.toLowerCase();
      return blob.includes(q);
    });
  }, [searchQuery, searchResults]);

  function handleStateChange(value: string) {
    setStateId(value);
    setCountyId("");
    setMunicipalityId("");
    setDepartmentId("");
    setSelectedContact(null);
    setSearchResults([]);
    setSearchError("");
  }
  function handleCountyChange(value: string) {
    setCountyId(value);
    setMunicipalityId("");
    setDepartmentId("");
    setSelectedContact(null);
    setSearchResults([]);
    setSearchError("");
  }
  function handleMunicipalityChange(value: string) {
    setMunicipalityId(value);
    setDepartmentId("");
    setSelectedContact(null);
    setSearchResults([]);
    setSearchError("");
  }

  function handleDepartmentChange(v: string) {
    setDepartmentId(v);
    setSelectedContact(null);
    setSearchResults([]);
    setSearchError("");
    if (v === DEPARTMENT_NOT_SURE) {
      setTimeout(() => {
        document.getElementById("department-finder")?.scrollIntoView({ behavior: "smooth", block: "center" });
        intentInputRef.current?.focus();
      }, 80);
    }
  }

  function openComposer(contact: ContactRecord, municipalityHint?: MunicipalityRecord) {
    setSelectedContact(contact);
    const resolved =
      municipalityHint ??
      filteredMunicipalities.find((m) => m.id === contact.municipalityId) ??
      data.municipalities.find((m) => m.id === contact.municipalityId);
    setComposerMunicipality(
      resolved ?? {
        id: contact.municipalityId,
        countyId: countyId || "",
        stateId: stateId || "",
        name: selectedMunicipality?.id === contact.municipalityId ? selectedMunicipality.name : "Selected municipality",
        kind: "city",
        placeFips: ""
      }
    );
    setDrawerOpen(true);
  }

  const closeComposer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  async function handleSparkle() {
    if (readyForLookup && selectedMunicipality && effectiveDepartment) {
      setSearchLoading(true);
      setSearchResults([]);
      setSearchError("");
      const state = data.states.find((s) => s.id === stateId);
      const countyName = filteredCounties.find((c) => c.id === countyId)?.name ?? countyId;
      const newId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ps-${Date.now()}`;
      const entryBase: Omit<PastSearchEntry, "candidates" | "error" | "note"> = {
        id: newId,
        at: new Date().toISOString(),
        stateId,
        stateName: state?.name ?? stateId,
        countyId,
        countyName,
        municipalityId,
        municipalityName: selectedMunicipality.name,
        departmentId: effectiveDepartment.id,
        departmentName: effectiveDepartment.name
      };
      function pushPast(entry: PastSearchEntry) {
        setPastSearches((prev) => [entry, ...prev].slice(0, MAX_PAST_SEARCHES));
      }
      try {
        const params = new URLSearchParams({
          municipality: selectedMunicipality.name,
          state: state?.name ?? stateId,
          department: effectiveDepartment.name
        });
        const res = await fetch(`/api/contacts/search?${params}`);
        const json = await res.json();
        if (!res.ok) {
          const msg = typeof json.error === "string" ? json.error : "Search failed";
          pushPast({ ...entryBase, candidates: [], error: msg });
          throw new Error(msg);
        }
        const candidates = (json.candidates ?? []) as WebSearchCandidate[];
        setSearchResults(candidates);
        const emptyNote =
          candidates.length === 0
            ? "No public results with a verifiable email were returned for this place and department."
            : undefined;
        if (candidates.length === 0) {
          setSearchError(
            "No public results with a verifiable email were returned for this place and department. Try another department, a larger nearby place, or check Serper / network configuration."
          );
        }
        pushPast({ ...entryBase, candidates, note: emptyNote });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Search failed";
        setSearchError(msg);
        setPastSearches((prev) => {
          if (prev.some((e) => e.id === entryBase.id)) return prev;
          return [{ ...entryBase, candidates: [], error: msg }, ...prev].slice(0, MAX_PAST_SEARCHES);
        });
      } finally {
        setSearchLoading(false);
      }
      return;
    }
    setSparkleMessage("Select state, county, and town. Pick a department or choose “Not sure” and describe what you need until a department is suggested, then run search.");
    setTimeout(() => setSparkleMessage(""), 4500);
  }

  const navItems: { icon: React.ElementType; label: string; panel: ActivePanel }[] = [
    { icon: Gauge, label: "Dashboard", panel: "dashboard" },
    { icon: Building2, label: "Contact Finder", panel: "contacts" },
    { icon: Mail, label: "Email Tracker", panel: "email-tracker" },
    { icon: Settings, label: "Admin Settings", panel: "settings" }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef4ff_0,_transparent_28rem),#faf9fe] text-slate-950">
      <MobileNavSheet
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        items={navItems}
        activePanel={activePanel}
        onNavChange={setActivePanel}
      />
      <SideNav items={navItems} activePanel={activePanel} onNavChange={setActivePanel} />
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onMenuClick={() => setMobileNavOpen(true)}
        userName={emailSettings.senderName || sender.senderName}
        companyName={emailSettings.senderCompany || sender.companyName}
      />
      <main className="min-h-screen px-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))] sm:px-4 md:ml-64 md:px-6">
        <section className="mx-auto max-w-[1400px]">
          <div className="mb-4">
            <h1 className="font-display text-xl font-bold text-slate-950 sm:text-2xl">Municipal Outreach</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Geography from the U.S. Census Bureau (all county-equivalents per state; towns are incorporated places and CDPs intersecting the county). Contacts come from live public web search—no sample directory.
            </p>
          </div>

          {(activePanel === "dashboard" || activePanel === "contacts") && (
            <>
              <FilterBar
                id="contact-filters"
                data={data}
                stateId={stateId}
                countyId={countyId}
                municipalityId={municipalityId}
                departmentId={departmentId}
                counties={filteredCounties}
                municipalities={filteredMunicipalities}
                countiesLoading={countiesLoading}
                placesLoading={placesLoading}
                onStateChange={handleStateChange}
                onCountyChange={handleCountyChange}
                onMunicipalityChange={handleMunicipalityChange}
                onDepartmentChange={handleDepartmentChange}
                onSparkle={handleSparkle}
                searching={searchLoading}
                searchDisabled={!readyForLookup}
              />
              {geographyError && (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{geographyError}</p>
              )}
              {sparkleMessage && (
                <p className="mt-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-medium text-primary">{sparkleMessage}</p>
              )}
              {(searchLoading || filteredSearchResults.length > 0 || searchError) && (
                <WebSearchResults
                  loading={searchLoading}
                  results={filteredSearchResults}
                  error={searchError}
                  municipality={selectedMunicipality}
                  department={effectiveDepartment}
                  onEmail={(candidate, selectedEmail) => {
                    const dept = effectiveDepartment;
                    if (!dept || !selectedMunicipality) return;
                    const contact: ContactRecord = {
                      id: `web-${Date.now()}`,
                      municipalityId: municipalityId,
                      departmentId: dept.id,
                      name: candidate.name || candidate.pageTitle,
                      title: candidate.title,
                      email: selectedEmail,
                      phone: candidate.phone,
                      sourceUrl: candidate.sourceUrl,
                      confidence: candidate.confidence,
                      verified: false,
                      lastChecked: new Date().toISOString().split("T")[0]
                    };
                    openComposer(contact, selectedMunicipality);
                  }}
                />
              )}
            </>
          )}

          <div className="mt-4 grid grid-cols-12 gap-3 sm:gap-4">
            {(activePanel === "dashboard" || activePanel === "contacts") && (
              <IntentAssistant
                id="department-finder"
                data={data}
                intentQuery={intentQuery}
                onIntentChange={setIntentQuery}
                intentInputRef={intentInputRef}
                stateId={stateId}
                countyId={countyId}
                municipalityId={municipalityId}
                counties={filteredCounties}
                municipalities={filteredMunicipalities}
                countiesLoading={countiesLoading}
                placesLoading={placesLoading}
                onStateChange={handleStateChange}
                onCountyChange={handleCountyChange}
                onMunicipalityChange={handleMunicipalityChange}
                department={recommendedDepartment}
                departmentModeNotSure={departmentId === DEPARTMENT_NOT_SURE}
                municipality={selectedMunicipality}
                onUseDepartment={(id) => { setDepartmentId(id); setSelectedContact(null); setSearchResults([]); }}
              />
            )}

            {(activePanel === "dashboard") && (
              <>
                <PastSearchesPanel
                  searches={pastSearches}
                  onEmailFromHistory={(candidate, entry, selectedEmail) => {
                    setStateId(entry.stateId);
                    setCountyId(entry.countyId);
                    setMunicipalityId(entry.municipalityId);
                    setDepartmentId(entry.departmentId);
                    setSearchResults(entry.candidates);
                    setSearchError("");
                    const contact: ContactRecord = {
                      id: `web-${Date.now()}`,
                      municipalityId: entry.municipalityId,
                      departmentId: entry.departmentId,
                      name: candidate.name || candidate.pageTitle,
                      title: candidate.title,
                      email: selectedEmail,
                      phone: candidate.phone,
                      sourceUrl: candidate.sourceUrl,
                      confidence: candidate.confidence,
                      verified: false,
                      lastChecked: new Date().toISOString().split("T")[0]
                    };
                    const hint: MunicipalityRecord = {
                      id: entry.municipalityId,
                      countyId: entry.countyId,
                      stateId: entry.stateId,
                      name: entry.municipalityName,
                      kind: "city",
                      placeFips: ""
                    };
                    openComposer(contact, hint);
                  }}
                />
                <InboxPanel threads={threads} contacts={data.contacts} onThreadsUpdate={setThreads} />
              </>
            )}

            {activePanel === "dashboard" && (
              <MapPanel
                stateId={stateId}
                countyId={countyId}
                municipalityId={municipalityId}
                selectedMunicipality={selectedMunicipality}
                selectedDepartment={effectiveDepartment}
              />
            )}

            {activePanel === "settings" && (
              <section className="col-span-12 rounded-2xl border border-white bg-white p-6 shadow-soft sm:p-8">
                <h3 className="font-display text-2xl font-semibold">Admin Settings</h3>
                <p className="mt-3 text-sm text-slate-500">Connect inbox providers and set sender identity for outreach.</p>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => window.location.assign("/connect/gmail")}
                    className={`rounded-xl border px-4 py-4 text-left transition ${
                      emailSettings.gmailConnected
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900">Gmail</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {emailSettings.gmailConnected ? "Connected" : "Not connected - click to connect"}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailSettings((prev) => ({ ...prev, outlookConnected: !prev.outlookConnected }))}
                    className={`rounded-xl border px-4 py-4 text-left transition ${
                      emailSettings.outlookConnected
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900">Outlook</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {emailSettings.outlookConnected ? "Connected (simulated OAuth)" : "Not connected"}
                    </p>
                  </button>
                </div>
                <div className="mt-3 flex justify-start">
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/auth/gmail/disconnect", { method: "POST" });
                      setEmailSettings((prev) => ({ ...prev, gmailConnected: false }));
                    }}
                    disabled={!emailSettings.gmailConnected}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
                  >
                    Disconnect Gmail
                  </button>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Sender name</span>
                    <input
                      value={emailSettings.senderName}
                      onChange={(e) => setEmailSettings((prev) => ({ ...prev, senderName: e.target.value }))}
                      className="focus-ring mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      placeholder="Alex Rivers"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Company</span>
                    <input
                      value={emailSettings.senderCompany}
                      onChange={(e) => setEmailSettings((prev) => ({ ...prev, senderCompany: e.target.value }))}
                      className="focus-ring mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      placeholder="Northstar Flooring"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Reply-to email</span>
                    <input
                      type="email"
                      value={emailSettings.senderEmail}
                      onChange={(e) => setEmailSettings((prev) => ({ ...prev, senderEmail: e.target.value }))}
                      className="focus-ring mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      placeholder="alex@northstar.com"
                    />
                  </label>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Current status:{" "}
                  <span className="font-semibold text-slate-700">
                    {emailSettings.gmailConnected || emailSettings.outlookConnected ? "At least one provider connected" : "No providers connected"}
                  </span>
                </p>
                <EmailTemplatesPanel templates={emailTemplatesList} onChange={setEmailTemplatesList} />
              </section>
            )}

            {activePanel === "email-tracker" && (
              <EmailTrackerPanel
                threads={threads}
                contacts={data.contacts}
                municipalities={data.municipalities}
                departments={data.departments}
                onThreadsUpdate={setThreads}
                canSync={emailSettings.gmailConnected || emailSettings.outlookConnected}
              />
            )}
          </div>
        </section>
      </main>

      <ComposerDrawer
        open={drawerOpen}
        contact={selectedContact}
        municipality={composerMunicipality}
        department={selectedContact ? data.departments.find((d) => d.id === selectedContact.departmentId) : undefined}
        emailSettings={emailSettings}
        onClose={closeComposer}
        onOpenEmailSettings={() => {
          setDrawerOpen(false);
          setMobileNavOpen(false);
          setActivePanel("settings");
        }}
        templates={emailTemplatesList}
        onThreadCreated={(thread) => setThreads((current) => [thread, ...current])}
      />
    </div>
  );
}

function EmailTemplatesPanel({
  templates,
  onChange
}: {
  templates: EmailTemplate[];
  onChange: (next: EmailTemplate[]) => void;
}) {
  function updateAt(index: number, patch: Partial<EmailTemplate>) {
    onChange(templates.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function removeAt(index: number) {
    if (templates.length <= 1) return;
    onChange(templates.filter((_, i) => i !== index));
  }

  function addTemplate() {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `custom-${Date.now()}`;
    onChange([
      ...templates,
      {
        id,
        name: "New template",
        subject: "Regarding {{municipality}}",
        body: "Hi {{contactName}},\n\n\n\nThank you,\n{{senderName}}"
      }
    ]);
  }

  function resetDefaults() {
    if (
      !window.confirm(
        "Replace all templates with TownReach defaults? Custom templates you added or edited here will be lost."
      )
    ) {
      return;
    }
    onChange(getDefaultEmailTemplates());
  }

  return (
    <div className="mt-10 border-t border-slate-100 pt-8">
      <h4 className="font-display text-lg font-semibold text-slate-900">Email templates</h4>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Create and edit templates used in the email composer. Placeholders:{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">{"{{contactName}}"}</code>{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">{"{{companyName}}"}</code>{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">{"{{senderName}}"}</code>{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">{"{{municipality}}"}</code>{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">{"{{departmentName}}"}</code>
        . Defaults include <span className="font-semibold text-slate-700">OPRA</span> (New Jersey open records) and{" "}
        <span className="font-semibold text-slate-700">FOIL</span> (New York freedom of information) starters—edit the bracketed parts before sending.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addTemplate}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-container"
        >
          <Plus size={16} aria-hidden />
          Add template
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RotateCcw size={16} aria-hidden />
          Reset to defaults
        </button>
      </div>
      <div className="mt-5 space-y-4">
        {templates.map((tpl, index) => (
          <div key={tpl.id} className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <label className="block min-w-0 flex-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Template name</span>
                <input
                  value={tpl.name}
                  onChange={(e) => updateAt(index, { name: e.target.value })}
                  className="focus-ring mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
                />
              </label>
              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={templates.length <= 1}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Delete template ${tpl.name}`}
              >
                <Trash2 size={14} aria-hidden />
                Delete
              </button>
            </div>
            <label className="mt-3 block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Subject</span>
              <input
                value={tpl.subject}
                onChange={(e) => updateAt(index, { subject: e.target.value })}
                className="focus-ring mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Body</span>
              <textarea
                value={tpl.body}
                onChange={(e) => updateAt(index, { body: e.target.value })}
                rows={10}
                className="focus-ring mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 font-mono text-sm leading-6 text-slate-800"
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavLinkList({ items, activePanel, onSelect }: {
  items: { icon: React.ElementType; label: string; panel: ActivePanel }[];
  activePanel: ActivePanel;
  onSelect: (panel: ActivePanel) => void;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onSelect(item.panel)}
          className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition active:bg-slate-100 ${
            item.panel === activePanel ? "bg-blue-500/10 text-blue-700" : "text-slate-600 hover:bg-white/60 hover:text-slate-950"
          }`}
        >
          <item.icon size={20} className="shrink-0" />
          <span className="leading-snug">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function MobileNavSheet({ open, onClose, items, activePanel, onNavChange }: {
  open: boolean;
  onClose: () => void;
  items: { icon: React.ElementType; label: string; panel: ActivePanel }[];
  activePanel: ActivePanel;
  onNavChange: (panel: ActivePanel) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-label="Close navigation"
        onClick={onClose}
      />
      <nav
        className="absolute left-0 top-0 flex h-full w-[min(20rem,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)))] max-w-full flex-col border-r border-slate-100 bg-white p-5 shadow-2xl"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        aria-label="Main navigation"
      >
        <div className="mb-6 flex shrink-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <Building2 size={21} />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-extrabold">TownReach</h2>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Outreach OS</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <NavLinkList
            items={items}
            activePanel={activePanel}
            onSelect={(panel) => {
              onNavChange(panel);
              onClose();
            }}
          />
        </div>
      </nav>
    </div>
  );
}

function SideNav({ items, activePanel, onNavChange }: {
  items: { icon: React.ElementType; label: string; panel: ActivePanel }[];
  activePanel: ActivePanel;
  onNavChange: (panel: ActivePanel) => void;
}) {
  return (
    <nav className="glass fixed left-0 top-0 z-40 hidden h-full w-64 flex-col p-6 shadow-glass md:flex">
      <div className="mb-12 px-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <Building2 size={21} />
          </div>
          <div>
            <h2 className="font-display text-lg font-extrabold">TownReach</h2>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Outreach OS</p>
          </div>
        </div>
      </div>
      <NavLinkList items={items} activePanel={activePanel} onSelect={onNavChange} />
    </nav>
  );
}

function TopBar({
  searchQuery,
  onSearchChange,
  onMenuClick,
  userName,
  companyName
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onMenuClick: () => void;
  userName: string;
  companyName: string;
}) {
  return (
    <header className="glass fixed right-0 top-0 z-30 w-full pt-[env(safe-area-inset-top)] shadow-sm md:w-[calc(100%-16rem)]">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4 md:px-6">
        <button type="button" onClick={onMenuClick} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-white/80 md:hidden" aria-label="Open navigation menu">
          <Menu size={22} />
        </button>
        <div className="relative min-w-0 max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="focus-ring h-11 w-full min-w-0 rounded-full border-0 bg-slate-100 py-2 pl-10 pr-3 text-sm text-slate-700 sm:pl-11 sm:pr-4"
            placeholder="Filter search results…"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <button type="button" className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-white" aria-label="Notifications">
            <Bell size={21} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <button type="button" className="hidden h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-white sm:flex" aria-label="Help">
            <HelpCircle size={21} />
          </button>
          <div className="hidden border-l border-slate-200 pl-4 text-right sm:block">
            <p className="text-xs font-bold">{userName}</p>
            <p className="text-[10px] font-medium text-slate-500">{companyName}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function FilterBar(props: {
  id?: string;
  data: DashboardData;
  stateId: string;
  countyId: string;
  municipalityId: string;
  departmentId: string;
  counties: CountyRecord[];
  municipalities: MunicipalityRecord[];
  countiesLoading: boolean;
  placesLoading: boolean;
  onStateChange: (v: string) => void;
  onCountyChange: (v: string) => void;
  onMunicipalityChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  onSparkle: () => void;
  searching: boolean;
  searchDisabled?: boolean;
}) {
  const countyDisabled = !props.stateId || props.countiesLoading;
  const townDisabled = !props.countyId || props.placesLoading;
  const deptDisabled = !props.municipalityId;
  const searchDisabled = props.searchDisabled ?? false;
  const searchLabel = props.searching ? "Searching the web…" : "Search public contacts";
  return (
    <section
      id={props.id}
      className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-md ring-1 ring-slate-950/[0.04] sm:p-5"
    >
      <div className="flex flex-col gap-3">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
          <FilterSelect label="State" value={props.stateId} onChange={props.onStateChange} disabled={false}>
            <option value="">Select state</option>
            {props.data.states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="County" value={props.countyId} onChange={props.onCountyChange} disabled={countyDisabled}>
            <option value="">{props.countiesLoading ? "Loading counties…" : "Select county"}</option>
            {props.counties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Town" value={props.municipalityId} onChange={props.onMunicipalityChange} disabled={townDisabled}>
            <option value="">{props.placesLoading ? "Loading towns…" : "Select town"}</option>
            {props.municipalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Department" value={props.departmentId} onChange={props.onDepartmentChange} disabled={deptDisabled}>
            <option value="">Select department</option>
            <option value={DEPARTMENT_NOT_SURE}>Not sure</option>
            {props.data.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </FilterSelect>
        </div>
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={props.onSparkle}
            disabled={props.searching || searchDisabled}
            className="flex h-11 w-full max-w-xl items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-center text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:max-w-2xl sm:px-6"
          >
            {props.searching ? <RefreshCw size={17} className="animate-spin shrink-0" aria-hidden /> : <Sparkles size={17} className="shrink-0" aria-hidden />}
            <span className="text-center text-sm font-bold">{searchLabel}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function FilterSelect({ label, value, onChange, disabled, children }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label
      className={`relative flex min-h-[3.25rem] flex-col justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition sm:min-h-[3.5rem] sm:px-4 sm:py-3 ${
        disabled ? "cursor-not-allowed opacity-60" : "hover:border-slate-300 hover:shadow"
      }`}
    >
      <span className="pl-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="relative flex min-h-[2.25rem] items-center">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="focus-ring min-h-[2.25rem] w-full appearance-none rounded-lg border border-slate-100 bg-slate-50/90 py-1.5 pl-2.5 pr-9 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed sm:min-h-[2.375rem] sm:pl-3 sm:text-[15px]"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} aria-hidden />
      </div>
    </label>
  );
}

function uniqueEmailsFromCandidate(result: WebSearchCandidate): string[] {
  const raw =
    result.allEmails && result.allEmails.length > 0 ? result.allEmails : result.email ? [result.email] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of raw) {
    const t = e.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function defaultPickEmail(result: WebSearchCandidate, emails: string[]) {
  if (result.email && emails.includes(result.email)) return result.email;
  return emails[0] ?? "";
}

function WebSearchResultsList({
  results,
  municipality,
  department,
  onEmail,
  className = "mt-4"
}: {
  results: WebSearchCandidate[];
  municipality?: MunicipalityRecord;
  department?: DepartmentRecord;
  onEmail: (candidate: WebSearchCandidate, selectedEmail: string) => void;
  className?: string;
}) {
  const [pickedEmailByRow, setPickedEmailByRow] = useState<Record<number, string>>({});

  useEffect(() => {
    setPickedEmailByRow({});
  }, [results]);

  if (results.length === 0) return null;
  const useful = results.filter((r) => r.email || r.phone || r.name);
  const rest = results.filter((r) => !r.email && !r.phone && !r.name);

  return (
    <div className={`${className} overflow-hidden rounded-2xl border border-white bg-white shadow-soft`}>
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">Contacts Found</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {department?.name} · {municipality?.name}
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          {results.length} result{results.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {useful.map((result, i) => {
          const emails = uniqueEmailsFromCandidate(result);
          const picked = pickedEmailByRow[i] ?? defaultPickEmail(result, emails);
          const multi = emails.length > 1;
          const hasEmail = emails.length > 0;

          return (
            <div key={i} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6">
              <div className="min-w-0 flex-1">
                {result.name && <p className="font-semibold text-slate-900">{result.name}</p>}
                {result.title && <p className="mt-0.5 text-xs text-slate-500">{result.title}</p>}
                {multi && (
                  <p className="mt-2 text-xs font-medium text-slate-600">
                    Multiple addresses — select one, click an address to compose, or use{" "}
                    <span className="font-bold text-slate-800">Email</span> for the selected row.
                  </p>
                )}
                <div className="mt-2 flex flex-col gap-1.5">
                  {emails.map((email) => (
                    <div key={email} className="flex items-start gap-2">
                      {multi ? (
                        <input
                          type="radio"
                          name={`contact-email-choice-${i}`}
                          checked={picked === email}
                          onChange={() => setPickedEmailByRow((prev) => ({ ...prev, [i]: email }))}
                          className="focus-ring mt-2 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                          aria-label={`Select ${email}`}
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setPickedEmailByRow((prev) => ({ ...prev, [i]: email }));
                          onEmail(result, email);
                        }}
                        className="focus-ring group flex min-h-[40px] flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-primary transition hover:bg-primary/5 hover:underline sm:min-h-0"
                      >
                        <Mail size={14} className="shrink-0 text-primary group-hover:text-primary-container" aria-hidden />
                        <span className="min-w-0 break-all">{email}</span>
                      </button>
                    </div>
                  ))}
                  {(result.allPhones ?? (result.phone ? [result.phone] : [])).map((phone) => (
                    <div key={phone} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">📞</span>
                      <span className="text-sm text-slate-700">{phone}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={result.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block max-w-full truncate text-xs text-slate-400 hover:text-primary hover:underline sm:max-w-xs"
                >
                  {result.sourceUrl.replace(/^https?:\/\//, "").split("/")[0]}
                </a>
              </div>
              <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                  {result.confidence}% match
                </span>
                {hasEmail && picked ? (
                  <button
                    type="button"
                    onClick={() => onEmail(result, picked)}
                    className="flex min-h-[44px] min-w-[7rem] items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-container sm:min-h-0 sm:min-w-0 sm:px-3"
                  >
                    <Mail size={13} aria-hidden />
                    Email
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

        {rest.length > 0 && (
          <div className="px-4 py-4 sm:px-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Additional sources</p>
            <div className="space-y-2">
              {rest.map((result, i) => (
                <a
                  key={i}
                  href={result.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Search size={13} />
                  {result.pageTitle}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PastSearchesPanel({
  searches,
  onEmailFromHistory
}: {
  searches: PastSearchEntry[];
  onEmailFromHistory?: (candidate: WebSearchCandidate, entry: PastSearchEntry, selectedEmail: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <section className="col-span-12 flex max-h-[min(32rem,70vh)] flex-col rounded-2xl border border-white bg-white p-4 shadow-soft sm:p-6 lg:col-span-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <History size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold sm:text-xl">Past searches</h3>
          <p className="text-xs text-slate-500">Each public contact search is saved on this device.</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
        {searches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
            Run a search from the filters above. Your history will appear here.
          </p>
        ) : (
          searches.map((s) => {
            const expanded = expandedId === s.id;
            const count = s.candidates.length;
            const summary = `${s.municipalityName} · ${s.departmentName}`;
            const when = new Date(s.at);
            const timeLabel = Number.isNaN(when.getTime()) ? s.at : when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
            return (
              <div key={s.id} className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80">
                <button
                  type="button"
                  onClick={() => setExpandedId((id) => (id === s.id ? null : s.id))}
                  className="flex w-full items-start gap-2 px-3 py-3 text-left transition hover:bg-white"
                >
                  <ChevronDown className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} size={18} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{summary}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{timeLabel}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {s.error ? <span className="text-red-600">Error</span> : `${count} email${count !== 1 ? "s" : ""} found`}
                    </p>
                  </div>
                </button>
                {expanded && (
                  <div className="space-y-4 border-t border-slate-200 bg-white px-3 py-4">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                      <div><dt className="font-bold uppercase tracking-wide text-slate-400">State</dt><dd className="mt-0.5 text-slate-800">{s.stateName}</dd></div>
                      <div><dt className="font-bold uppercase tracking-wide text-slate-400">State id</dt><dd className="mt-0.5 font-mono text-slate-600">{s.stateId}</dd></div>
                      <div><dt className="font-bold uppercase tracking-wide text-slate-400">County</dt><dd className="mt-0.5 text-slate-800">{s.countyName}</dd></div>
                      <div><dt className="font-bold uppercase tracking-wide text-slate-400">County id</dt><dd className="mt-0.5 font-mono text-slate-600">{s.countyId}</dd></div>
                      <div><dt className="font-bold uppercase tracking-wide text-slate-400">Town</dt><dd className="mt-0.5 text-slate-800">{s.municipalityName}</dd></div>
                      <div><dt className="font-bold uppercase tracking-wide text-slate-400">Place id</dt><dd className="mt-0.5 font-mono text-slate-600">{s.municipalityId}</dd></div>
                      <div><dt className="font-bold uppercase tracking-wide text-slate-400">Department</dt><dd className="mt-0.5 text-slate-800">{s.departmentName}</dd></div>
                      <div><dt className="font-bold uppercase tracking-wide text-slate-400">Department id</dt><dd className="mt-0.5 font-mono text-slate-600">{s.departmentId}</dd></div>
                      <div className="sm:col-span-2"><dt className="font-bold uppercase tracking-wide text-slate-400">Requested at (ISO)</dt><dd className="mt-0.5 break-all font-mono text-slate-600">{s.at}</dd></div>
                    </dl>
                    {s.error && (
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-800">{s.error}</p>
                    )}
                    {s.note && !s.error && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">{s.note}</p>
                    )}
                    {s.candidates.length > 0 && (
                      <WebSearchResultsList
                        className="mt-0"
                        results={s.candidates}
                        municipality={{
                          id: s.municipalityId,
                          countyId: s.countyId,
                          stateId: s.stateId,
                          name: s.municipalityName,
                          kind: "city",
                          placeFips: ""
                        }}
                        department={{
                          id: s.departmentId,
                          name: s.departmentName,
                          slug: s.departmentId,
                          description: ""
                        }}
                        onEmail={(c, sel) => onEmailFromHistory?.(c, s, sel)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function IntentAssistant({
  id,
  data,
  intentQuery,
  onIntentChange,
  intentInputRef,
  stateId,
  countyId,
  municipalityId,
  counties,
  municipalities,
  countiesLoading,
  placesLoading,
  onStateChange,
  onCountyChange,
  onMunicipalityChange,
  department,
  departmentModeNotSure,
  municipality,
  onUseDepartment
}: {
  id: string;
  data: DashboardData;
  intentQuery: string;
  onIntentChange: (v: string) => void;
  intentInputRef: React.RefObject<HTMLInputElement | null>;
  stateId: string;
  countyId: string;
  municipalityId: string;
  counties: CountyRecord[];
  municipalities: MunicipalityRecord[];
  countiesLoading: boolean;
  placesLoading: boolean;
  onStateChange: (v: string) => void;
  onCountyChange: (v: string) => void;
  onMunicipalityChange: (v: string) => void;
  department?: DepartmentRecord;
  departmentModeNotSure: boolean;
  municipality?: MunicipalityRecord;
  onUseDepartment: (id: string) => void;
}) {
  const hasInput = Boolean(intentQuery.trim());
  const countyDisabled = !stateId || countiesLoading;
  const townDisabled = !countyId || placesLoading;
  return (
    <section id={id} className="col-span-12 rounded-2xl border border-white bg-white p-4 shadow-soft sm:p-6 lg:col-span-7">
      <div className="mb-5 flex items-start gap-3 sm:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary"><Lightbulb size={22} /></div>
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold">Not sure which department?</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Describe what you need in one line. We suggest a municipal function; you can narrow state, county, and town here too (they stay in sync with the filters above). Then run <span className="font-semibold text-slate-700">Search public contacts</span> for real emails.
          </p>
        </div>
      </div>

      <label className="mb-4 block">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">What you&apos;re looking for</span>
        <input
          ref={intentInputRef}
          value={intentQuery}
          onChange={(e) => onIntentChange(e.target.value)}
          className="focus-ring mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
          placeholder="Start typing — permits, bids, health inspection, clerk of records…"
        />
      </label>

      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Location (optional if already set above)</p>
      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FilterSelect label="State" value={stateId} onChange={onStateChange} disabled={false}>
          <option value="">Select state</option>
          {data.states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </FilterSelect>
        <FilterSelect label="County" value={countyId} onChange={onCountyChange} disabled={countyDisabled}>
          <option value="">{countiesLoading ? "Loading counties…" : "Select county"}</option>
          {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </FilterSelect>
        <FilterSelect label="Town" value={municipalityId} onChange={onMunicipalityChange} disabled={townDisabled}>
          <option value="">{placesLoading ? "Loading towns…" : "Select town"}</option>
          {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </FilterSelect>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        {departmentModeNotSure && (
          <p className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-slate-700">
            You chose <span className="font-bold">Not sure</span> for department. Keep typing until a suggestion appears, then use it below or search with the button above.
          </p>
        )}
        {!hasInput ? (
          <p className="text-sm text-slate-500">Start typing in this box (same text as at the top) to get a department recommendation.</p>
        ) : department ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Suggested department</p>
              <h4 className="mt-1 text-lg font-bold text-slate-950">{department.name}</h4>
              <p className="mt-1 text-sm leading-6 text-slate-500">{department.description}</p>
              <p className="mt-3 text-sm text-slate-500">
                {municipality ? (
                  <>For <span className="font-semibold text-slate-800">{municipality.name}</span>, use the button to set this department on the main filters, then search.</>
                ) : (
                  <>Select a town in the filters, then use <span className="font-semibold">Search public contacts</span> to load addresses from the open web.</>
                )}
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
              <button type="button" onClick={() => onUseDepartment(department.id)} className="min-h-[44px] rounded-xl border border-primary bg-white px-4 py-2.5 text-sm font-bold text-primary sm:min-h-0 sm:py-2">Use department</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No department match yet. Try terms like permit, records, vendor, health, zoning, or school.</p>
        )}
      </div>
    </section>
  );
}

function InboxPanel({
  threads,
  contacts,
  onThreadsUpdate,
  canSync = true
}: {
  threads: OutreachThread[];
  contacts: ContactRecord[];
  onThreadsUpdate: (threads: OutreachThread[]) => void;
  canSync?: boolean;
}) {
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done" | "error">("idle");

  async function handleSync() {
    if (!canSync) {
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 1800);
      return;
    }
    setSyncState("syncing");
    try {
      const res = await fetch("/api/email/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threads: threads.map((t) => ({ provider: t.provider, providerThreadId: t.providerThreadId }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "sync failed");
      if (data.syncedReplies?.length) {
        onThreadsUpdate(threads.map((t) => {
          const update = data.syncedReplies.find((r: { providerThreadId: string; status: string }) => r.providerThreadId === t.providerThreadId);
          return update ? { ...t, status: update.status } : t;
        }));
      }
      setSyncState("done");
      setTimeout(() => setSyncState("idle"), 2000);
    } catch {
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 2000);
    }
  }

  return (
    <section className="col-span-12 rounded-2xl border border-white bg-surface-container-low p-4 shadow-soft sm:p-6 md:col-span-4">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-secondary"><Inbox size={22} /></div>
          <div>
            <h3 className="font-display text-xl font-semibold">Response Tracking</h3>
            <p className="text-xs text-slate-500">Gmail &amp; Outlook threads</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncState === "syncing" || !canSync}
          title="Sync replies from your inbox"
          className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:min-h-0 sm:w-auto sm:justify-start"
        >
          <RefreshCw size={14} className={syncState === "syncing" ? "animate-spin" : ""} />
          {syncState === "syncing" ? "Syncing…" : syncState === "done" ? "Synced ✓" : syncState === "error" ? "Failed" : "Sync"}
        </button>
      </div>
      {!canSync && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          Connect Gmail or Outlook in Admin Settings to sync replies.
        </p>
      )}
      <div className="space-y-3">
        {threads.slice(0, 3).map((thread) => {
          const contact = contacts.find((c) => c.id === thread.contactId);
          return (
            <div key={thread.id} className="rounded-xl bg-white/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-bold text-slate-900">{contact?.name ?? "Municipal contact"}</p><p className="mt-1 text-xs text-slate-500">{thread.subject}</p></div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">{thread.status.replaceAll("_", " ")}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EmailTrackerPanel({
  threads,
  contacts,
  municipalities,
  departments,
  onThreadsUpdate,
  canSync
}: {
  threads: OutreachThread[];
  contacts: ContactRecord[];
  municipalities: MunicipalityRecord[];
  departments: DepartmentRecord[];
  onThreadsUpdate: (threads: OutreachThread[]) => void;
  canSync: boolean;
}) {
  const rows = useMemo(() => {
    const byRecent = [...threads].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    return byRecent.map((thread) => {
      const contact = contacts.find((c) => c.id === thread.contactId);
      const municipality = municipalities.find((m) => m.id === thread.municipalityId);
      const department = departments.find((d) => d.id === thread.departmentId);
      return { thread, contact, municipality, department };
    });
  }, [threads, contacts, municipalities, departments]);

  const repliedRows = rows.filter((r) => r.thread.status === "replied");
  const sentRows = rows.filter((r) => r.thread.status !== "replied");
  const sentCount = rows.length;
  const repliedCount = repliedRows.length;
  const replyRate = sentCount > 0 ? Math.round((repliedCount / sentCount) * 100) : 0;

  function badge(status: OutreachThread["status"]) {
    if (status === "replied") return "bg-emerald-100 text-emerald-700";
    if (status === "sent") return "bg-blue-100 text-blue-700";
    if (status === "needs_follow_up") return "bg-amber-100 text-amber-700";
    if (status === "bounced") return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-600";
  }

  function formatDate(iso: string) {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  return (
    <section className="col-span-12 rounded-2xl border border-white bg-white p-4 shadow-soft sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold">Email Tracker</h3>
          <p className="mt-1 text-sm text-slate-500">Track sent outreach and municipal replies in one place.</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Emails sent</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{sentCount}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Replies</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{repliedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Reply rate</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{replyRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <InboxPanel threads={threads} contacts={contacts} onThreadsUpdate={onThreadsUpdate} canSync={canSync} />
        </div>

        <div className="rounded-xl border border-slate-100">
          <div className="border-b border-slate-100 px-4 py-3">
            <h4 className="font-semibold text-slate-900">Sent / Awaiting response</h4>
          </div>
          <div className="max-h-[26rem] overflow-y-auto">
            {sentRows.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No sent emails yet.</p>
            ) : (
              sentRows.map(({ thread, contact, municipality, department }) => (
                <div key={thread.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{contact?.name ?? "Municipal contact"}</p>
                      <p className="truncate text-xs text-slate-500">{thread.subject}</p>
                      <p className="mt-1 text-xs text-slate-500">{municipality?.name ?? "Unknown town"} · {department?.name ?? "Unknown department"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${badge(thread.status)}`}>
                      {thread.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{thread.provider.toUpperCase()} · {formatDate(thread.sentAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100">
          <div className="border-b border-slate-100 px-4 py-3">
            <h4 className="font-semibold text-slate-900">Replies received</h4>
          </div>
          <div className="max-h-[26rem] overflow-y-auto">
            {repliedRows.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No replies yet.</p>
            ) : (
              repliedRows.map(({ thread, contact, municipality, department }) => (
                <div key={thread.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{contact?.name ?? "Municipal contact"}</p>
                      <p className="truncate text-xs text-slate-500">{thread.subject}</p>
                      <p className="mt-1 text-xs text-slate-500">{municipality?.name ?? "Unknown town"} · {department?.name ?? "Unknown department"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${badge(thread.status)}`}>
                      replied
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{thread.provider.toUpperCase()} · {formatDate(thread.sentAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MapPanel({
  stateId,
  countyId,
  municipalityId,
  selectedMunicipality,
  selectedDepartment
}: {
  stateId: string;
  countyId: string;
  municipalityId: string;
  selectedMunicipality?: MunicipalityRecord;
  selectedDepartment?: DepartmentRecord;
}) {
  const placeGeoid = (selectedMunicipality?.id ?? municipalityId).trim();
  const contextLine = selectedMunicipality
    ? `${selectedMunicipality.name}${selectedDepartment ? ` · ${selectedDepartment.name}` : ""}`
    : "Select state, county, and town to see boundaries.";

  return (
    <section className="col-span-12 rounded-2xl border border-white bg-white p-4 shadow-soft sm:p-6 md:col-span-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-semibold">Coverage map</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{contextLine}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Blue outline: selected county (Census 2020). Orange fill: selected incorporated place or CDP when a town is chosen. Basemap: OpenStreetMap.
          </p>
        </div>
        <Map className="shrink-0 text-slate-400" size={24} aria-hidden />
      </div>
      {stateId && countyId ? (
        <div className="mt-6">
          <CoverageMap stateId={stateId} countyId={countyId} municipalityId={placeGeoid} />
        </div>
      ) : (
        <div className="mt-6 flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
          Choose a state and county to load the county boundary from the U.S. Census TIGERweb service.
        </div>
      )}
    </section>
  );
}

function ComposerDrawer({
  open,
  contact,
  municipality,
  department,
  emailSettings,
  onClose,
  onOpenEmailSettings,
  templates,
  onThreadCreated
}: {
  open: boolean;
  contact: ContactRecord | null;
  municipality?: MunicipalityRecord;
  department?: DepartmentRecord;
  emailSettings: EmailConnectionSettings;
  onClose: () => void;
  onOpenEmailSettings: () => void;
  templates: EmailTemplate[];
  onThreadCreated: (thread: OutreachThread) => void;
}) {
  const firstId = templates[0]?.id ?? "";
  const [templateId, setTemplateId] = useState(firstId);
  const [provider, setProvider] = useState<"gmail" | "outlook">("gmail");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendErrorDetail, setSendErrorDetail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) {
      setSendState("idle");
      setSendErrorDetail("");
    }
  }, [open]);

  useEffect(() => {
    if (sendState !== "sent" || !open) return;
    const id = window.setTimeout(() => {
      onClose();
    }, 2400);
    return () => window.clearTimeout(id);
  }, [sendState, open, onClose]);

  useEffect(() => {
    if (!templates.length) return;
    if (!templates.some((t) => t.id === templateId)) {
      setTemplateId(templates[0].id);
    }
  }, [templates, templateId]);

  const isProviderConnected = provider === "gmail" ? emailSettings.gmailConnected : emailSettings.outlookConnected;
  const variables = useMemo(() => ({
    contactName: contact?.name,
    companyName: emailSettings.senderCompany || sender.companyName,
    senderName: emailSettings.senderName || sender.senderName,
    municipality: municipality?.name, departmentName: department?.name
  }), [contact?.name, department?.name, emailSettings.senderCompany, emailSettings.senderName, municipality?.name]);

  useEffect(() => {
    const t = templates.find((x) => x.id === templateId) ?? templates[0];
    if (!t) return;
    setSubject(tokenReplace(t.subject, variables));
    setBody(tokenReplace(t.body, variables));
    setSendState("idle");
    setSendErrorDetail("");
  }, [templates, templateId, contact?.id, variables]);

  async function sendEmail() {
    if (!contact || !department || !municipality || !isProviderConnected) return;
    setSendState("sending");
    setSendErrorDetail("");
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          provider,
          to: contact.email,
          subject,
          body,
          contactId: contact.id,
          departmentId: department.id,
          municipalityId: municipality.id,
          senderName: emailSettings.senderName,
          senderCompany: emailSettings.senderCompany,
          senderEmail: emailSettings.senderEmail
        })
      });
      const result = (await res.json()) as { error?: string; thread?: OutreachThread };
      if (!res.ok) throw new Error(result.error ?? "Unable to send");
      if (!result.thread) throw new Error("Invalid response from server.");
      onThreadCreated(result.thread);
      setSendState("sent");
    } catch (e) {
      setSendState("error");
      setSendErrorDetail(e instanceof Error ? e.message : "Send failed");
    }
  }

  return (
    <>
      {open && <button type="button" className="fixed inset-0 z-40 bg-slate-950/20" aria-label="Close composer overlay" onClick={onClose} />}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out sm:max-w-[460px] ${open ? "translate-x-0" : "translate-x-full pointer-events-none"}`}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-hidden={!open}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Email Composer</p>
              <h2 className="mt-2 font-display text-2xl font-bold">Send municipal outreach</h2>
            </div>
            <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close composer"><X size={20} /></button>
          </div>
          {sendState === "sent" && (
            <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-4 sm:px-6" role="status" aria-live="polite">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={22} aria-hidden />
                <div className="min-w-0">
                  <p className="text-base font-bold text-emerald-950">Email sent</p>
                  <p className="mt-1 text-sm leading-5 text-emerald-900">
                    Your message was sent successfully. This thread is now in response tracking so you can follow replies.
                  </p>
                </div>
              </div>
            </div>
          )}
          {contact && municipality && department ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold">{contact.name}</p>
                <p className="mt-1 text-sm text-slate-600">{contact.title}</p>
                <p className="mt-2 text-sm text-primary">{contact.email}</p>
                <p className="mt-3 text-xs text-slate-500">{municipality.name} / {department.name} / verified {contact.lastChecked}</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {(["gmail", "outlook"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={`flex min-h-[44px] items-center justify-center rounded-xl border text-sm font-bold capitalize transition ${
                      provider === p ? "border-primary bg-blue-50 text-primary" : "border-slate-200 bg-white text-slate-600"
                    } ${((p === "gmail" && !emailSettings.gmailConnected) || (p === "outlook" && !emailSettings.outlookConnected)) ? "opacity-60" : ""}`}
                  >
                    {p} {((p === "gmail" && emailSettings.gmailConnected) || (p === "outlook" && emailSettings.outlookConnected)) ? "✓" : "(connect)"}
                  </button>
                ))}
              </div>
              {!isProviderConnected && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-950">
                    {provider === "gmail" && !emailSettings.gmailConnected
                      ? "Connect Gmail to send"
                      : provider === "outlook" && !emailSettings.outlookConnected
                        ? "Enable Outlook to send (demo)"
                        : "Choose a connected inbox"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">
                    {provider === "gmail"
                      ? "Use Google sign-in so TownReach can send from your Gmail."
                      : "Turn on the simulated Outlook option under Admin Settings, or switch to Gmail above."}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {provider === "gmail" && !emailSettings.gmailConnected && (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.assign("/connect/gmail");
                        }}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-container"
                      >
                        <Mail size={16} aria-hidden />
                        Connect Gmail
                      </button>
                    )}
                    {provider === "outlook" && !emailSettings.outlookConnected && (
                      <button
                        type="button"
                        onClick={onOpenEmailSettings}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-container"
                      >
                        <Settings size={16} aria-hidden />
                        Open Admin Settings
                      </button>
                    )}
                    {provider === "gmail" && !emailSettings.gmailConnected && (
                      <button
                        type="button"
                        onClick={onOpenEmailSettings}
                        className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-amber-900/20 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-100/60"
                      >
                        Admin Settings
                      </button>
                    )}
                  </div>
                </div>
              )}
              <label className="mt-5 block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Template</span>
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="focus-ring mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Edit templates in{" "}
                <button type="button" onClick={onOpenEmailSettings} className="font-semibold text-primary underline-offset-2 hover:underline">
                  Admin Settings
                </button>
                .
              </p>
              <label className="mt-5 block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Subject</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="focus-ring mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label className="mt-5 block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Body</span>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="focus-ring mt-2 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm leading-6" />
              </label>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">Select a verified contact to compose an email.</div>
          )}
          <div className="border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-6">
            <button
              type="button"
              onClick={sendState === "sent" ? onClose : sendEmail}
              disabled={
                sendState === "sending" || (sendState !== "sent" && (!contact || !isProviderConnected))
              }
              className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                sendState === "sent"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-primary hover:bg-primary-container"
              }`}
            >
              {sendState === "sent" ? (
                <>
                  <CheckCircle2 size={18} aria-hidden />
                  Done
                </>
              ) : (
                <>
                  <Send size={18} aria-hidden />
                  {sendState === "sending" ? "Sending..." : "Send through user inbox"}
                </>
              )}
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              {sendState === "sent" && (
                <span className="font-medium text-emerald-800">Closing in a moment — or tap Done to close now.</span>
              )}
              {sendState === "error" && (
                <span className="text-red-700">
                  {sendErrorDetail ? sendErrorDetail : "Something went wrong sending this email."}
                </span>
              )}
              {sendState === "idle" &&
                (isProviderConnected
                  ? provider === "gmail" && emailSettings.gmailConnected
                    ? "Sends through your connected Gmail inbox."
                    : provider === "outlook"
                      ? "Outlook sending is simulated in this build."
                      : "Ready to send."
                  : "Connect the selected provider in Admin Settings to send.")}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

function WebSearchResults({ loading, results, error, municipality, department, onEmail }: {
  loading: boolean;
  results: WebSearchCandidate[];
  error: string;
  municipality?: MunicipalityRecord;
  department?: DepartmentRecord;
  onEmail: (candidate: WebSearchCandidate, selectedEmail: string) => void;
}) {
  if (loading) {
    return (
      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-6">
        <div className="flex items-center gap-3">
          <RefreshCw size={20} className="animate-spin text-primary" />
          <div>
            <p className="font-semibold text-slate-900">Searching the web…</p>
            <p className="text-sm text-slate-500">Finding {department?.name} contacts in {municipality?.name}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-700">{error}</p>
      </div>
    );
  }

  if (results.length === 0) return null;
  return <WebSearchResultsList results={results} municipality={municipality} department={department} onEmail={onEmail} />;
}
