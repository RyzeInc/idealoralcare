'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, Phone, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Navigation } from 'lucide-react';

interface RawProvider {
  name: string;
  address: string;
  phone: string;
  specialty: string;
  city: string;
  state: string;
  zipCode: string;
}

interface Provider extends RawProvider {
  id: string;
  distance: number;
}

interface ProviderSearchTabProps {
  onClose: () => void;
}

interface SearchFormData {
  specialty: string;
  providerName: string;
  city: string;
  state: string;
  zip: string;
}

const calculateDistance = (searchZip: string, providerZip: string): number => {
  const searchPrefix = (searchZip || '00000').substring(0, 3);
  const providerPrefix = (providerZip || '00000').substring(0, 3);
  if (searchPrefix === providerPrefix) return 0;
  const diff = Math.abs(parseInt(searchPrefix, 10) - parseInt(providerPrefix, 10));
  return diff * 50;
};

const getAllSpecialties = (providers: RawProvider[]): string[] => {
  const specialties = new Set(providers.map((p) => p.specialty));
  return Array.from(specialties).sort();
};

interface ShowResultsState {
  type: 'results';
  data: Provider[];
  query: SearchFormData;
  count: number;
}

interface ShowFormState {
  type: 'form';
}

type ViewState = ShowFormState | ShowResultsState;

