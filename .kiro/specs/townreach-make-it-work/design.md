# TownReach Make-It-Work Bugfix Design

## Overview

TownReach is a Next.js municipal outreach SaaS that is visually complete but non-functional across several critical areas. The bugs fall into three categories:

1. **Data gaps** — `lib/seed-data.ts` only covers 10 of 50 states with county records and only Bergen County NJ with full municipality coverage, making the geography filter chain broken for 40 states. The department list is also missing 10 standard municipal departments.
2. **Dead UI** — Four buttons (`✨ Sparkle`, `View All`, `Review Queue`, `Sync Replies`) have no `onClick` handlers. The top search bar is an uncontrolled input with no state binding. The sidebar nav items are hardcoded with no panel-switching logic.
3. **Missing font loading** — `app/layout.tsx` already contains the Google Fonts `<link>` tags for Manrope and Inter, so this bug is already fixed and requires no change.

The fix strategy is additive and minimal: expand static seed data, wire up existing UI components with state and handlers, and add one new button. No database, no OAuth, no new dependencies. All changes are confined to `lib/seed-data.ts` and `components/dashboard.tsx`.

---

## Glossary

- **Bug_Condition (C)**: The set of conditions that cause the app to be non-functional — missing seed data, missing `onClick` handlers, uncontrolled inputs, and hardcoded nav state.
- **Property (P)**: The desired behavior after the fix — geography dropdowns populate for all 50 states, all buttons produce visible effects, search filters contacts in real time, and nav switches panels.
- **Preservation**: Existing behavior that must not regress — the 10 states already covered, Bergen County's 70 municipalities, all 9 existing contacts, the email send flow, the IntentAssistant keyword scoring, and local/seed mode operation.
- **`filteredContacts`**: The `useMemo` in `Dashboard` that derives the visible contact list from the four filter dropdowns.
- **`departmentKeywords`**: The `Record<string, string[]>` map in `dashboard.tsx` used by `recommendDepartment()` to score departments against free-text queries.
- **`DashboardData`**: The prop type passed into `<Dashboard>` containing all seed arrays (`states`, `counties`, `municipalities`, `departments`, `contacts`, `threads`).
- **`activePanel`**: New state to be added to `Dashboard` that controls which panel the sidebar nav renders.
- **`searchQuery`**: New state to be added to `Dashboard` that holds the top search bar value and drives real-time contact filtering.
- **`showAll`**: New state to be added to `ContactsTable` (or lifted to `Dashboard`) that toggles between the 5-row default and the full contact list.

---

## Bug Details

### Bug Condition

The app is broken when any of the following conditions hold:

