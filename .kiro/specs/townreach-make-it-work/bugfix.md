# Bugfix Requirements Document

## Introduction

The TownReach Municipal Outreach SaaS dashboard is a Next.js application that allows users to find verified municipal department contacts, compose outreach emails, and track replies. The app is currently non-functional in several critical areas: the geography filter chain (state → county → municipality) is broken for 40 of 50 states due to missing seed data; the department list is incomplete; multiple interactive buttons have no handlers; the top search bar is inert; sidebar navigation does nothing; fonts never load; and the inbox has no way to trigger a reply sync. The result is an app that looks complete but cannot be used for its core purpose across most of the United States.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user selects any US state that is not NY, NJ, MA, CT, PA, CA, TX, FL, IL, or GA THEN the system shows an empty county dropdown, making the entire filter chain (county → municipality → department → contacts) non-functional for that state.

1.2 WHEN a user selects a county that is not Bergen County NJ THEN the system shows an empty municipality dropdown (or at most one or two entries), preventing any town-level contact lookup for that county.

1.3 WHEN a user clicks the Sparkle (✨) button in the FilterBar THEN the system does nothing — the button has no `onClick` handler and produces no response.

1.4 WHEN a user clicks the "View All" button in the ContactsTable header THEN the system does nothing — the button has no `onClick` handler.

1.5 WHEN a user clicks the "Review Queue" button in the VerificationPanel THEN the system does nothing — the button has no `onClick` handler.

1.6 WHEN a user types into the top search bar in TopBar THEN the system does nothing — the input has no `onChange` handler, no state binding, and no search logic.

1.7 WHEN a user clicks any sidebar navigation item (Dashboard, Contact Finder, Response Tracking, Data Verification, Admin Settings) THEN the system does nothing — none of the nav buttons have routing or panel-switching logic.

1.8 WHEN the application loads THEN the system renders all text in system fallback fonts because `app/layout.tsx` contains no Google Fonts import or `<link>` tag, so Manrope (display) and Inter (body) are never loaded.

1.9 WHEN a user views the InboxPanel THEN the system shows static thread data with no way to trigger a reply sync — the `/api/email/sync` endpoint exists but there is no "Sync Replies" button or equivalent UI trigger in the panel.

1.10 WHEN a user selects a municipality and views the Department Verification panel THEN the system shows only 7 departments (Building, Planning, Public Works, Clerk, Procurement, Health, Education), omitting standard municipal departments that real governments operate (Finance/Treasury, Fire, Police/Public Safety, Parks & Recreation, IT/Technology, Legal/City Attorney, Human Resources, Engineering, Environmental Services, Community Development).

### Expected Behavior (Correct)

2.1 WHEN a user selects any of the 50 US states THEN the system SHALL populate the county dropdown with all counties for that state, enabling the full filter chain to function.

2.2 WHEN a user selects any county THEN the system SHALL populate the municipality dropdown with all cities, towns, villages, boroughs, and townships within that county, enabling town-level contact lookup.

2.3 WHEN a user clicks the Sparkle (✨) button THEN the system SHALL trigger a smart lookup using the currently selected filters (state, county, municipality, department) and surface the best matching verified contact, or display a helpful message if none is found.

2.4 WHEN a user clicks the "View All" button in the ContactsTable THEN the system SHALL expand the contacts table to show all matching verified contacts (removing the default 5-row cap when no exact lookup is active).

2.5 WHEN a user clicks the "Review Queue" button in the VerificationPanel THEN the system SHALL display a list of municipalities or contacts that are flagged as unverified or needing re-verification, or navigate to the Data Verification panel.

2.6 WHEN a user types into the top search bar THEN the system SHALL filter the visible contacts table in real time, matching against contact name, municipality name, department name, and email address.

2.7 WHEN a user clicks a sidebar navigation item THEN the system SHALL switch the main content area to the corresponding panel or section (Dashboard overview, Contact Finder, Response Tracking, Data Verification, Admin Settings).

