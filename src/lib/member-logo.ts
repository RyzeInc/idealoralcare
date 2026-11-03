import fs from "node:fs";
import path from "node:path";
import type { MemberBrand } from "@/convex/lib/memberBrand";

/** Bundled artwork or this deployment's uploaded logo; never fetch arbitrary hosts. */
export function memberLogoDataUri(brand?: MemberBrand): string | undefined {
  const logo = brand ? brand.logoUrl : "/ideal-oral-health-logo.png";
  if (!logo) return undefined;
  const root = path.resolve(process.cwd(), "public");
  if (logo.startsWith("/") && !logo.startsWith("//")) {
    const file = path.resolve(root, `.${logo}`);
    if (!file.startsWith(`${root}${path.sep}`) || !/\.png$/i.test(file) || !fs.existsSync(file)) return undefined;
    return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  }
  try {
    const url = new URL(logo);
    if (process.env.NEXT_PUBLIC_CONVEX_URL && url.origin === new URL(process.env.NEXT_PUBLIC_CONVEX_URL).origin && url.pathname.startsWith("/api/storage/") && !url.username && !url.password) return url.href;
  } catch { /* The PDF retains the site's text branding when artwork is unavailable. */ }
  return undefined;
}
