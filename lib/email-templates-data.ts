import type { EmailTemplate } from "./types";

/** Shipped defaults (first-run and “Reset to defaults”). Includes OPRA (NJ) and FOIL (NY) style records requests. */
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "building-permit",
    name: "Building department inquiry",
    subject: "Question about {{municipality}} permit requirements",
    body: "Hi {{contactName}},\n\nI'm reaching out on behalf of {{companyName}}. We are trying to confirm the best process for flooring-related permit or inspection requirements in {{municipality}}.\n\nCould you point me to the right requirements or contact if your department does not handle this directly?\n\nThank you,\n{{senderName}}"
  },
  {
    id: "records-request",
    name: "Public records/list request",
    subject: "Request for municipal list or department contact",
    body: "Hi {{contactName}},\n\nI'm looking for the appropriate department contact or public list related to {{departmentName}} in {{municipality}}.\n\nIf this should be requested through another office or portal, please let me know where to submit it.\n\nThank you,\n{{senderName}}"
  },
  {
    id: "opra-records-request",
    name: "OPRA records request (NJ)",
    subject: "OPRA request — {{municipality}} / {{departmentName}}",
    body: "Hi {{contactName}},\n\nUnder the New Jersey Open Public Records Act (OPRA), N.J.S.A. 47:1A-1 et seq., {{companyName}} requests copies of records held by {{municipality}} concerning {{departmentName}}, specifically:\n\n[Describe the records, date range, block/lot, or subject matter here]\n\nPlease acknowledge receipt, advise of any duplication fees or estimated costs, and let me know if you need clarification. If the custodian of these records is another office, please forward this request or direct me to the correct OPRA clerk.\n\nThank you,\n{{senderName}}\n{{companyName}}"
  },
  {
    id: "foil-records-request",
    name: "FOIL records request (NY)",
    subject: "FOIL request — {{municipality}} / {{departmentName}}",
    body: "Hi {{contactName}},\n\nPursuant to the New York Freedom of Information Law (Public Officers Law Article 6), {{companyName}} requests copies of records maintained by {{municipality}} related to {{departmentName}}, described as follows:\n\n[Describe the records, date range, address, or subject matter here]\n\nPlease confirm receipt, provide an estimated date of determination if not granted in full, and advise of copying fees. If another records access officer handles this request, please forward it or provide their contact information.\n\nThank you,\n{{senderName}}\n{{companyName}}"
  },
  {
    id: "vendor-intro",
    name: "Vendor introduction",
    subject: "{{companyName}} introduction for {{municipality}}",
    body: "Hi {{contactName}},\n\nI wanted to introduce {{companyName}} and ask whether your office keeps a vendor list or procurement contact for {{departmentName}} needs.\n\nI'd appreciate any guidance on the right next step.\n\nBest,\n{{senderName}}"
  },
  {
    id: "follow-up",
    name: "Follow-up",
    subject: "Following up on {{departmentName}} inquiry",
    body: "Hi {{contactName}},\n\nI'm following up on my earlier note about {{departmentName}} in {{municipality}}. Any direction you can share would be appreciated.\n\nThank you,\n{{senderName}}"
  }
];

/** @deprecated Use DEFAULT_EMAIL_TEMPLATES; kept for any legacy imports. */
export const emailTemplates = DEFAULT_EMAIL_TEMPLATES;
