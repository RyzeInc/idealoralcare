/**
 * Agent Slug Route
 * 
 * Handles URLs like /jamesgregory to auto-select an agent
 * Redirects to /health/plans with the agent's rep code pre-filled
 */

import { redirect, notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

// Reserved paths that should not be treated as agent slugs
const RESERVED_PATHS = [
  "admin",
  "api",
  "health",
  "bootstrap",
  "debug",
  "login",
  "signup",
  "sign-in",
  "sign-up",
  "about",
  "contact",
  "privacy",
  "terms",
  "legal",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
];

interface PageProps {
  params: Promise<{ agentSlug: string }>;
}

export default async function AgentSlugPage({ params }: PageProps) {
  const { agentSlug } = await params;
  
  // Check if this is a reserved path
  if (RESERVED_PATHS.includes(agentSlug.toLowerCase())) {
    notFound();
  }

  // Create Convex HTTP client for server-side query
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("NEXT_PUBLIC_CONVEX_URL not configured");
    notFound();
  }

  const client = new ConvexHttpClient(convexUrl);
  // Use bracket notation for nested module paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentsApi = (api as any)["enrollment/agents"];

  try {
    // Look up agent by slug
    const agent = await client.query(agentsApi.getAgentBySlug, {
      slug: agentSlug,
    });

    if (agent && agent.repCode) {
      // Redirect to plans page with rep code
      redirect(`/health/plans?ref=${encodeURIComponent(agent.repCode)}`);
    }
  } catch (error) {
    console.error("Error looking up agent:", error);
  }

  // Agent not found - show 404
  notFound();
}

// Generate static params for known agents (optional optimization)
// Can be enabled later if there are many agents
// export async function generateStaticParams() {
//   const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
//   if (!convexUrl) return [];
//   
//   const client = new ConvexHttpClient(convexUrl);
//   const agents = await client.query(api["enrollment/agents"].listPublicAgents);
//   
//   return agents.map((agent) => ({
//     agentSlug: agent.slug,
//   }));
// }
