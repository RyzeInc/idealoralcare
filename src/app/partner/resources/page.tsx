"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Download, ExternalLink, FileText, Image as ImageIcon, Film, Search,
  Star, Loader2, FileSpreadsheet, Presentation, FileSignature, Clock,
} from "lucide-react";
import { ScopeBanner, SectionHeader } from "@/components/insights";
import { formatDate } from "@/lib/admin-format";

/**
 * The partner resource library.
 *
 * Downloads go through a mutation rather than a plain link because a Convex
 * storage URL is a bearer credential — it is minted per click, after the
 * server re-checks that this viewer is entitled to this resource, and the
 * download is recorded.
 */

type Item = {
  _id: Id<"partnerResources">;
  title: string;
  description?: string;
  category: string;
  categoryLabel: string;
  kind: "file" | "link";
  fileName?: string;
  contentType?: string;
  fileSizeBytes?: number;
  externalUrl?: string;
  featured: boolean;
  version?: number;
  updatedAt: number;
};

function iconFor(item: Item) {
  if (item.kind === "link") return ExternalLink;
  const t = `${item.contentType ?? ""} ${item.fileName ?? ""}`.toLowerCase();
  if (/(png|jpe?g|gif|svg|webp|image)/.test(t)) return ImageIcon;
  if (/(mp4|mov|webm|video)/.test(t)) return Film;
  if (/(xlsx?|csv|sheet)/.test(t)) return FileSpreadsheet;
  if (/(pptx?|presentation|keynote)/.test(t)) return Presentation;
  return FileText;
}

function formatSize(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PartnerResources() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const library = useQuery(api.resources.library.listForViewer, {
    search: search || undefined,
    category: category || undefined,
  });
  const counts = useQuery(api.resources.library.getCategoryCounts);
  const agreement = useQuery(api.resources.agreement.getMine);
  const getDownloadUrl = useMutation(api.resources.library.getDownloadUrl);
  const getAgreementUrl = useMutation(api.resources.agreement.getMineDownloadUrl);

  const handleOpen = async (item: Item) => {
    setBusyId(String(item._id));
    setError(null);
    try {
      const result = await getDownloadUrl({ resourceId: item._id });
      if (!result?.url) {
        setError("That resource is no longer available. Refresh and try again.");
        return;
      }
      if (item.kind === "link") {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        // Anchor rather than window.open so the browser downloads with the
        // original filename instead of navigating to a storage URL.
        const a = document.createElement("a");
        a.href = result.url;
        a.download = result.fileName ?? item.title;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      setError("Could not start that download. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenAgreement = async () => {
    setBusyId("agreement");
    setError(null);
    try {
      const result = await getAgreementUrl({});
      if (!result?.url) {
        setError("Your signed agreement is not ready yet. Please try again shortly.");
        return;
      }
      const a = document.createElement("a");
      a.href = result.url;
      a.download = result.fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setError("Could not open your agreement. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const loading = library === undefined;
  // The agreement is not part of the library, so an otherwise-empty library
  // is not an empty page when a partner has one.
  const isEmpty = !loading && library.total === 0 && !agreement;
  // Belongs with the partner kit — shown unfiltered or under that category.
  const showAgreement = !!agreement && !search && (!category || category === "partner_kit");

  const Card = ({ item }: { item: Item }) => {
    const Icon = iconFor(item);
    const busy = busyId === String(item._id);
    const size = formatSize(item.fileSizeBytes);
    return (
      <button
        type="button"
        onClick={() => handleOpen(item)}
        disabled={busy}
        className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md hover:border-slate-300 transition-all disabled:opacity-60 group"
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-slate-100 shrink-0 group-hover:bg-blue-50 transition-colors">
            {busy ? (
              <Loader2 size={18} className="text-blue-600 animate-spin" />
            ) : (
              <Icon size={18} className="text-slate-600 group-hover:text-blue-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <p className="text-sm font-medium text-slate-900 leading-snug">{item.title}</p>
              {item.featured && (
                <Star size={12} className="text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
              )}
            </div>
            {item.description && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                {item.kind === "link" ? <ExternalLink size={11} /> : <Download size={11} />}
                {item.kind === "link" ? "Open" : "Download"}
              </span>
              {size && <span>· {size}</span>}
              {item.version && item.version > 1 && <span>· v{item.version}</span>}
              <span>· {formatDate(item.updatedAt)}</span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Resources</h1>
        <p className="text-slate-500 mt-1">
          Your partner kit, partner pieces, and everything else we publish for you.
        </p>
        <div className="mt-1.5">
          {library && <ScopeBanner label={library.scope.label} kind={library.scope.kind} />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources…"
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden flex-wrap">
          <button
            type="button"
            onClick={() => setCategory("")}
            aria-pressed={category === ""}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              category === "" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {counts?.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => setCategory(c.category)}
              aria-pressed={category === c.category}
              className={`px-3 py-2 text-xs font-medium border-l border-slate-300 transition-colors ${
                category === c.category
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {c.label} <span className="opacity-60">{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {isEmpty && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <FileText size={22} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">
            {search || category ? "Nothing matches that." : "No resources yet"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {search || category
              ? "Try a different search or category."
              : "Material published for your agency will appear here."}
          </p>
        </div>
      )}

      {showAgreement && agreement && (
        <div>
          <SectionHeader title="Your agreement" subtitle="Signed and on file" />
          <div className="mt-4">
            <button
              type="button"
              onClick={handleOpenAgreement}
              disabled={!agreement.available || busyId === "agreement"}
              className="w-full md:w-2/3 lg:w-1/2 text-left bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md hover:border-slate-300 transition-all disabled:opacity-60 disabled:hover:shadow-sm group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-slate-100 shrink-0 group-hover:bg-blue-50 transition-colors">
                  {busyId === "agreement" ? (
                    <Loader2 size={18} className="text-blue-600 animate-spin" />
                  ) : agreement.available ? (
                    <FileSignature size={18} className="text-slate-600 group-hover:text-blue-600" />
                  ) : (
                    <Clock size={18} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Partner Agreement &amp; Acknowledgment
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {agreement.partnerAgencyName}
                    {agreement.printedName ? ` · signed by ${agreement.printedName}` : ""}
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {agreement.available
                      ? `Executed ${formatDate(agreement.signedAt)} · ${
                          agreement.method === "online" ? "Signed online" : "Uploaded"
                        }`
                      : "Your signed copy is being prepared — check back shortly."}
                  </p>
                </div>
                {agreement.available && (
                  <Download
                    size={16}
                    className="text-slate-300 shrink-0 group-hover:text-blue-600 transition-colors"
                  />
                )}
              </div>
            </button>
          </div>
        </div>
      )}

      {library && library.featured.length > 0 && !search && !category && (
        <div>
          <SectionHeader title="Featured" subtitle="Start here" />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {library.featured.map((item) => (
              <Card key={String(item._id)} item={item as Item} />
            ))}
          </div>
        </div>
      )}

      {library?.categories.map((group) => (
        <div key={group.category}>
          <SectionHeader
            title={group.label}
            subtitle={`${group.items.length} ${group.items.length === 1 ? "item" : "items"}`}
          />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.items.map((item) => (
              <Card key={String(item._id)} item={item as Item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
