/** The debug route and production sender share the same template registry. */
import { EMAIL_TEMPLATES, type FulfillmentEmailData } from "@/convex/lib/emailTemplates";

export function generateFulfillmentEmailHTML(data: FulfillmentEmailData): string {
  return EMAIL_TEMPLATES["fulfillment-packet"].render(data).html;
}
