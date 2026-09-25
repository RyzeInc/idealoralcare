'use client';

/**
 * SHOP ADMIN
 *
 * Category and product CRUD for the preventative care shop.
 *
 * The storefront switch at the top is a kill switch for the whole shop: with it
 * off the public storefront 404s and every public shop query returns nothing,
 * while categories and products keep their own visibility untouched and come
 * back exactly as they were.
 *
 * Products and categories are created hidden and stay hidden until someone
 * ticks "Visible". The server also rejects copy containing disease claims and
 * affiliate URLs pointing at merchants that compete with our own plans — this
 * form surfaces those errors rather than pre-empting them, so the rule lives in
 * one place. See docs/internal/SHOP_DESIGN.md.
 */

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Plus, Trash2, Pencil, ExternalLink, MousePointerClick, PowerOff } from 'lucide-react';
import {
  Modal,
  useToast,
  StatusBadge,
  SkeletonTable,
  Skeleton,
} from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin-format';
import {
  SHOP_NETWORKS,
  SHOP_NETWORK_LABELS,
  type ShopNetwork,
} from '@/convex/shop/constants';

type ProductForm = {
  categoryId: string;
  name: string;
  brand: string;
  shortDescription: string;
  description: string;
  highlights: string;
  imageUrl: string;
  affiliateUrl: string;
  merchant: string;
  network: ShopNetwork;
  commissionRate: string;
  cookieWindowDays: string;
  price: string;
  isVisible: boolean;
  isFeatured: boolean;
};

const EMPTY_PRODUCT: ProductForm = {
  categoryId: '',
  name: '',
  brand: '',
  shortDescription: '',
  description: '',
  highlights: '',
  imageUrl: '',
  affiliateUrl: '',
  merchant: '',
  network: 'direct',
  commissionRate: '',
  cookieWindowDays: '',
  price: '',
  isVisible: false,
  isFeatured: false,
};

/**
 * On/off switch for the storefront.
 *
 * `role="switch"` rather than a styled checkbox so a screen reader announces
 * the state, and the state is spelled out in words next to the knob — "Shop is
 * live" is what an admin needs to read at a glance, not a knob position.
 */
function StorefrontSwitch({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label="Storefront on or off"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`inline-flex items-center gap-2.5 rounded-full border px-1.5 py-1.5 pr-3.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        enabled
          ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
          : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          enabled ? 'bg-green-600' : 'bg-slate-400'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            enabled ? 'left-[1.125rem]' : 'left-0.5'
          }`}
        />
      </span>
      {enabled ? 'Shop is live' : 'Shop is off'}
    </button>
  );
}

