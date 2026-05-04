export type StateRecord = {
  id: string;
  name: string;
  abbreviation: string;
  fips: string;
};

export type CountyRecord = {
  id: string;
  stateId: string;
  name: string;
  fips: string;
};

export type MunicipalityRecord = {
  id: string;
  countyId: string;
  stateId: string;
  name: string;
  kind: "city" | "town" | "village" | "borough" | "township" | "county-subdivision";
  placeFips: string;
};

export type DepartmentRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

export type ContactRecord = {
  id: string;
  municipalityId: string;
  departmentId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  sourceUrl: string;
  confidence: number;
  verified: boolean;
  lastChecked: string;
};

export type OutreachThread = {
  id: string;
  contactId: string;
  departmentId: string;
  municipalityId: string;
  provider: "gmail" | "outlook";
  subject: string;
  status: "draft" | "sent" | "replied" | "bounced" | "needs_follow_up";
  sentAt: string;
  providerThreadId: string;
};

export type DashboardData = {
  states: StateRecord[];
  counties: CountyRecord[];
  municipalities: MunicipalityRecord[];
  departments: DepartmentRecord[];
  contacts: ContactRecord[];
  threads: OutreachThread[];
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};