// ─── Shared input styles ─────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  padding: '0.625rem 0.875rem',
  borderRadius: '8px',
  border: '1.5px solid #e2e8f0',
  background: '#fff',
  fontSize: '0.9rem',
  color: '#0f172a',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '0.35rem',
  display: 'block',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const US_STATES = [
  'AK','AL','AR','AZ','CA','CO','CT','DC','DE','FL','GA','HI',
  'IA','ID','IL','IN','KS','KY','LA','MA','MD','ME','MI','MN',
  'MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH',
  'OK','OR','PA','PR','RI','SC','SD','TN','TX','UT','VA','VI',
  'VT','WA','WI','WV','WY',
];

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ProviderSearchTab({ onClose }: ProviderSearchTabProps) {
  const [view, setView] = useState<ViewState>({ type: 'form' });
  const [providerData, setProviderData] = useState<RawProvider[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    fetch('/dentaldiscountnetwork.json')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setProviderData(data))
      .catch(() => {})
      .finally(() => setIsLoadingData(false));
  }, []);

  const specialties = useMemo(() => getAllSpecialties(providerData), [providerData]);

  const handleSearch = (formData: SearchFormData) => {
    const norm  = (s: string) => s.trim();
    const nSpec  = norm(formData.specialty);
    const nName  = norm(formData.providerName).toUpperCase();
    const nCity  = norm(formData.city).toUpperCase();
    const nState = norm(formData.state).toUpperCase();
    const nZip   = norm(formData.zip);

    const filtered = providerData.filter((p) => {
      if (nSpec && nSpec !== '(All Specialties)' && p.specialty.trim().toUpperCase() !== nSpec.toUpperCase()) return false;
      if (nName && !p.name.toUpperCase().includes(nName)) return false;
      if (nCity && !p.city.replace(/\s+/g, ' ').trim().toUpperCase().includes(nCity)) return false;
      if (nState && p.state.trim().toUpperCase() !== nState) return false;
      return true;
    });

    const withDist: Provider[] = filtered.map((p, idx) => ({
      ...p,
      id: `${p.name}-${idx}`,
      distance: calculateDistance(nZip || '00000', p.zipCode),
    }));

    if (nZip) withDist.sort((a, b) => a.distance - b.distance);

    setView({
      type: 'results',
      data: withDist.slice(0, 100),
      query: formData,
      count: withDist.length,
    });
  };

  if (view.type === 'results') {
    return <ProviderSearchResults view={view} onBack={() => setView({ type: 'form' })} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* ── Hero banner ───────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0055b3 0%, #0077e6 60%, #00a3ff 100%)',
        borderRadius: '16px 16px 0 0',
        padding: '2rem 2rem 1.75rem',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top:'-40px', right:'-40px', width:'200px', height:'200px', borderRadius:'50%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'-60px', left:'30%', width:'260px', height:'260px', borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />

        <div style={{ display:'flex', alignItems:'center', gap:'0.875rem', marginBottom:'1rem', position:'relative' }}>
          <div style={{
            width:'46px', height:'46px', borderRadius:'12px',
            background:'rgba(255,255,255,0.2)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <Search size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize:'1.4rem', fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>Find a Dentist</h2>
            <p style={{ opacity:0.75, fontSize:'0.85rem', margin:0, marginTop:'0.2rem' }}>
              Dental Discount Network · 50,000+ providers nationwide
            </p>
          </div>
        </div>

        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', position:'relative' }}>
          {['Save 20–50%', 'No Waiting Period', 'Unlimited Cleanings', 'Ortho Included'].map((b) => (
            <span key={b} style={{
              padding:'0.25rem 0.7rem',
              background:'rgba(255,255,255,0.18)',
              border:'1px solid rgba(255,255,255,0.28)',
              borderRadius:'9999px',
              fontSize:'0.75rem',
              fontWeight:600,
            }}>{b}</span>
          ))}
        </div>
      </div>

      {/* ── Search form ───────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderRadius: '0 0 16px 16px',
        border: '1.5px solid #e2e8f0',
        borderTop: 'none',
        padding: '1.75rem 2rem 2rem',
      }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            handleSearch({
              specialty:    fd.get('specialty') as string,
              providerName: fd.get('providerName') as string,
              city:         fd.get('city') as string,
              state:        fd.get('state') as string,
              zip:          fd.get('zip') as string,
            });
          }}
          style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}
        >
          <SectionLabel number={1} text="Provider type" />

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Dental Specialty</label>
              <select name="specialty" defaultValue="(All Specialties)" style={inputBase}>
                <option value="(All Specialties)">(All Specialties)</option>
                {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Provider Name{' '}
                <span style={{ textTransform:'none', fontWeight:400, color:'#94a3b8', letterSpacing:0 }}>(optional)</span>
              </label>
              <input name="providerName" type="text" placeholder="e.g. Smith, John" maxLength={66} style={inputBase} />
            </div>
          </div>

          <div style={{ height:'1px', background:'#f1f5f9' }} />

          <SectionLabel number={2} text="Location" hint="zip code, or city + state" />

          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 130px', gap:'1rem' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>City</label>
              <input name="city" type="text" placeholder="e.g. Austin" maxLength={32} style={inputBase} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>State</label>
              <select name="state" style={inputBase}>
                <option value="">—</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Zip Code</label>
              <input name="zip" type="text" placeholder="e.g. 90210" maxLength={5} pattern="\d{5}" style={inputBase} />
            </div>
          </div>

          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            flexWrap:'wrap', gap:'1rem', paddingTop:'0.25rem',
          }}>
            <p style={{ fontSize:'0.78rem', color:'#94a3b8', margin:0, maxWidth:'420px', lineHeight:1.5 }}>
              When contacting a provider, identify yourself as a member of the Dental Discount Network.
            </p>
            <button
              type="submit"
              disabled={isLoadingData}
              style={{
                display:'inline-flex', alignItems:'center', gap:'0.5rem',
                padding:'0.75rem 2rem', borderRadius:'10px',
                background: isLoadingData ? '#94a3b8' : 'linear-gradient(135deg, #0066CC, #0055b3)',
                color:'#fff', border:'none', cursor: isLoadingData ? 'not-allowed' : 'pointer',
                fontSize:'0.9375rem', fontWeight:700, letterSpacing:'-0.01em',
                boxShadow:'0 4px 14px rgba(0,102,204,0.3)',
                whiteSpace:'nowrap',
              }}
            >
              <Search size={17} />
              {isLoadingData ? 'Loading data…' : 'Search Providers'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Legal disclaimer ──────────────────────────────────────────── */}
      <p style={{
        marginTop:'1rem', fontSize:'0.72rem', color:'#b0bec5', lineHeight:1.6, padding:'0 0.25rem',
      }}>
        <strong style={{ color:'#90a4ae' }}>THIS PLAN IS NOT INSURANCE.</strong>{' '}
        The range of discounts will vary by provider and service. Plan members must pay for all services but will receive a discount.
        Administrator: Dental Discount Network International Corporation, Frisco TX · 800-441-0380.{' '}
        <a href="https://www1.careington.com/help/privacy-statement/" target="_blank" rel="noopener noreferrer" style={{ color:'#0066CC' }}>Privacy</a>
        {' · '}
        <a href="https://www1.careington.com/help/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ color:'#0066CC' }}>Terms</a>
      </p>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ number, text, hint }: { number: number; text: string; hint?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
      <span style={{
        width:'22px', height:'22px', borderRadius:'50%', flexShrink:0,
        background:'linear-gradient(135deg, #0066CC, #0055b3)',
        color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'0.7rem', fontWeight:800,
      }}>{number}</span>
      <span style={{ fontWeight:700, color:'#0f172a', fontSize:'0.9rem' }}>{text}</span>
      {hint && <span style={{ fontSize:'0.78rem', color:'#94a3b8' }}>· {hint}</span>}
    </div>
  );
}

// ─── Google Maps URL ──────────────────────────────────────────────────────────
function buildMapUrl(provider: Provider): string {
  const addrPart = provider.address.replace(/ /g, '+');
  const cityPart = provider.city.replace(/ /g, '+');
  return `https://maps.google.com/maps?&q=${addrPart},${cityPart},${provider.state}&zip=${provider.zipCode}`;
}

// ─── Pagination icon button ───────────────────────────────────────────────────
function PagBtn({ onClick, disabled, children }: {
  onClick: () => void; disabled: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        width:'34px', height:'34px', borderRadius:'8px',
        border:'1.5px solid', borderColor: disabled ? '#e2e8f0' : '#0066CC',
        background: disabled ? '#f8fafc' : '#fff',
        color: disabled ? '#cbd5e1' : '#0066CC',
        cursor: disabled ? 'default' : 'pointer',
        fontSize:'0.75rem', fontWeight:600,
      }}
    >{children}</button>
  );
}