2.8 WHEN the application loads THEN the system SHALL render display text in Manrope and body text in Inter by loading both fonts from Google Fonts via the Next.js layout.

2.9 WHEN a user clicks a "Sync Replies" button in the InboxPanel THEN the system SHALL call `POST /api/email/sync`, update the thread list with any newly synced reply statuses, and show a brief confirmation or error message.

2.10 WHEN a user selects a municipality and views the Department Verification panel THEN the system SHALL display the full standard set of municipal departments including Finance/Treasury, Fire Department, Police/Public Safety, Parks & Recreation, IT/Technology, Legal/City Attorney, Human Resources, Engineering, Environmental Services, and Community Development in addition to the existing seven.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user selects NY, NJ, MA, CT, PA, CA, TX, FL, IL, or GA THEN the system SHALL CONTINUE TO populate counties and municipalities exactly as it does today, with no regressions to existing county or municipality records.

3.2 WHEN a user selects Bergen County NJ THEN the system SHALL CONTINUE TO list all 70 existing Bergen County boroughs and townships in the municipality dropdown.

3.3 WHEN a user has all four filters selected (state, county, municipality, department) and verified contacts exist THEN the system SHALL CONTINUE TO display those contacts in the ContactsTable sorted by confidence score.

3.4 WHEN a user clicks an email (✉) button on a contact row THEN the system SHALL CONTINUE TO open the ComposerDrawer pre-populated with that contact's details.

3.5 WHEN a user fills in the ComposerDrawer and clicks "Send through user inbox" THEN the system SHALL CONTINUE TO call `POST /api/email/send`, create a new thread record, and append it to the InboxPanel thread list.

3.6 WHEN a user types in the IntentAssistant fields ("Who are you looking for?" and "What is it about?") THEN the system SHALL CONTINUE TO recommend a department and best matching contact based on keyword scoring.

3.7 WHEN a user clicks "Use Department" in the IntentAssistant THEN the system SHALL CONTINUE TO set the department filter to the recommended department.

3.8 WHEN a user clicks "Email Contact" in the IntentAssistant THEN the system SHALL CONTINUE TO open the ComposerDrawer for the recommended contact.

3.9 WHEN the app runs without Supabase or OAuth credentials configured THEN the system SHALL CONTINUE TO operate fully in local/seed mode using in-memory data, with no errors or broken states due to missing environment variables.

3.10 WHEN a user selects a municipality in the Department Verification panel THEN the system SHALL CONTINUE TO show "Verified" or "Needs verification" status per department based on whether a verified contact exists for that municipality and department combination.

---

## Bug Condition Pseudocode

### Bug Condition Functions

```pascal
FUNCTION isEmptyCountyDropdown(stateId)
  INPUT: stateId of type string
  OUTPUT: boolean
  RETURN stateId NOT IN { "ny", "nj", "ma", "ct", "pa", "ca", "tx", "fl", "il", "ga" }
END FUNCTION

FUNCTION isEmptyMunicipalityDropdown(countyId)
  INPUT: countyId of type string
  OUTPUT: boolean
  RETURN countyId NOT IN bergenMunicipalities AND countyId NOT IN scatteredMunicipalities
END FUNCTION

FUNCTION isDeadButton(buttonId)
  INPUT: buttonId of type string
  OUTPUT: boolean
  RETURN buttonId IN { "sparkle", "view-all", "review-queue", "sync-replies" }
         AND button.onClick IS NULL
END FUNCTION

FUNCTION isInertSearchBar()
  OUTPUT: boolean
  RETURN topBarSearchInput.onChange IS NULL
         AND topBarSearchInput.value IS UNCONTROLLED
END FUNCTION

FUNCTION isDeadNavItem(navLabel)
  INPUT: navLabel of type string
  OUTPUT: boolean
  RETURN navItem.onClick IS NULL
         AND navItem.active IS HARDCODED
END FUNCTION

FUNCTION isMissingFont()
  OUTPUT: boolean
  RETURN layout.tsx CONTAINS NO googleFontsImport
         AND layout.tsx CONTAINS NO fontLinkTag
END FUNCTION

FUNCTION isIncompleteDepartmentList(departments)
  INPUT: departments of type DepartmentRecord[]
  OUTPUT: boolean
  RETURN departments.length < 17
         OR "finance" NOT IN departments.map(d => d.id)
         OR "fire" NOT IN departments.map(d => d.id)
         OR "police" NOT IN departments.map(d => d.id)
END FUNCTION
```