**Formal Specification:**
```
FUNCTION isBugCondition(state)
  INPUT: state — the current application state and seed data

  // Geography gaps
  IF state.selectedStateId NOT IN { "ny","nj","ma","ct","pa","ca","tx","fl","il","ga" }
    RETURN true  // county dropdown will be empty

  IF state.selectedCountyId NOT IN existingCountyIds
    RETURN true  // municipality dropdown will be empty

  // Dead buttons
  IF buttonId IN { "sparkle", "view-all", "review-queue", "sync-replies" }
     AND button.onClick IS NULL
    RETURN true

  // Inert search bar
  IF topBarInput.onChange IS NULL
     AND topBarInput.value IS UNCONTROLLED
    RETURN true

  // Dead sidebar nav
  IF sidebarNavItem.onClick IS NULL
     AND activePanel IS HARDCODED
    RETURN true

  // Incomplete department list
  IF departments.length < 17
    RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **Geography gap**: User selects "Texas" → county dropdown shows 0 options → municipality dropdown disabled → no contacts can be found for any Texas municipality.
- **Dead Sparkle button**: User selects all four filters → clicks `✨` → nothing happens, no contact is surfaced.
- **Inert search bar**: User types "Cambridge" in the top bar → contacts table does not change.
- **Dead sidebar nav**: User clicks "Contact Finder" → main content area stays on the default dashboard layout.
- **Incomplete departments**: User opens Department Verification panel → "Fire Department" and "Police / Public Safety" are absent from the list.
- **Font loading** *(already fixed)*: `app/layout.tsx` already contains the correct `<link>` tags for Manrope and Inter — no action needed.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The 10 existing states (NY, NJ, MA, CT, PA, CA, TX, FL, IL, GA) must continue to populate their county dropdowns with exactly the same records.
- Bergen County NJ must continue to list all 70 existing boroughs and townships.
- All 9 existing `ContactRecord` entries must remain in the seed data unchanged.
- The `filteredContacts` logic (filter by state → county → municipality → department, sort by confidence) must continue to work identically.
- The email compose and send flow (`ComposerDrawer` → `POST /api/email/send` → thread appended to `InboxPanel`) must continue to work.
- The `IntentAssistant` keyword scoring must continue to recommend the same department for the same query. Specifically: adding new departments to `departmentKeywords` must not change the top-scored result for any existing query that already matches an existing department.
- The app must continue to run fully in local/seed mode with no Supabase or OAuth credentials required.
- The `DepartmentVerificationPanel` must continue to show "Verified" / "Needs verification" per department based on whether a verified contact exists for the selected municipality and department.

**Scope:**
All inputs that do NOT involve the buggy conditions (selecting a new state, clicking a dead button, typing in the search bar, clicking a nav item) must be completely unaffected by this fix.

---

## Hypothesized Root Cause

1. **Incomplete static seed data**: `lib/seed-data.ts` was seeded with only the counties and municipalities needed for the initial demo (NJ, NY, and a handful of other states). No automated data pipeline was wired up, so the remaining 40 states were never populated. Fix: add a comprehensive static dataset covering all 50 states.

2. **Missing `onClick` handlers on buttons**: `FilterBar`'s Sparkle button, `ContactsTable`'s "View All" button, `VerificationPanel`'s "Review Queue" button, and `InboxPanel`'s missing "Sync Replies" button were all rendered without handler props or internal state. The components were built for visual completeness but the interaction logic was deferred. Fix: add state and handlers in `Dashboard` and pass them down.

3. **Uncontrolled search input**: `TopBar` renders a plain `<input>` with no `value`, no `onChange`, and no connection to any state in `Dashboard`. Fix: lift `searchQuery` state to `Dashboard`, pass it and a setter to `TopBar` as props, and apply the filter to `filteredContacts`.

4. **Hardcoded sidebar nav**: `SideNav` renders nav items with a hardcoded `active: true` on "Dashboard" and no `onClick`. Fix: add `activePanel` state to `Dashboard`, pass it and a setter to `SideNav`, and conditionally render the correct panel group in `<main>`.

5. **Incomplete `departmentKeywords` map**: The `departmentKeywords` record in `dashboard.tsx` only covers the original 7 departments. The 10 new departments added to seed data need corresponding keyword arrays so `recommendDepartment()` can score them.

---

## Correctness Properties

Property 1: Bug Condition — Geography Completeness

_For any_ US state ID in the full set of 50 states, the fixed seed data SHALL return at least one county record for that state, and for every county record, at least one municipality record, so that the filter chain (state → county → municipality) is never broken.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Button Handlers Produce Visible Effects

_For any_ click on the Sparkle button, "View All" button, "Review Queue" button, or "Sync Replies" button, the fixed component SHALL produce a visible state change (contact highlighted, table expanded, panel activated, or sync feedback shown) rather than doing nothing.

**Validates: Requirements 2.3, 2.4, 2.5, 2.9**

Property 3: Bug Condition — Search Bar Filters Contacts

_For any_ non-empty string typed into the top search bar, the fixed Dashboard SHALL filter the visible contacts table in real time so that only contacts whose name, municipality name, department name, or email contains the query string (case-insensitive) are shown.

**Validates: Requirement 2.6**

Property 4: Bug Condition — Sidebar Navigation Switches Panels

_For any_ sidebar nav item click, the fixed Dashboard SHALL update `activePanel` to the corresponding panel identifier and render the matching content area, replacing the previously active panel.

**Validates: Requirement 2.7**

Property 5: Bug Condition — Department List Completeness

_For any_ render of the `DepartmentVerificationPanel` or the department filter dropdown, the fixed seed data SHALL include all 17 standard municipal departments (the original 7 plus the 10 new ones), and `departmentKeywords` SHALL include keyword arrays for all 17.

**Validates: Requirement 2.10**

Property 6: Preservation — Existing Geography Unchanged

_For any_ state ID in `{ "ny","nj","ma","ct","pa","ca","tx","fl","il","ga" }` and any existing county ID, the fixed seed data SHALL return the same county and municipality records as the original seed data, with no records removed or modified.

**Validates: Requirements 3.1, 3.2**

Property 7: Preservation — Existing Contacts and Email Flow Unchanged

_For any_ existing contact record and any existing thread record, the fixed code SHALL preserve those records exactly, and the email send flow (ComposerDrawer → POST /api/email/send → thread appended) SHALL continue to work identically.

**Validates: Requirements 3.3, 3.4, 3.5**

Property 8: Preservation — IntentAssistant Keyword Scoring Unchanged

_For any_ query string that previously matched an existing department (building, planning, public-works, clerk, procurement, health, education), the fixed `recommendDepartment()` function SHALL return the same top-scored department as before, with no regression caused by adding new keyword arrays.

**Validates: Requirements 3.6, 3.7, 3.8**

---

## Fix Implementation

### Changes Required

#### File: `lib/seed-data.ts`

**1. Expand `counties` array — add counties for all 50 states**

Add real county records for the 40 states currently missing. Each record follows the existing `CountyRecord` shape: `{ id, stateId, name, fips }`. The id is kebab-case `{county-name}-{stateAbbr}`. Coverage target: at minimum 3–5 representative counties per state (the most populous or most commonly searched), with full coverage for states that already have partial data (NY, NJ).

Representative counties to add (non-exhaustive — implementation will include all):
- AL: Jefferson, Madison, Mobile, Montgomery, Shelby
- AK: Anchorage, Fairbanks North Star, Matanuska-Susitna
- AZ: Maricopa, Pima, Pinal, Yavapai, Coconino
- AR: Pulaski, Benton, Washington, Sebastian, Faulkner
- CA: (already has Los Angeles) + San Diego, Orange, Riverside, San Bernardino, Santa Clara, Alameda, Sacramento
- CO: Denver, El Paso, Arapahoe, Jefferson, Adams, Boulder
- CT: (already has Hartford) + New Haven, Fairfield, New London, Litchfield, Middlesex
- DE: New Castle, Kent, Sussex
- FL: (already has Miami-Dade) + Broward, Palm Beach, Hillsborough, Orange, Pinellas
- GA: (already has Fulton) + Gwinnett, Cobb, DeKalb, Cherokee, Forsyth
- HI: Honolulu, Hawaii, Maui, Kauai
- ID: Ada, Canyon, Kootenai, Twin Falls, Bannock
- IL: (already has Cook) + DuPage, Lake, Will, Kane, McHenry
- IN: Marion, Hamilton, Allen, St. Joseph, Hendricks
- IA: Polk, Linn, Scott, Johnson, Black Hawk
- KS: Johnson, Sedgwick, Shawnee, Douglas, Wyandotte
- KY: Jefferson, Fayette, Kenton, Boone, Warren
- LA: East Baton Rouge, Jefferson, Orleans, St. Tammany, Caddo
- ME: Cumberland, York, Penobscot, Kennebec, Androscoggin
- MD: Montgomery, Prince George's, Baltimore, Anne Arundel, Howard
- MA: (already has Middlesex) + Worcester, Suffolk, Essex, Norfolk, Bristol
- MI: Wayne, Oakland, Macomb, Kent, Washtenaw
- MN: Hennepin, Ramsey, Dakota, Anoka, Washington
- MS: Hinds, Harrison, DeSoto, Rankin, Madison
- MO: St. Louis, Jackson, St. Charles, Jefferson, Greene
- MT: Yellowstone, Cascade, Missoula, Gallatin, Lewis and Clark
- NE: Douglas, Lancaster, Sarpy, Hall, Buffalo
- NV: Clark, Washoe, Carson City, Elko, Douglas
- NH: Hillsborough, Rockingham, Merrimack, Strafford, Cheshire
- NJ: (already complete — all 21 counties present)
- NM: Bernalillo, Doña Ana, Santa Fe, Sandoval, San Juan
- NY: (already has Westchester, Nassau, Suffolk) + Kings, Queens, New York, Bronx, Richmond, Erie, Monroe, Onondaga
- NC: Mecklenburg, Wake, Guilford, Forsyth, Durham
- ND: Cass, Burleigh, Grand Forks, Ward, Morton
- OH: Franklin, Cuyahoga, Hamilton, Summit, Montgomery
- OK: Oklahoma, Tulsa, Cleveland, Canadian, Comanche
- OR: Multnomah, Washington, Clackamas, Lane, Marion
- PA: (already has Montgomery) + Philadelphia, Allegheny, Bucks, Chester, Delaware
- RI: Providence, Kent, Washington, Newport, Bristol
- SC: Greenville, Richland, Charleston, Horry, Spartanburg
- SD: Minnehaha, Pennington, Lincoln, Brown, Codington
- TN: Shelby, Davidson, Knox, Hamilton, Rutherford
- TX: (already has Travis) + Harris, Dallas, Bexar, Tarrant, Collin, Denton, Fort Bend
- UT: Salt Lake, Utah, Davis, Weber, Washington
- VT: Chittenden, Rutland, Washington, Windsor, Franklin
- VA: Fairfax, Prince William, Loudoun, Chesterfield, Henrico
- WA: King, Pierce, Snohomish, Spokane, Clark
- WV: Kanawha, Cabell, Wood, Berkeley, Monongalia
- WI: Milwaukee, Dane, Waukesha, Brown, Racine
- WY: Laramie, Natrona, Campbell, Sweetwater, Fremont

**2. Expand `municipalities` array — add municipalities for each new county**

For each new county, add 3–8 representative municipalities (cities, towns, townships, boroughs) following the existing `MunicipalityRecord` shape: `{ id, countyId, stateId, name, kind, placeFips }`. The id is kebab-case `{name}-{kind}`. Use real place names. The `placeFips` can use a placeholder pattern `{countyId}-{index}` since real Census FIPS are not required for local/seed mode.

**3. Expand `departments` array — add 10 new departments**

The 10 new departments are already present in the current `seed-data.ts` (the file was updated before this spec was written). Confirm the following IDs exist: `finance`, `fire`, `police`, `parks`, `it`, `legal`, `hr`, `engineering`, `environment`, `community-dev`. No change needed if already present.

---

#### File: `components/dashboard.tsx`

**4. Expand `departmentKeywords` — add entries for the 10 new departments**

```typescript
finance: ["finance", "treasury", "budget", "accounting", "tax", "fiscal", "revenue", "audit"],
fire: ["fire", "firefighter", "fire department", "fire prevention", "fire code", "fire inspection", "emergency response"],
police: ["police", "public safety", "law enforcement", "sheriff", "emergency management", "security"],
parks: ["parks", "recreation", "park", "open space", "playground", "trails", "sports", "leisure"],
it: ["it", "technology", "tech", "digital", "software", "data", "systems", "cybersecurity", "network"],
legal: ["legal", "attorney", "city attorney", "counsel", "ordinance", "contract", "litigation"],
hr: ["human resources", "hr", "employment", "hiring", "benefits", "labor", "personnel", "workforce"],
engineering: ["engineering", "civil", "capital project", "infrastructure design", "survey", "drainage"],
environment: ["environmental", "sustainability", "recycling", "stormwater", "green", "conservation", "waste"],
"community-dev": ["community development", "economic development", "housing", "grants", "community programs", "cdbg"]
```

**5. Add `searchQuery` state to `Dashboard` — wire search bar**

- Add `const [searchQuery, setSearchQuery] = useState("")` to `Dashboard`.
- Pass `searchQuery` and `setSearchQuery` as props to `TopBar`.
- In `TopBar`, bind `value={searchQuery}` and `onChange={(e) => setSearchQuery(e.target.value)}` to the `<input>`.
- Add a `searchQuery` filter step to `filteredContacts` (or create a derived `displayContacts` memo) that, when `searchQuery` is non-empty, filters contacts whose `name`, municipality `name`, department `name`, or `email` includes the lowercased query string.
- The search filter applies on top of the existing dropdown filters (they compose, not replace).

**6. Add `activePanel` state to `Dashboard` — wire sidebar nav**

- Add `const [activePanel, setActivePanel] = useState<"dashboard" | "contacts" | "tracking" | "verification" | "settings">("dashboard")` to `Dashboard`.
- Pass `activePanel` and `setActivePanel` as props to `SideNav`.
- In `SideNav`, replace the hardcoded `active: true` with `item.panel === activePanel`, and add `onClick={() => setActivePanel(item.panel)}` to each nav button.
- In `<main>`, conditionally render panel groups:
  - `"dashboard"` → current default layout (all panels)
  - `"contacts"` → `FilterBar` + `ContactsTable` + `IntentAssistant`
  - `"tracking"` → `InboxPanel` + `MetricsPanel`
  - `"verification"` → `DepartmentVerificationPanel` + `VerificationPanel`
  - `"settings"` → a placeholder `AdminSettingsPanel` (simple card with "Admin Settings — coming soon")

**7. Wire Sparkle button — smart contact lookup**

- Pass an `onSparkle` callback from `Dashboard` to `FilterBar`.
- In `Dashboard`, implement `handleSparkle`:
  - If `filteredContacts` (after search) has at least one result, scroll to the `ContactsTable` section and briefly highlight the top contact (add a `highlightedContactId` state, set it for 2 seconds, then clear).
  - If no contacts match, set a `sparkleMessage` state string ("No verified contact found for the current filters.") displayed as an inline notice below the FilterBar.
- The Sparkle button in `FilterBar` calls `onSparkle()`.

**8. Wire "View All" button — toggle full contact list**

- Add `const [showAll, setShowAll] = useState(false)` to `ContactsTable` (local state is sufficient).
- Change the contacts slice from `data.contacts.filter(...).slice(0, 5)` to respect `showAll`: when `showAll` is false, show 5 rows; when true, show all.
- The "View All" button toggles `showAll` and updates its label to "Show Less" when expanded.
- Note: the `slice(0, 5)` currently lives in `Dashboard` when passing props to `ContactsTable` (`readyForLookup ? filteredContacts : data.contacts.filter(...).slice(0, 5)`). Move the slicing logic inside `ContactsTable` so the button can control it locally.

**9. Wire "Review Queue" button — activate verification panel**

- Pass `onReviewQueue` callback from `Dashboard` to `VerificationPanel`.
- In `Dashboard`, implement `handleReviewQueue`: set `activePanel` to `"verification"` and scroll to the `DepartmentVerificationPanel` section (using a `ref` or `id`).
- The "Review Queue" button in `VerificationPanel` calls `onReviewQueue()`.

**10. Add "Sync Replies" button to `InboxPanel` — call sync endpoint**

- Add `const [syncState, setSyncState] = useState<"idle" | "syncing" | "done" | "error">("idle")` to `InboxPanel`.
- Add a "Sync Replies" button (with `RefreshCw` icon) to the `InboxPanel` header area.
- On click, call `POST /api/email/sync`, then:
  - On success: set `syncState` to `"done"`, show "Replies synced" for 2 seconds, then reset to `"idle"`. Update thread statuses in local state if the response includes updated threads.
  - On error: set `syncState` to `"error"`, show "Sync failed" for 2 seconds, then reset.
- The `/api/email/sync` route already exists at `app/api/email/sync/route.ts`.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write unit tests that directly query the seed data arrays and assert on their contents. Run these tests against the UNFIXED `seed-data.ts` to observe failures.

**Test Cases**:
1. **Geography gap — state coverage** (will fail on unfixed code): For each of the 50 state IDs, assert `counties.filter(c => c.stateId === stateId).length > 0`. Expect failures for the 40 states not in the original 10.
2. **Geography gap — county coverage** (will fail on unfixed code): For each county ID in `counties`, assert `municipalities.filter(m => m.countyId === countyId).length > 0`. Expect failures for all counties except Bergen NJ and the handful of scattered entries.
3. **Dead button — Sparkle** (will fail on unfixed code): Render `<FilterBar>` with React Testing Library, click the Sparkle button, assert a visible state change occurred. Expect no state change.
4. **Inert search bar** (will fail on unfixed code): Render `<Dashboard>`, type "Cambridge" into the search input, assert the contacts table filters. Expect no change.
5. **Dead nav** (will fail on unfixed code): Render `<Dashboard>`, click "Contact Finder" in the sidebar, assert `activePanel` changes. Expect no change.
6. **Incomplete departments** (will fail on unfixed code): Assert `departments.find(d => d.id === "fire")` is not undefined. Expect undefined on the original 7-department list.

**Expected Counterexamples**:
- `counties.filter(c => c.stateId === "tx")` returns `[]` (only Travis County exists, stateId is "tx" ✓, but many other TX counties are missing)
- `municipalities.filter(m => m.countyId === "travis-tx")` returns only `[austin-city]`
- Sparkle button click produces no DOM change
- Search input change produces no contact list change

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL stateId IN allFiftyStateIds DO
  counties := seed.counties.filter(c => c.stateId === stateId)
  ASSERT counties.length > 0
END FOR

FOR ALL countyId IN seed.counties.map(c => c.id) DO
  municipalities := seed.municipalities.filter(m => m.countyId === countyId)
  ASSERT municipalities.length > 0
END FOR

FOR ALL buttonId IN { "sparkle", "view-all", "review-queue", "sync-replies" } DO
  render(<Dashboard data={seedData} />)
  click(button(buttonId))
  ASSERT visibleStateChange occurred
END FOR

render(<Dashboard data={seedData} />)
type("Cambridge", searchInput)
ASSERT visibleContacts.every(c => matchesQuery(c, "Cambridge"))

FOR ALL navItem IN sidebarNavItems DO
  click(navItem)
  ASSERT activePanel === navItem.panel
END FOR

ASSERT departments.length >= 17
FOR ALL deptId IN requiredDepartmentIds DO
  ASSERT departments.find(d => d.id === deptId) IS NOT NULL
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original.

**Pseudocode:**
```
FOR ALL stateId IN { "ny","nj","ma","ct","pa","ca","tx","fl","il","ga" } DO
  counties_before := original.counties.filter(c => c.stateId === stateId)
  counties_after  := fixed.counties.filter(c => c.stateId === stateId)
  ASSERT counties_before deepEquals counties_after
