import type { DepartmentRecord } from "./types";

/** Standard municipal functions (national). Used as search targets—not a live org chart per place. */
export const departments: DepartmentRecord[] = [
  { id: "building", name: "Building / Permits", slug: "building", description: "Permits, inspections, code compliance, contractors." },
  { id: "planning", name: "Planning & Zoning", slug: "planning", description: "Zoning, land use, site plans, variances." },
  { id: "public-works", name: "Public Works", slug: "public-works", description: "Streets, water, sewer, sanitation, fleet." },
  { id: "clerk", name: "Town / City Clerk", slug: "clerk", description: "Records, licenses, agendas, public notices." },
  { id: "procurement", name: "Procurement / Purchasing", slug: "procurement", description: "Bids, RFPs, vendor registration, contracts." },
  { id: "health", name: "Public Health", slug: "health", description: "Environmental health, licensing, programs." },
  { id: "education", name: "School District / Board", slug: "education", description: "District administration and school boards." },
  { id: "finance", name: "Finance / Treasurer", slug: "finance", description: "Budget, accounting, tax, treasury." },
  { id: "fire", name: "Fire / EMS", slug: "fire", description: "Fire prevention, EMS, emergency response." },
  { id: "police", name: "Police / Public Safety", slug: "police", description: "Law enforcement, emergency management." },
  { id: "parks", name: "Parks & Recreation", slug: "parks", description: "Parks, recreation programs, facilities." },
  { id: "it", name: "Information Technology", slug: "it", description: "Digital services, GIS, cybersecurity." },
  { id: "legal", name: "City / Town Attorney", slug: "legal", description: "Legal counsel, contracts, ordinances." },
  { id: "hr", name: "Human Resources", slug: "hr", description: "Employment, benefits, labor relations." },
  { id: "engineering", name: "Engineering", slug: "engineering", description: "Civil engineering, capital projects, utilities." },
  { id: "environment", name: "Environmental Services", slug: "environment", description: "Stormwater, sustainability, solid waste." },
  { id: "community-dev", name: "Community / Economic Development", slug: "community-dev", description: "Housing, grants, business development." },
  { id: "assessor", name: "Assessor / Appraisal", slug: "assessor", description: "Property valuation, assessments, appeals." },
  { id: "city-manager", name: "City / Town Manager", slug: "city-manager", description: "Chief administrative officer, executive office." },
  { id: "housing", name: "Housing Authority", slug: "housing", description: "Affordable housing, vouchers, programs." },
  { id: "code-enforcement", name: "Code Enforcement", slug: "code-enforcement", description: "Nuisance, property maintenance, zoning violations." },
  { id: "airport", name: "Airport / Aviation", slug: "airport", description: "Municipal or regional airport authority." },
  { id: "utilities", name: "Municipal Utilities", slug: "utilities", description: "Electric, gas, or combined utility operations." },
  { id: "library", name: "Library", slug: "library", description: "Public library administration." },
  { id: "court", name: "Municipal Court", slug: "court", description: "Local court administration." }
];
