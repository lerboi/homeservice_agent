'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSWRFetch } from '@/hooks/useSWRFetch';

// API page size (default) and hard cap (both routes clamp limit to 500).
const PAGE_SIZE = 50;
const MAX_LIMIT = 500;

/**
 * Shared hook for invoice/estimate list pages.
 * Handles status filtering, SWR-based fetching, pagination, and summary caching.
 *
 * @param {string} apiBase — e.g. '/api/invoices' or '/api/estimates'
 * @param {object} options
 * @param {string} options.itemsKey — response key for the list, e.g. 'invoices' or 'estimates'
 */
export function useDocumentList(apiBase, { itemsKey, extraParams = {} }) {
  const [activeStatus, setActiveStatusState] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const summaryRef = useRef(null);

  // Changing status resets pagination back to the first page size.
  const setActiveStatus = useCallback((status) => {
    setLimit(PAGE_SIZE);
    setActiveStatusState(status);
  }, []);

  const url = (() => {
    const params = new URLSearchParams();
    if (activeStatus !== 'all') params.set('status', activeStatus);
    params.set('limit', String(limit));
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return `${apiBase}?${params.toString()}`;
  })();

  const { data, error, isLoading, mutate } = useSWRFetch(url);

  const items = data?.[itemsKey] || [];
  const statusCounts = data?.status_counts || {};
  const totalCount = data?.total_count ?? null;
  const hasMore = totalCount != null && items.length < totalCount && limit < MAX_LIMIT;

  const loadMore = useCallback(() => {
    setLimit((prev) => Math.min(prev + PAGE_SIZE, MAX_LIMIT));
  }, []);

  // Keep the latest summary (whole-tenant metrics, returned on every load).
  // Refresh on each successful fetch — previously cached only once, so headline
  // money figures froze after first load until remount (2026-06-12 audit M20).
  // The ref persists the last value across SWR revalidation gaps (data briefly
  // undefined) so the UI doesn't flash empty.
  useEffect(() => {
    if (data?.summary) {
      summaryRef.current = data.summary;
    }
  }, [data?.summary]);

  return {
    items,
    summary: summaryRef.current,
    statusCounts,
    loading: isLoading,
    error: error?.message || null,
    activeStatus,
    setActiveStatus,
    hasMore,
    loadMore,
    totalCount,
    mutate,
  };
}
