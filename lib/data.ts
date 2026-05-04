import { contacts, counties, departments, municipalities, states, threads } from "./seed-data";
import type { ContactRecord, DashboardData } from "./types";

export function getInitialDashboardData(): DashboardData {
  return {
    states,
    counties,
    municipalities,
    departments,
    contacts,
    threads
  };
}

export function findContacts(params: {
  stateId?: string | null;
  countyId?: string | null;
  municipalityId?: string | null;
  departmentId?: string | null;
}): ContactRecord[] {
  return contacts
    .filter((contact) => {
      const municipality = municipalities.find((item) => item.id === contact.municipalityId);
      if (!municipality || !contact.verified) return false;
      if (params.stateId && municipality.stateId !== params.stateId) return false;
      if (params.countyId && municipality.countyId !== params.countyId) return false;
      if (params.municipalityId && contact.municipalityId !== params.municipalityId) return false;
      if (params.departmentId && contact.departmentId !== params.departmentId) return false;
      return true;
    })
    .sort((a, b) => b.confidence - a.confidence);
}

export function tokenReplace(value: string, variables: Record<string, string | undefined>) {
  return value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? "");
}
