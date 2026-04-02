'use client';

import { useState, useRef, useEffect } from 'react';
import { useSWRFetch } from '@/hooks/useSWRFetch';

/**
 * Shared hook for invoice/estimate list pages.
 * Handles status filtering, SWR-based fetching, and summary caching.
 *
 * @param {string} apiBase — e.g. '/api/invoices' or '/api/estimates'
 * @param {object} options
 * @param {string} options.itemsKey — response key for the list, e.g. 'invoices' or 'estimates'
 */
export function useDocumentList(apiBase, { itemsKey }) {
  const [activeStatus, setActiveStatus] = useState('all');
  const summaryRef = useRef(null);

  const url =
    activeStatus === 'all' ? apiBase : `${apiBase}?status=${activeStatus}`;

  const { data, error, isLoading, mutate } = useSWRFetch(url);

  const items = data?.[itemsKey] || [];
  const statusCounts = data?.status_counts || {};

  // Cache summary from first successful load (represents overall metrics)
  useEffect(() => {
    if (data?.summary && !summaryRef.current) {
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
    mutate,
  };
}
