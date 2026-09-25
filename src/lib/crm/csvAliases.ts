/**
 * Header-matching aliases for the CRM CSV importer's auto-mapping suggestion.
 * Matching is case-insensitive, whitespace/punctuation-collapsed.
 */

export type ContactField =
  | 'firstName' | 'lastName' | 'fullName' | 'jobTitle' | 'companyName'
  | 'email' | 'mobilePhone' | 'officePhone' | 'city' | 'state' | 'linkedinUrl';

export const FIELD_LABELS: Record<ContactField, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  fullName: 'Full Name',
  jobTitle: 'Job Title',
  companyName: 'Company',
  email: 'Email',
  mobilePhone: 'Mobile Phone',
  officePhone: 'Office Phone',
  city: 'City',
  state: 'State',
  linkedinUrl: 'LinkedIn URL',
};

const ALIASES: Record<ContactField, string[]> = {
  firstName: ['first name', 'first', 'fname', 'given name', 'contact first'],
  lastName: ['last name', 'last', 'lname', 'surname', 'family name'],
  fullName: ['name', 'full name', 'contact', 'contact name'],
  jobTitle: ['title', 'job title', 'position', 'role', 'designation'],
  companyName: ['company', 'organization', 'org', 'employer', 'account', 'business', 'company name'],
  email: ['email', 'e-mail', 'work email', 'business email', 'email address'],
  mobilePhone: ['mobile', 'cell', 'cell phone', 'direct', 'direct dial', 'mobile phone'],
  officePhone: ['phone', 'office', 'work phone', 'main', 'company phone', 'telephone'],
  city: ['city', 'town', 'locality'],
  state: ['state', 'st', 'province', 'region'],
  linkedinUrl: ['linkedin', 'linkedin url', 'li profile'],
};

function normalize(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

/** Best-guess field for a raw CSV header, or null if nothing matches closely enough. */
export function suggestField(header: string): ContactField | null {
  const norm = normalize(header);
  for (const [field, aliases] of Object.entries(ALIASES) as [ContactField, string[]][]) {
    if (aliases.includes(norm)) return field;
  }
  return null;
}
