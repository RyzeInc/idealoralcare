"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Upload, Link2, Eye, EyeOff, Archive, Download, Loader2, Plus, X, Star,
} from "lucide-react";
import { StatCard, StatCardGrid, DataTable, SectionHeader, type Column } from "@/components/insights";
import { formatDate, humanize } from "@/lib/admin-format";

/**
 * Resource library curation.
 *
 * Visibility is the part worth care: audience decides WHO, brand decides WHICH
 * WHITE-LABEL. Leaving brands unset means every brand, which is the common and
 * correct default — restricting is the exception, for brand-specific artwork.
 */

type Row = {
  _id: Id<"partnerResources">;
  title: string;
  description?: string;
  category: string;
  categoryLabel: string;
  kind: "file" | "link";
  fileName?: string;
  fileSizeBytes?: number;
  status: string;
  featured: boolean;
  version?: number;
  audience: string;
  partnerTypes: string[];
  partnerNames: string[];
  siteNames: string[];
  allBrands: boolean;
  downloadCount: number;
  lastDownloadedAt?: number;
  updatedAt: number;
};

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-slate-50 text-slate-600 border-slate-200",
  archived: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function AdminResources() {
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", description: "", category: "partner_pieces",
    kind: "file" as "file" | "link", externalUrl: "",
    audience: "all" as "all" | "partner_types" | "specific",
    partnerTypes: [] as string[], partnerIds: [] as string[],
    siteIds: [] as string[], featured: false, publish: true,
  });
  const [file, setFile] = useState<File | null>(null);

  const data = useQuery(api.resources.admin.listAll, { includeArchived: true });
  const options = useQuery(api.resources.admin.getVisibilityOptions);
  const activity = useQuery(api.resources.admin.getDownloadActivity, { limit: 20 });

  const generateUploadUrl = useMutation(api.resources.admin.generateUploadUrl);
  const createResource = useMutation(api.resources.admin.createResource);
  const setStatus = useMutation(api.resources.admin.setStatus);
  const getAdminDownloadUrl = useMutation(api.resources.admin.getAdminDownloadUrl);

  const reset = () => {
    setForm({
      title: "", description: "", category: "partner_pieces", kind: "file",
      externalUrl: "", audience: "all", partnerTypes: [], partnerIds: [],
      siteIds: [], featured: false, publish: true,
    });
    setFile(null);
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let storageId: string | undefined;
      let fileName: string | undefined;
      let contentType: string | undefined;
      let fileSizeBytes: number | undefined;

      if (form.kind === "file") {
        if (!file) throw new Error("Choose a file to upload.");
        const uploadUrl = await generateUploadUrl({});
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) throw new Error("Upload failed. Please try again.");
        ({ storageId } = await res.json());
        fileName = file.name;
        contentType = file.type || undefined;
        fileSizeBytes = file.size;
      }

      await createResource({
        title: form.title,
        description: form.description || undefined,
        category: form.category as never,
        kind: form.kind,
        storageId: storageId as Id<"_storage"> | undefined,
        fileName, contentType, fileSizeBytes,
        externalUrl: form.kind === "link" ? form.externalUrl : undefined,
        audience: form.audience,
        partnerTypes: form.partnerTypes.length ? (form.partnerTypes as never) : undefined,
        partnerIds: form.partnerIds.length ? form.partnerIds : undefined,
        siteIds: form.siteIds.length ? (form.siteIds as Id<"sites">[]) : undefined,
        status: form.publish ? "published" : "draft",
        featured: form.featured || undefined,
      });

      reset();
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const preview = async (resourceId: Id<"partnerResources">) => {
    const result = await getAdminDownloadUrl({ resourceId });
    if (result?.url) window.open(result.url, "_blank", "noopener,noreferrer");
  };

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Resource",
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-slate-900 truncate">{r.title}</p>
            {r.featured && <Star size={11} className="text-amber-500 fill-amber-500 shrink-0" />}
            {r.version && r.version > 1 && (
              <span className="text-xs text-slate-400">v{r.version}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">
            {r.kind === "link" ? "Link" : r.fileName ?? "File"} · {r.categoryLabel}
          </p>
        </div>
      ),
      value: (r) => r.title,
    },
    {
      key: "audience",
      header: "Who sees it",
      cell: (r) => (
        <div className="text-xs text-slate-600">
          {r.audience === "all" && "Everyone"}
          {r.audience === "partner_types" && r.partnerTypes.map(humanize).join(", ")}
          {r.audience === "specific" && (
            <span title={r.partnerNames.join(", ")}>
              {r.partnerNames.length} partner{r.partnerNames.length === 1 ? "" : "s"}
            </span>
          )}
          <p className="text-slate-400 mt-0.5">
            {r.allBrands ? "All brands" : r.siteNames.join(", ")}
          </p>
        </div>
      ),
      value: (r) => r.audience,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`}>
          {humanize(r.status)}
        </span>
      ),
      value: (r) => r.status,
    },
    {
      key: "downloadCount",
      header: "Downloads",
      align: "right",
      cell: (r) => (
        <span className={r.downloadCount === 0 && r.status === "published" ? "text-slate-300" : ""}>
          {r.downloadCount}
        </span>
      ),
      value: (r) => r.downloadCount,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void preview(r._id); }}
            title="Preview"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
          >
            <Download size={14} />
          </button>
          {r.status !== "published" ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void setStatus({ resourceId: r._id, status: "published" }); }}
              title="Publish"
              className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
            >
              <Eye size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void setStatus({ resourceId: r._id, status: "draft" }); }}
              title="Unpublish"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
            >
              <EyeOff size={14} />
            </button>
          )}
          {r.status !== "archived" && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void setStatus({ resourceId: r._id, status: "archived" }); }}
              title="Archive"
              className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
            >
              <Archive size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Resources</h1>
          <p className="text-slate-500 mt-1">
            Partner kits and partner pieces that partners download.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); if (showForm) reset(); }}
          className="inline-flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 transition-colors"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? "Cancel" : "Add resource"}
        </button>
      </div>

      <StatCardGrid>
        <StatCard label="Published" value={data ? String(data.totals.published) : "—"} />
        <StatCard label="Drafts" value={data ? String(data.totals.draft) : "—"} />
        <StatCard label="Archived" value={data ? String(data.totals.archived) : "—"} />
        <StatCard label="Total downloads" value={data ? String(data.totals.downloads) : "—"} />
      </StatCardGrid>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">New resource</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-slate-600">Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                placeholder="2026 Plan Comparison Flyer"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {options?.categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-slate-600">Description (optional)</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              placeholder="What it's for, and when to use it."
            />
          </label>

          <div className="flex gap-2">
            {(["file", "link"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm({ ...form, kind: k })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  form.kind === k
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-300"
                }`}
              >
                {k === "file" ? <Upload size={13} /> : <Link2 size={13} />}
                {k === "file" ? "Upload a file" : "Link out"}
              </button>
            ))}
          </div>

          {form.kind === "file" ? (
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-sm file:bg-white hover:file:bg-slate-50"
            />
          ) : (
            <input
              value={form.externalUrl}
              onChange={(e) => setForm({ ...form, externalUrl: e.target.value })}
              placeholder="https://…"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          )}

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Visibility
            </p>

            <div className="flex flex-wrap gap-2">
              {([
                ["all", "Everyone"],
                ["partner_types", "By partner type"],
                ["specific", "Specific partners"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, audience: value })}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    form.audience === value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {form.audience === "partner_types" && (
              <div className="flex flex-wrap gap-2">
                {["program_manager", "fmo", "agency"].map((t) => (
                  <label key={t} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.partnerTypes.includes(t)}
                      onChange={() => setForm({ ...form, partnerTypes: toggle(form.partnerTypes, t) })}
                    />
                    {humanize(t)}
                  </label>
                ))}
              </div>
            )}

            {form.audience === "specific" && (
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                {options?.partners.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.partnerIds.includes(p.id)}
                      onChange={() => setForm({ ...form, partnerIds: toggle(form.partnerIds, p.id) })}
                    />
                    {p.name} <span className="text-slate-400">({humanize(p.type)})</span>
                  </label>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs text-slate-600 mb-1.5">
                Brands — leave all unchecked for every brand
              </p>
              <div className="flex flex-wrap gap-3">
                {options?.sites.map((s) => (
                  <label key={s.id} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.siteIds.includes(s.id)}
                      onChange={() => setForm({ ...form, siteIds: toggle(form.siteIds, s.id) })}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Restrict only for brand-specific artwork — a white-label partner must never
                receive another brand&rsquo;s material.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                />
                Feature at the top
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={form.publish}
                  onChange={(e) => setForm({ ...form, publish: e.target.checked })}
                />
                Publish immediately
              </label>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={busy || !form.title.trim()}
            className="inline-flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? "Saving…" : "Save resource"}
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={(data?.rows ?? []) as Row[]}
        rowKey={(r) => String(r._id)}
        searchable
        searchPlaceholder="Search resources…"
        pageSize={20}
        empty={data === undefined ? "Loading…" : "No resources yet. Add one to get started."}
      />

      {activity && activity.neverDownloaded.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-900">
            {activity.neverDownloaded.length} published{" "}
            {activity.neverDownloaded.length === 1 ? "resource has" : "resources have"} never been
            downloaded
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            Usually a visibility setting narrower than intended:{" "}
            {activity.neverDownloaded.slice(0, 4).map((r) => r.title).join(", ")}
            {activity.neverDownloaded.length > 4 && "…"}
          </p>
        </div>
      )}

      {activity && activity.recent.length > 0 && (
        <div>
          <SectionHeader title="Recent downloads" subtitle="Who is taking what" />
          <div className="mt-4">
            <DataTable
              columns={[
                { key: "resourceTitle", header: "Resource", cell: (r: { resourceTitle: string }) => r.resourceTitle, value: (r) => r.resourceTitle },
                { key: "partnerName", header: "Partner", cell: (r: { partnerName: string }) => r.partnerName, value: (r) => r.partnerName },
                { key: "viewerKind", header: "Role", cell: (r: { viewerKind: string }) => humanize(r.viewerKind), value: (r) => r.viewerKind },
                { key: "downloadedAt", header: "When", cell: (r: { downloadedAt: number }) => formatDate(r.downloadedAt), value: (r) => r.downloadedAt },
              ]}
              rows={activity.recent}
              rowKey={(r) => String(r._id)}
              pageSize={10}
            />
          </div>
        </div>
      )}
    </div>
  );
}
