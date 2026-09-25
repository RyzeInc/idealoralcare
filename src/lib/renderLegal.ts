export interface LegalContext {
  brandName: string;
  legalEntityName?: string;
  supportEmail: string;
  supportPhone: string;
  website: string;
  portalUrl: string;
  address?: string;
}

// Literals as they appear in src/legal/*.md — each is swapped for the site's value.
const IDEAL_BRAND = "Ideal Oral Health";
const IDEAL_ENTITY = "Ideal LLC";
const IDEAL_SUPPORT = "support@getidealoh.com";
const IDEAL_PHONE = "(844) 679-9367";
const IDEAL_ADDRESS_LINE1 = "1846 Fernando Ln";
const IDEAL_ADDRESS_LINE2 = "Tallahassee, FL 32303";

export function renderLegal(content: string, ctx: LegalContext): string {
  const entityName = ctx.legalEntityName ?? ctx.brandName;
  let out = content;

  // Brand name (must come before entity name to avoid double-replace)
  out = out.replace(new RegExp(`${IDEAL_BRAND} \\(${IDEAL_ENTITY}\\)`, "g"), `${ctx.brandName} (${entityName})`);
  out = out.replace(new RegExp(IDEAL_BRAND, "g"), ctx.brandName);
  out = out.replace(new RegExp(IDEAL_ENTITY, "g"), entityName);

  // Contact
  out = out.replace(new RegExp(IDEAL_SUPPORT, "g"), ctx.supportEmail);
  out = out.replace(new RegExp(IDEAL_PHONE.replace(/[()]/g, "\\$&"), "g"), ctx.supportPhone);

  // Address
  if (ctx.address) {
    out = out.replace(new RegExp(IDEAL_ADDRESS_LINE1, "g"), ctx.address);
    out = out.replace(new RegExp(IDEAL_ADDRESS_LINE2, "g"), "");
  }

  // URLs
  out = out.replace(/https?:\/\/www\.getidealoh\.com\/health\/dashboard/g, ctx.portalUrl);
  out = out.replace(/https?:\/\/www\.getidealoh\.com/g, ctx.website);
  out = out.replace(/https?:\/\/getidealoh\.com/g, ctx.website);
  out = out.replace(/www\.getidealoh\.com/g, ctx.website.replace(/^https?:\/\//, ""));

  return out;
}
