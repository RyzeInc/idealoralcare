'use client';

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminCommandPalette } from "./AdminCommandPalette";

/**
 * The admin console's frame: navigation rail, top bar, and the Cmd-K palette.
 *
 * Split out of the server layout because all three need client state, and
 * because the rail had a concrete problem worth naming: it was a
 * `min-h-screen w-64` element in normal flow, which meant it scrolled away
 * with the page on long tables and took up a quarter of a phone screen with no
 * way to dismiss it. Here it is a fixed-height sticky column on large screens
 * and a dismissible drawer below that.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Navigating is the signal that the drawer has done its job. Adjusted during
  // render rather than in an effect — an effect would paint the new page with
  // the drawer still covering it for a frame, and would re-render twice.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  // Cmd-K lives here rather than in the palette so the toolbar button and the
  // shortcut toggle one piece of state.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // The drawer covers the page; letting the page behind it scroll is how you
  // lose your place in a table you were halfway down.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Desktop rail — sticky so navigation stays put on long pages. */}
      <div className="hidden lg:block flex-shrink-0">
        <div className="sticky top-0 h-screen">
          <AdminSidebar />
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full shadow-xl">
            <AdminSidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-slate-900 focus:px-3 focus:py-1.5 focus:rounded focus:shadow"
        >
          Skip to main content
        </a>

        {/* Top bar. Slim on purpose — pages carry their own breadcrumbs and
            headings, so this only holds what the page cannot: the drawer
            toggle and a visible handle on the palette, which otherwise nobody
            discovers. */}
        <header className="sticky top-0 z-30 flex items-center gap-3 h-12 px-4 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            className="lg:hidden -ml-1 p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu size={18} />
          </button>

          <span className="lg:hidden text-sm font-semibold text-slate-800">Admin</span>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
          >
            <Search size={14} aria-hidden />
            <span className="text-sm">Search</span>
            <kbd className="hidden sm:inline text-[10px] font-sans text-slate-400 border border-slate-200 rounded px-1 py-0.5">
              ⌘K
            </kbd>
          </button>
        </header>

        <main className="flex-1">
          <div id="admin-main" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>

      <AdminCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
