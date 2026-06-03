'use client';

// Customers list page — modeled on the Inquiries / Jobs pages.
// Data source: GET /api/customers?search= (src/lib/customers.js → listCustomers).
// Each row links to /dashboard/customers/${id}. The list query returns
// jobs:jobs(count) and open_inquiries:inquiries(count) aggregates (Supabase
// embed shape: [{ count: N }]). Rows are sorted server-side by updated_at desc.
//
// NOTE: the list endpoint does NOT return per-job is_vip data, so the VIP
// indicator here relies on a row-level `is_vip` flag if the API ever exposes
// one (customer.is_vip / customer.has_vip_job). Until then it stays hidden.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Contact, Search, X, Star, Phone, Wrench, PhoneIncoming } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { card } from '@/lib/design-tokens';

// ─── Aggregate helpers ──────────────────────────────────────────────────────
// Supabase `relation:relation(count)` embeds return an array: [{ count: N }].

function readCount(agg) {
  if (Array.isArray(agg)) return agg[0]?.count ?? 0;
  if (agg && typeof agg === 'object' && 'count' in agg) return agg.count ?? 0;
  return 0;
}

// ─── Customer row card ──────────────────────────────────────────────────────

function CustomerRow({ customer }) {
  const displayName = customer.name || customer.phone_e164 || 'Unknown';
  const jobsCount = readCount(customer.jobs);
  const openInquiriesCount = readCount(customer.open_inquiries);
  const isVip = !!(customer.is_vip || customer.has_vip_job);

  return (
    <Link
      href={`/dashboard/customers/${customer.id}`}
      className={`
        block rounded-xl border border-border bg-card
        shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]
        hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5
        transition-all duration-200 min-h-[72px]
      `}
    >
      <div className="flex items-center w-full gap-4 px-4 py-3">
        {/* Avatar */}
        <div className="flex items-center justify-center size-10 rounded-full bg-muted shrink-0">
          <Contact className="size-5 text-muted-foreground" />
        </div>

        {/* Name + phone */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            {isVip && (
              <Star
                className="size-3.5 text-amber-500 fill-amber-500 shrink-0"
                aria-label="VIP customer"
              />
            )}
          </div>
          {customer.phone_e164 && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
              <Phone className="size-3 shrink-0" />
              {customer.phone_e164}
            </p>
          )}
        </div>

        {/* Aggregates */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Wrench className="size-3.5" aria-hidden="true" />
            <span className="tabular-nums">{jobsCount}</span>
            <span className="hidden sm:inline">{jobsCount === 1 ? 'job' : 'jobs'}</span>
          </span>
          {openInquiriesCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--brand-accent)]">
              <PhoneIncoming className="size-3.5" aria-hidden="true" />
              <span className="tabular-nums">{openInquiriesCount}</span>
              <span className="hidden sm:inline">{openInquiriesCount === 1 ? 'inquiry' : 'inquiries'}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Customers page ─────────────────────────────────────────────────────────

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const searchTimerRef = useRef(null);

  // ── Fetch customers from /api/customers ──────────────────────────────────
  const fetchCustomers = useCallback(async (term) => {
    setLoading(true);
    setError(null);
    try {
      const qs = term ? `?search=${encodeURIComponent(term)}` : '';
      const res = await fetch(`/api/customers${qs}`);
      if (!res.ok) throw new Error('Failed to load customers');
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch {
      setError("We couldn't load your customers. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch whenever the committed search term changes
  const committedSearch = searchParams.get('search') || '';
  useEffect(() => {
    fetchCustomers(committedSearch);
  }, [committedSearch, fetchCustomers]);

  // ── Debounced search → URL (?search=) ────────────────────────────────────
  function handleSearchChange(e) {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const qs = value ? `?search=${encodeURIComponent(value)}` : '';
      router.replace(`/dashboard/customers${qs}`, { scroll: false });
    }, 300);
  }

  function clearSearch() {
    setSearch('');
    clearTimeout(searchTimerRef.current);
    router.replace('/dashboard/customers', { scroll: false });
  }

  useEffect(() => () => clearTimeout(searchTimerRef.current), []);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  const skeletonCards = (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
      ))}
    </div>
  );

  // ── Page header ──────────────────────────────────────────────────────────
  const pageHeader = (
    <div className="flex items-center justify-between px-6 pt-6 pb-4">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
          <Contact className="size-4 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Customers</h1>
        {!loading && (
          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
            {customers.length}
          </span>
        )}
      </div>
    </div>
  );

  // ── Search bar ───────────────────────────────────────────────────────────
  const searchBar = (
    <div className="px-6 pb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={handleSearchChange}
          className="pl-9 h-9 text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  // ── Main content ─────────────────────────────────────────────────────────
  let mainContent;
  if (error) {
    mainContent = <ErrorState message={error} onRetry={() => fetchCustomers(committedSearch)} />;
  } else if (loading) {
    mainContent = skeletonCards;
  } else if (customers.length === 0 && committedSearch) {
    mainContent = (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground mb-2">No customers match &ldquo;{committedSearch}&rdquo;.</p>
        <button
          type="button"
          onClick={clearSearch}
          className="text-sm text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] font-medium"
        >
          Clear search
        </button>
      </div>
    );
  } else if (customers.length === 0) {
    mainContent = (
      <EmptyState
        icon={Contact}
        headline="No customers yet"
        description="Customers appear here automatically when your AI receptionist books a job or captures an inquiry."
      />
    );
  } else {
    mainContent = (
      <div className="space-y-3">
        {customers.map((customer) => (
          <CustomerRow key={customer.id} customer={customer} />
        ))}
      </div>
    );
  }

  return (
    <div className={`${card.base} p-0`} data-page="customers-page">
      {pageHeader}
      {searchBar}
      <div className="px-6 pb-4">{mainContent}</div>
    </div>
  );
}