### Fix Checking Properties

```pascal
// Property: Fix Checking — Geography Data Completeness
FOR ALL stateId IN allFiftyStateIds DO
  counties ← getCountiesForState(stateId)
  ASSERT counties.length > 0
END FOR

FOR ALL countyId IN allCountyIds DO
  municipalities ← getMunicipalitiesForCounty(countyId)
  ASSERT municipalities.length > 0
END FOR

// Property: Fix Checking — Button Handlers
FOR ALL buttonId IN { "sparkle", "view-all", "review-queue", "sync-replies" } DO
  button ← getButton(buttonId)
  ASSERT button.onClick IS NOT NULL
  result ← simulateClick(button)
  ASSERT result.producedVisibleEffect = true
END FOR

// Property: Fix Checking — Search Bar
input ← getTopBarSearchInput()
ASSERT input.onChange IS NOT NULL
simulateTyping(input, "Cambridge")
ASSERT visibleContacts CONTAINS contactsMatchingQuery("Cambridge")

// Property: Fix Checking — Sidebar Navigation
FOR ALL navItem IN sidebarNavItems DO
  simulateClick(navItem)
  ASSERT activePanel = navItem.targetPanel
END FOR

// Property: Fix Checking — Font Loading
layout ← parseLayoutFile()
ASSERT layout CONTAINS googleFontsImport("Manrope")
ASSERT layout CONTAINS googleFontsImport("Inter")

// Property: Fix Checking — Department Completeness
departments ← getDepartments()
ASSERT departments.length >= 17
FOR ALL requiredDept IN standardMunicipalDepartments DO
  ASSERT departments.find(d => d.id = requiredDept.id) IS NOT NULL
END FOR
```

### Preservation Checking Property

```pascal
// Property: Preservation Checking — Existing Geography
FOR ALL stateId IN { "ny", "nj", "ma", "ct", "pa", "ca", "tx", "fl", "il", "ga" } DO
  counties_before ← getCountiesForState_original(stateId)
  counties_after  ← getCountiesForState_fixed(stateId)
  ASSERT counties_before = counties_after
END FOR

FOR ALL countyId IN existingCountyIds DO
  municipalities_before ← getMunicipalitiesForCounty_original(countyId)
  municipalities_after  ← getMunicipalitiesForCounty_fixed(countyId)
  ASSERT municipalities_before = municipalities_after
END FOR

// Property: Preservation Checking — Existing Contacts and Threads
contacts_before ← getContacts_original()
contacts_after  ← getContacts_fixed()
ASSERT contacts_before = contacts_after

threads_before ← getThreads_original()
threads_after  ← getThreads_fixed()
ASSERT threads_before = threads_after

// Property: Preservation Checking — Email Send Flow
FOR ALL contact IN verifiedContacts DO
  result_before ← simulateSend_original(contact)
  result_after  ← simulateSend_fixed(contact)
  ASSERT result_before.ok = result_after.ok
  ASSERT result_before.thread.status = result_after.thread.status
END FOR

// Property: Preservation Checking — IntentAssistant Keyword Scoring
FOR ALL query IN existingKeywordQueries DO
  dept_before ← recommendDepartment_original(departments, query)
  dept_after  ← recommendDepartment_fixed(departments, query)
  ASSERT dept_before.id = dept_after.id
END FOR
```
