/**
 * Legacy barrel — geography and contacts load at runtime from Census / search APIs.
 */
import type { ContactRecord, CountyRecord, MunicipalityRecord, OutreachThread } from "./types";
import { departments } from "./departments-data";
import { states } from "./states";

export { states, departments };

export const counties: CountyRecord[] = [];
export const municipalities: MunicipalityRecord[] = [];
export const contacts: ContactRecord[] = [];
export const threads: OutreachThread[] = [];

export { emailTemplates } from "./email-templates-data";
