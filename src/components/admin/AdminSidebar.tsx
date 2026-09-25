'use client';

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuth, UserButton } from "@clerk/nextjs";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  activeHref,
  matchesQuery,
  visibleNavigation,
  type AdminNavSection,
} from "@/lib/admin-nav";
import { navIcon } from "./nav-icons";

const COLLAPSE_KEY = "admin-nav-collapsed-sections";

/**
 * Which sections are folded away, held in localStorage and read through
 * useSyncExternalStore.
 *
 * An external store rather than component state for two reasons. The shell
 * mounts this sidebar twice — the desktop rail and the mobile drawer — and a
 * store keeps them in agreement without lifting anything. And it is the one
 * pattern React supports for state that legitimately differs between the
 * server render and the first client render: `getServerSnapshot` returns
 * empty, the client re-reads after hydration, and no mismatch is reported.
 *
 * `snapshot` is cached against the raw string because getSnapshot must return
 * a stable reference — parsing fresh on every call would loop forever.
 */
const NO_SECTIONS: string[] = [];
let snapshot: string[] = NO_SECTIONS;
let snapshotSource: string | null = null;
const listeners = new Set<() => void>();

function readCollapsed(): string[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(COLLAPSE_KEY);
  } catch {
    // Storage blocked entirely. Nothing to cache against, so answer the same
    // stable value every time.
    return NO_SECTIONS;
  }

  if (raw === snapshotSource) return snapshot;
  snapshotSource = raw;

  try {
    const parsed = raw ? JSON.parse(raw) : [];
    snapshot = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : NO_SECTIONS;
  } catch {
    // Unparseable — someone hand-edited it, or a past version wrote a
    // different shape. The assignment matters as much as the fallback: the
    // cache key was already advanced above, so *returning* a default while
    // leaving `snapshot` stale would make two calls in one render disagree,
    // which React reports as an uncached getSnapshot.
    snapshot = NO_SECTIONS;
  }

  return snapshot;
}

function subscribeCollapsed(onChange: () => void): () => void {
  listeners.add(onChange);
  // "storage" only fires for *other* tabs; same-tab writes notify directly.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeCollapsed(next: string[]): void {
  snapshot = next;
  const raw = JSON.stringify(next);
  snapshotSource = raw;
  try {
    window.localStorage.setItem(COLLAPSE_KEY, raw);
  } catch {
    // Private browsing and full quotas both throw here. Losing the preference
    // is acceptable; losing the click is not, so the snapshot is already
    // updated above and the fold still happens.
  }
  for (const listener of listeners) listener();
}

/**
 * The admin console's primary navigation.
 *
 * Twenty-eight destinations across eight sections is past the point where a
 * flat scrolling list works — so this adds the two things that make a list
 * that size navigable: a filter, and sections you can fold away. Both are
 * cosmetic; the role gating below them is not, and is duplicated on the server
 * for every page and Convex function they lead to.
 *
 * Rendered twice by AdminShell — once as the desktop rail, once inside the
 * mobile drawer — so `onNavigate` exists to let the drawer close itself on a
 * link click. Collapse state is shared through localStorage, which is also
 * what survives a reload.
 */
export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const { isLoaded } = useAuth();
  // "skip" until Clerk is ready, so we never fire an unauthenticated query.
  const profile = useQuery(api.admin.adminUsers.getMyAdminProfile, isLoaded ? {} : "skip");
  const isOwner = profile?.role === "owner";
  const isStaff = profile !== null && profile !== undefined;

  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => NO_SECTIONS);

  const sections: AdminNavSection[] = useMemo(
    () => visibleNavigation({ isOwner, isStaff }),
    [isOwner, isStaff],
  );

  const allHrefs = useMemo(
    () => sections.flatMap((section) => section.items.map((item) => item.href)),
    [sections],
  );
  const active = activeHref(pathname, allHrefs);

  const filtered = useMemo(() => {
    if (!query.trim()) return sections;
    return sections
      .map((section) => ({
        section: section.section,
        items: section.items.filter((item) => matchesQuery(item, section.section, query)),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, query]);

  const toggleSection = (name: string) => {
    writeCollapsed(collapsed.includes(name) ? collapsed.filter((s) => s !== name) : [...collapsed, name]);
  };

  const searching = query.trim().length > 0;
  const resultCount = filtered.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="w-64 h-full bg-slate-900 text-white flex flex-col">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-700/60 flex-shrink-0">
        <Link href="/admin" onClick={onNavigate} className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-sm font-bold">
            IH
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight group-hover:text-blue-200 transition-colors">
              Ideal Health
            </p>
            <p className="text-[11px] text-slate-400 leading-tight">Admin Portal</p>
          </div>
        </Link>
      </div>

      {/* Filter */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                searchRef.current?.blur();
              }
            }}
            placeholder="Filter menu…"
            aria-label="Filter admin navigation"
            className="w-full bg-slate-800/70 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto" aria-label="Admin navigation">
        {!isLoaded && <div className="px-3 py-2 text-xs text-slate-400">Loading…</div>}

        {isLoaded && searching && (
          <p className="px-3 pb-2 text-[10px] uppercase tracking-wider text-slate-500" role="status">
            {resultCount === 0 ? "No matches" : `${resultCount} match${resultCount === 1 ? "" : "es"}`}
          </p>
        )}

        {isLoaded &&
          filtered.map((section, idx) => {
            // A filtered section always shows its hits — a collapsed section
            // that silently swallows a match would make the filter look broken.
            const isCollapsed = !searching && collapsed.includes(section.section);
            const showHeader = section.section !== "Overview" || searching;

            return (
              <div key={section.section} className={idx > 0 ? "mt-4" : ""}>
                {showHeader && (
                  <button
                    type="button"
                    onClick={() => !searching && toggleSection(section.section)}
                    disabled={searching}
                    aria-expanded={!isCollapsed}
                    className="w-full flex items-center gap-1 px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 disabled:hover:text-slate-500 disabled:cursor-default transition-colors"
                  >
                    <ChevronDown
                      size={11}
                      aria-hidden
                      className={`transition-transform ${isCollapsed ? "-rotate-90" : ""} ${searching ? "opacity-0" : ""}`}
                    />
                    <span>{section.section}</span>
                  </button>
                )}

                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = navIcon(item.icon);
                      const isActive = active === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onNavigate}
                          title={item.tooltip}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            isActive
                              ? "bg-blue-600 text-white font-medium"
                              : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                          }`}
                        >
                          <Icon
                            size={18}
                            className={`flex-shrink-0 ${isActive ? "opacity-100" : "opacity-70"}`}
                          />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-700/60 flex-shrink-0 space-y-1">
        <div className="flex items-center gap-3 px-3 py-1.5">
          <UserButton
            appearance={{ elements: { avatarBox: "w-7 h-7" } }}
            afterSignOutUrl="/health"
          />
          <span className="text-xs text-slate-400 truncate">
            {profile?.name ?? profile?.email ?? "Signed in"}
          </span>
        </div>
        <Link
          href="/health"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
        >
          <ArrowLeft size={16} className="flex-shrink-0" />
          <span>Back to Site</span>
        </Link>
      </div>
    </div>
  );
}