END FOR

FOR ALL countyId IN originalCountyIds DO
  munis_before := original.municipalities.filter(m => m.countyId === countyId)
  munis_after  := fixed.municipalities.filter(m => m.countyId === countyId)
  ASSERT munis_before deepEquals munis_after
END FOR

contacts_before := original.contacts
contacts_after  := fixed.contacts
ASSERT contacts_before deepEquals contacts_after

FOR ALL query IN existingKeywordQueries DO
  dept_before := recommendDepartment(original.departments, query)
  dept_after  := recommendDepartment(fixed.departments, query)
  ASSERT dept_before.id === dept_after.id
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking of the geography data because:
- It generates many random state/county selections automatically
- It catches edge cases (states with unusual county counts, counties with single municipalities)
- It provides strong guarantees that no existing record was accidentally removed or modified

**Test Cases**:
1. **Existing county preservation**: For each of the 32 original county IDs, assert the fixed `counties` array contains a record with the same `id`, `stateId`, `name`, and `fips`.
2. **Bergen County municipality preservation**: Assert `municipalities.filter(m => m.countyId === "bergen-nj").length === 70` and that all 70 original municipality IDs are still present.
3. **Contact record preservation**: Assert all 9 original contact IDs are present with unchanged fields.
4. **IntentAssistant keyword scoring preservation**: For queries like `"flooring permit"`, `"vendor bid"`, `"school board"`, `"public records"`, assert `recommendDepartment()` returns the same department ID as before.
5. **Email send flow preservation**: Render `<Dashboard>`, open `ComposerDrawer` for an existing contact, submit, assert `POST /api/email/send` is called and a new thread is appended to `InboxPanel`.

