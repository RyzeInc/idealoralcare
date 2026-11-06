export interface CheckoutProfile {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  phone?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export function normalizeCheckoutProfile(
  input: unknown,
): CheckoutProfile | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Record<string, unknown>;
  const address = p.address as Record<string, unknown> | undefined;
  if (!address || typeof address !== "object") return null;
  const clean = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  const dob = clean(p.dateOfBirth);
  const match = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = match ? `${match[3]}-${match[1]}-${match[2]}` : dob;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== iso ||
    date > new Date() ||
    Number(iso.slice(0, 4)) < 1900
  )
    return null;
  const phone = clean(p.phone).replace(/\D/g, "");
  if (
    phone &&
    !(phone.length === 10 || (phone.length === 11 && phone.startsWith("1")))
  )
    return null;
  const firstName = clean(p.firstName),
    lastName = clean(p.lastName);
  const line1 = clean(address.line1),
    city = clean(address.city),
    state = clean(address.state).toUpperCase(),
    postalCode = clean(address.postalCode);
  if (
    !firstName ||
    !lastName ||
    !line1 ||
    !city ||
    !/^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$/.test(
      state,
    ) ||
    !/^\d{5}(?:-\d{4})?$/.test(postalCode)
  )
    return null;
  return {
    firstName,
    lastName,
    dateOfBirth: iso,
    gender: clean(p.gender),
    phone: phone ? `+${phone.length === 10 ? "1" : ""}${phone}` : "",
    address: {
      line1,
      line2: clean(address.line2),
      city,
      state,
      postalCode,
      country: "US",
    },
  };
}

export function checkoutAddress(profile: CheckoutProfile) {
  return [
    profile.address.line1,
    profile.address.line2,
    profile.address.city,
    profile.address.state,
    profile.address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}