// ─── Results view ─────────────────────────────────────────────────────────────
function ProviderSearchResults({ view, onBack }: { view: ShowResultsState; onBack: () => void }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages    = Math.max(1, Math.ceil(view.data.length / pageSize));
  const pageStart     = (page - 1) * pageSize;
  const pageEnd       = pageStart + pageSize;
  const pageProviders = view.data.slice(pageStart, pageEnd);

  const goTo = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handlePageSizeChange = (n: number) => { setPageSize(n); setPage(1); };

  const searchLabel = view.query.zip || view.query.city || 'your area';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:'0.75rem',
      }}>
        <button
          onClick={onBack}
          style={{
            display:'inline-flex', alignItems:'center', gap:'0.375rem',
            padding:'0.5rem 0.875rem', borderRadius:'8px',
            border:'1.5px solid #e2e8f0', background:'#fff',
            color:'#0066CC', cursor:'pointer', fontSize:'0.875rem', fontWeight:600,
          }}
        >
          <ChevronLeft size={16} />
          New Search
        </button>

        <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.85rem', color:'#64748b' }}>
            <strong style={{ color:'#0f172a' }}>{view.data.length}</strong> providers near{' '}
            <strong style={{ color:'#0f172a' }}>{searchLabel}</strong>
          </span>
          <span style={{ color:'#cbd5e1' }}>|</span>
          <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.82rem', color:'#64748b' }}>
            Show
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              style={{
                padding:'0.25rem 0.4rem', borderRadius:'6px',
                border:'1.5px solid #e2e8f0', background:'#fff',
                fontSize:'0.82rem', color:'#0f172a', cursor:'pointer', outline:'none',
              }}
            >
              {[5, 10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            per page
          </label>
        </div>
      </div>

      {/* ── Info note ─────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'flex-start', gap:'0.625rem',
        padding:'0.75rem 1rem', borderRadius:'10px',
        background:'#eff6ff', border:'1px solid #bfdbfe',
        fontSize:'0.8rem', color:'#2563eb', lineHeight:1.5,
      }}>
        <MapPin size={15} style={{ flexShrink:0, marginTop:'0.1rem' }} />
        <span>
          Click a provider name to open directions in Google Maps. Results do not guarantee participation — confirm with Member Services before scheduling.
        </span>
      </div>

      {/* ── Provider cards ────────────────────────────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
        {pageProviders.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          flexWrap:'wrap', gap:'0.75rem', padding:'0.25rem 0',
        }}>
          <span style={{ fontSize:'0.8rem', color:'#94a3b8' }}>
            Showing {pageStart + 1}–{Math.min(pageEnd, view.data.length)} of {view.data.length}
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:'0.375rem' }}>
            <PagBtn onClick={() => goTo(1)} disabled={page === 1}><ChevronsLeft size={14} /></PagBtn>
            <PagBtn onClick={() => goTo(page - 1)} disabled={page === 1}><ChevronLeft size={14} /></PagBtn>
            <span style={{
              padding:'0 0.875rem', height:'34px', display:'inline-flex', alignItems:'center',
              fontSize:'0.8rem', fontWeight:600, color:'#0066CC',
              background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:'8px',
            }}>
              Page {page} of {totalPages}
            </span>
            <PagBtn onClick={() => goTo(page + 1)} disabled={page === totalPages}><ChevronRight size={14} /></PagBtn>
            <PagBtn onClick={() => goTo(totalPages)} disabled={page === totalPages}><ChevronsRight size={14} /></PagBtn>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <p style={{ fontSize:'0.72rem', color:'#b0bec5', textAlign:'center', margin:'0.25rem 0 0', lineHeight:1.5 }}>
        Updated on: 3/4/2026 · *Approximate distance based off centroid zip code
      </p>
    </div>
  );
}

// ─── Provider card ────────────────────────────────────────────────────────────
function ProviderCard({ provider }: { provider: Provider }) {
  const mapUrl   = buildMapUrl(provider);
  const inArea   = provider.distance === 0;
  const distLabel = inArea ? 'In your area' : `~${provider.distance.toFixed(0)} mi`;

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1.5px solid #e2e8f0',
      borderLeft: '4px solid #0066CC',
      padding: '1rem 1.25rem',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '1rem',
      alignItems: 'start',
    }}>
      {/* Left */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', flexWrap:'wrap', marginBottom:'0.4rem' }}>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.9375rem', fontWeight: 700, color: '#0066CC',
              textDecoration: 'none', lineHeight: 1.3,
            }}
          >
            {provider.name}
          </a>
          <span style={{
            padding:'0.15rem 0.55rem', borderRadius:'9999px',
            background:'#f0f9ff', border:'1px solid #bae6fd',
            fontSize:'0.7rem', fontWeight:600, color:'#0369a1', whiteSpace:'nowrap',
          }}>
            {provider.specialty}
          </span>
        </div>

        <div style={{ display:'flex', alignItems:'flex-start', gap:'0.4rem', color:'#475569', fontSize:'0.82rem', marginBottom:'0.3rem' }}>
          <MapPin size={13} style={{ flexShrink:0, marginTop:'0.18rem', color:'#94a3b8' }} />
          <span>{provider.address}, {provider.city}, {provider.state} {provider.zipCode}</span>
        </div>

        {provider.phone && (
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', color:'#475569', fontSize:'0.82rem' }}>
            <Phone size={13} style={{ flexShrink:0, color:'#94a3b8' }} />
            <span>{provider.phone}</span>
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.5rem', flexShrink:0 }}>
        <span style={{
          padding:'0.2rem 0.6rem', borderRadius:'9999px',
          background: inArea ? '#f0fdf4' : '#f8fafc',
          border:`1px solid ${inArea ? '#bbf7d0' : '#e2e8f0'}`,
          fontSize:'0.72rem', fontWeight:700,
          color: inArea ? '#15803d' : '#64748b',
          whiteSpace:'nowrap',
        }}>
          {distLabel}
        </span>
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:'inline-flex', alignItems:'center', gap:'0.35rem',
            padding:'0.4rem 0.75rem', borderRadius:'8px',
            border:'1.5px solid #0066CC', color:'#0066CC',
            fontSize:'0.78rem', fontWeight:600, textDecoration:'none',
            background:'#fff', whiteSpace:'nowrap',
          }}
        >
          <Navigation size={12} />
          Map
        </a>
      </div>
    </div>
  );
}