### Unit Tests

- Test `counties.filter(c => c.stateId === stateId).length > 0` for all 50 state IDs
- Test `municipalities.filter(m => m.countyId === countyId).length > 0` for all county IDs
- Test `departments.length === 17` and each required department ID is present
- Test `departmentKeywords` has entries for all 17 department IDs
- Test `recommendDepartment(departments, "flooring permit")` returns `building`
- Test `recommendDepartment(departments, "fire code inspection")` returns `fire`
- Test `recommendDepartment(departments, "budget audit")` returns `finance`

### Property-Based Tests

- Generate random state IDs from the 50-state list; for each, assert at least one county exists (fix checking)
- Generate random county IDs from the full county list; for each, assert at least one municipality exists (fix checking)
- Generate random subsets of the original 32 county IDs; assert all are still present in the fixed data (preservation)
- Generate random search query strings; assert that when `searchQuery` is non-empty, every displayed contact matches the query in at least one field (fix checking for search)
- Generate random non-number-key inputs to `recommendDepartment`; assert the result is either undefined or one of the 17 known department IDs (no crash, no phantom departments)

### Integration Tests

- Full filter chain: select "Texas" → select "Travis County" → select "Austin" → select "Building Department" → assert `ContactsTable` renders (even if empty, no crash)
- Search + filter composition: select "NJ" → type "Hackensack" in search bar → assert only Hackensack contacts are visible
- Sidebar nav: click "Response Tracking" → assert `InboxPanel` is the primary visible panel
- Sync Replies: click "Sync Replies" → assert `POST /api/email/sync` was called and feedback message appears
- View All toggle: assert table shows ≤5 rows by default, then shows all rows after clicking "View All", then returns to 5 after clicking "Show Less"
- Review Queue: click "Review Queue" → assert `DepartmentVerificationPanel` is scrolled into view or `activePanel` is `"verification"`