export function ShopAdmin() {
  const toast = useToast();
  const categories = useQuery(api.shop.admin.listCategories);
  const products = useQuery(api.shop.admin.listProducts, {});
  const settings = useQuery(api.shop.admin.getSettings);

  const createCategory = useMutation(api.shop.admin.createCategory);
  const deleteCategory = useMutation(api.shop.admin.deleteCategory);
  const createProduct = useMutation(api.shop.admin.createProduct);
  const updateProduct = useMutation(api.shop.admin.updateProduct);
  const deleteProduct = useMutation(api.shop.admin.deleteProduct);
  const setShopEnabled = useMutation(api.shop.admin.setEnabled);

  const [confirmOff, setConfirmOff] = useState(false);
  const [switching, setSwitching] = useState(false);

  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');

  const [productModal, setProductModal] = useState(false);
  const [editingId, setEditingId] = useState<Id<'shopProducts'> | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Turning the shop *off* takes a live commercial surface down, so it asks
  // first. Turning it back on doesn't — nobody needs protecting from that.
  const applyEnabled = async (next: boolean) => {
    setSwitching(true);
    try {
      await setShopEnabled({ isEnabled: next });
      toast.success(
        next
          ? 'Shop is live again.'
          : 'Shop is off. The storefront is hidden from the public.',
      );
      setConfirmOff(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSwitching(false);
    }
  };

  const openNewProduct = () => {
    setEditingId(null);
    setForm({ ...EMPTY_PRODUCT, categoryId: categories?.[0]?._id ?? '' });
    setProductModal(true);
  };

  const openEditProduct = (product: NonNullable<typeof products>[number]) => {
    setEditingId(product._id);
    setForm({
      categoryId: product.categoryId,
      name: product.name,
      brand: product.brand,
      shortDescription: product.shortDescription,
      description: product.description ?? '',
      highlights: (product.highlights ?? []).join('\n'),
      imageUrl: product.imageUrl ?? '',
      affiliateUrl: product.affiliateUrl,
      merchant: product.merchant,
      network: product.network,
      commissionRate: product.commissionRate?.toString() ?? '',
      cookieWindowDays: product.cookieWindowDays?.toString() ?? '',
      price: product.priceCents ? (product.priceCents / 100).toFixed(2) : '',
      isVisible: product.isVisible,
      isFeatured: product.isFeatured,
    });
    setProductModal(true);
  };

  const submitCategory = async () => {
    if (!categoryName.trim()) return;
    try {
      await createCategory({
        name: categoryName.trim(),
        description: categoryDescription.trim() || undefined,
      });
      toast.success(`Category "${categoryName}" created (hidden).`);
      setCategoryName('');
      setCategoryDescription('');
      setCategoryModal(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const submitProduct = async () => {
    setSaving(true);
    try {
      const highlights = form.highlights
        .split('\n')
        .map((h) => h.trim())
        .filter(Boolean);
      const priceCents = form.price.trim()
        ? Math.round(Number(form.price) * 100)
        : undefined;
      if (priceCents !== undefined && Number.isNaN(priceCents)) {
        throw new Error('Price must be a number.');
      }

      const shared = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        shortDescription: form.shortDescription.trim(),
        description: form.description.trim() || undefined,
        highlights: highlights.length > 0 ? highlights : undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        affiliateUrl: form.affiliateUrl.trim(),
        merchant: form.merchant.trim(),
        network: form.network,
        commissionRate: form.commissionRate.trim()
          ? Number(form.commissionRate)
          : undefined,
        cookieWindowDays: form.cookieWindowDays.trim()
          ? Number(form.cookieWindowDays)
          : undefined,
        priceCents,
        isVisible: form.isVisible,
        isFeatured: form.isFeatured,
      };

      if (editingId) {
        await updateProduct({
          productId: editingId,
          categoryId: form.categoryId as Id<'shopCategories'>,
          ...shared,
        });
        toast.success(`Saved "${shared.brand} ${shared.name}".`);
      } else {
        await createProduct({
          categoryId: form.categoryId as Id<'shopCategories'>,
          ...shared,
        });
        toast.success(`Created "${shared.brand} ${shared.name}".`);
      }
      setProductModal(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const categoryName_ = (id: string) =>
    categories?.find((c) => c._id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Preventative Care Shop</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Curated third-party products we link out to for commission. Nothing
            here is a plan benefit, and the shop must look identical to members
            and non-members — no member pricing, no member-only items.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          {/* Unresolved state gets a skeleton, not an optimistic "live" — an
              admin reading the wrong answer here is the one failure this
              control can't afford. */}
          {settings === undefined ? (
            <Skeleton className="h-9 w-32 rounded-full" />
          ) : (
            <StorefrontSwitch
              enabled={settings.isEnabled}
              disabled={switching}
              onChange={(next) => (next ? applyEnabled(true) : setConfirmOff(true))}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setCategoryModal(true)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              <Plus size={16} /> Category
            </button>
            <button
              onClick={openNewProduct}
              disabled={!categories || categories.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              <Plus size={16} /> Product
            </button>
          </div>
        </div>
      </header>

      {settings && !settings.isEnabled && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <PowerOff size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">The storefront is off.</p>
            <p className="mt-1 leading-relaxed">
              <code>/health/shop</code> returns a 404 and no public shop query
              returns products — here or on any partner site. Everything below
              keeps its own visibility and comes back unchanged when you switch
              the shop on.
              {settings.updatedAt
                ? ` Turned off ${formatDateTime(settings.updatedAt)}.`
                : ''}
            </p>
          </div>
        </div>
      )}

      {/* CATEGORIES */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
          Categories
        </h2>
        {categories === undefined ? (
          <div className="p-4"><SkeletonTable /></div>
        ) : categories.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No categories yet. Add one before creating products.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((category) => (
              <li key={category._id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{category.name}</span>
                    <StatusBadge
                      status={category.isVisible ? 'visible' : 'hidden'}
                      tone={category.isVisible ? 'success' : 'neutral'}
                      label={category.isVisible ? 'Visible' : 'Hidden'}
                    />
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    /{category.slug}
                    {category.description ? ` — ${category.description}` : ''}
                  </p>
                </div>
                <button
                  aria-label={`Delete ${category.name}`}
                  onClick={async () => {
                    try {
                      await deleteCategory({ categoryId: category._id });
                      toast.success(`Deleted "${category.name}".`);
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                  className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PRODUCTS */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
          Products
        </h2>
        {products === undefined ? (
          <div className="p-4"><SkeletonTable /></div>
        ) : products.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No products yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Merchant</th>
                  <th className="px-4 py-2 font-medium">Rate</th>
                  <th className="px-4 py-2 font-medium">Clicks</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product._id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{product.brand} {product.name}</div>
                      <div className="text-xs text-slate-500">/{product.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {categoryName_(product.categoryId)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        {product.merchant}
                        <a
                          href={product.affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-700"
                          aria-label="Open affiliate URL"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                      <div className="text-xs text-slate-400">
                        {SHOP_NETWORK_LABELS[product.network]}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {product.commissionRate ? `${product.commissionRate}%` : '—'}
                      {product.cookieWindowDays ? (
                        <div className="text-xs text-slate-400">
                          {product.cookieWindowDays}d cookie
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick size={13} className="text-slate-400" />
                        {product.clickCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge
                          status={product.isVisible ? 'visible' : 'hidden'}
                          tone={product.isVisible ? 'success' : 'neutral'}
                          label={product.isVisible ? 'Visible' : 'Hidden'}
                        />
                        {product.isFeatured && (
                          <StatusBadge status="featured" tone="info" label="Featured" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          aria-label={`Edit ${product.name}`}
                          onClick={() => openEditProduct(product)}
                          className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          aria-label={`Delete ${product.name}`}
                          onClick={async () => {
                            try {
                              await deleteProduct({ productId: product._id });
                              toast.success(`Deleted "${product.name}".`);
                            } catch (error) {
                              toast.error((error as Error).message);
                            }
                          }}
                          className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* TURN-OFF CONFIRMATION */}
      <Modal
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title="Turn the shop off?"
        description="The public storefront disappears immediately, on this site and every partner site."
        size="max-w-md"
        preventClose={switching}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            Nothing is deleted. Categories and products keep their visibility
            settings and the shop comes back exactly as it is now. In-flight
            affiliate cookies from earlier clicks are unaffected — those live
            with the network, not with us.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmOff(false)}
              disabled={switching}
              className="px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => applyEnabled(false)}
              disabled={switching}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              <PowerOff size={15} />
              {switching ? 'Turning off…' : 'Turn shop off'}
            </button>
          </div>
        </div>
      </Modal>

      {/* CATEGORY MODAL */}
      <Modal
        open={categoryModal}
        onClose={() => setCategoryModal(false)}
        title="New category"
        description="Created hidden. Make it visible once it has products."
      >
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Name</span>
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Daily Care"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Description</span>
            <textarea
              value={categoryDescription}
              onChange={(e) => setCategoryDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCategoryModal(false)} className="px-3 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={submitCategory}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* PRODUCT MODAL */}
      <Modal
        open={productModal}
        onClose={() => setProductModal(false)}
        title={editingId ? 'Edit product' : 'New product'}
        size="max-w-2xl"
        preventClose={saving}
      >
        <div className="space-y-3">
          <div className="rounded-md bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            Describe what the product <strong>is</strong>, not what it treats.
            Words like &ldquo;prevents&rdquo;, &ldquo;treats&rdquo;, or
            &ldquo;gingivitis&rdquo; turn a cosmetic into a drug claim and will
            be rejected on save.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Category</span>
              <select
                value={form.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {categories?.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Brand</span>
              <input
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
                placeholder="Boka"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Name</span>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ela Mint Toothpaste"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Short description (card)</span>
            <textarea
              value={form.shortDescription}
              onChange={(e) => set('shortDescription', e.target.value)}
              rows={2}
              placeholder="Fluoride-free toothpaste with nano-hydroxyapatite."
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Highlights (one per line)</span>
            <textarea
              value={form.highlights}
              onChange={(e) => set('highlights', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Merchant (shown to shopper)</span>
              <input
                value={form.merchant}
                onChange={(e) => set('merchant', e.target.value)}
                placeholder="Boka"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Network</span>
              <select
                value={form.network}
                onChange={(e) => set('network', e.target.value as ShopNetwork)}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {SHOP_NETWORKS.map((n) => (
                  <option key={n} value={n}>{SHOP_NETWORK_LABELS[n]}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Affiliate URL (fully tagged)</span>
            <input
              value={form.affiliateUrl}
              onChange={(e) => set('affiliateUrl', e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Image URL</span>
            <input
              value={form.imageUrl}
              onChange={(e) => set('imageUrl', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Price (USD)</span>
              <input
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="28.00"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-slate-400">
                Shown as approximate, stamped with today&rsquo;s date.
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Commission %</span>
              <input
                value={form.commissionRate}
                onChange={(e) => set('commissionRate', e.target.value)}
                placeholder="15"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-slate-400">Internal only.</span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Cookie (days)</span>
              <input
                value={form.cookieWindowDays}
                onChange={(e) => set('cookieWindowDays', e.target.value)}
                placeholder="30"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-slate-400">Internal only.</span>
            </label>
          </div>

          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isVisible}
                onChange={(e) => set('isVisible', e.target.checked)}
              />
              Visible
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => set('isFeatured', e.target.checked)}
              />
              Featured
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setProductModal(false)}
              disabled={saving}
              className="px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={submitProduct}
              disabled={saving}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
