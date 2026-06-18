'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, Phone, FileText, Calendar, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

// Keys match the group `type` values returned by GET /api/search
// (customers | calls | invoices | appointments | estimates).
const TYPE_ICONS = {
  customers: Users,
  calls: Phone,
  invoices: FileText,
  appointments: Calendar,
  estimates: FileText,
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  // In-flight search fetch — aborted when a newer query supersedes it so a
  // slow earlier response can't paint stale results over the current ones.
  const abortRef = useRef(null);
  const router = useRouter();

  // Keyboard shortcut: Cmd+K / Ctrl+K toggles the palette.
  // Escape is handled by the Radix Dialog (onOpenChange), so it's not here.
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset transient state when the dialog closes.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // superseded by a newer search
      setResults([]);
    }
    if (abortRef.current === controller) setLoading(false);
  }, []);

  function handleInputChange(e) {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(0);
    clearTimeout(debounceRef.current);
    if (value.length >= 2) {
      setLoading(true);
      debounceRef.current = setTimeout(() => search(value), 250);
    } else {
      // Abort any in-flight search so a late response can't repaint results
      // after the query dropped below the search threshold.
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
    }
  }

  // Flatten results for keyboard navigation
  const flatItems = results.flatMap((group) =>
    group.items.map((item) => ({ ...item, type: group.type }))
  );

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
      e.preventDefault();
      navigate(flatItems[selectedIndex].href);
    }
  }

  function navigate(href) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        // Anchor near the top (command-palette convention) instead of centered.
        className="top-[15vh] translate-y-0 p-0 gap-0 overflow-hidden max-w-lg"
        // Keep focus on the search input rather than the first result on open.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {/* Visually-hidden accessible name for the dialog */}
        <DialogTitle className="sr-only">Search</DialogTitle>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="command-palette-listbox"
            aria-autocomplete="list"
            aria-label="Search customers, calls, invoices, estimates"
            aria-activedescendant={
              flatItems[selectedIndex]
                ? `cmdk-opt-${flatItems[selectedIndex].type}-${flatItems[selectedIndex].id}`
                : undefined
            }
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search customers, calls, invoices, estimates..."
            className="flex-1 h-12 text-sm text-foreground placeholder:text-muted-foreground bg-transparent outline-none"
          />
          {loading && <Loader2 className="size-4 text-muted-foreground animate-spin shrink-0" />}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] text-muted-foreground font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div
            id="command-palette-listbox"
            role="listbox"
            aria-label="Search results"
            className="max-h-80 overflow-y-auto py-2"
          >
            {(() => {
              let flatIndex = 0;
              return results.map((group) => {
                const Icon = TYPE_ICONS[group.type] || Search;
                return (
                  <div key={group.type} role="group" aria-labelledby={`cmdk-grp-${group.type}`}>
                    <p
                      id={`cmdk-grp-${group.type}`}
                      className="px-4 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const currentIndex = flatIndex++;
                      const isSelected = currentIndex === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          id={`cmdk-opt-${group.type}-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => navigate(item.href)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                          }`}
                        >
                          <Icon className="size-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Empty state */}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/50">
          <span className="text-[10px] text-muted-foreground">
            <kbd className="px-1 py-0.5 rounded border border-border bg-card text-[10px] font-mono mr-1">&uarr;&darr;</kbd>
            navigate
            <kbd className="px-1 py-0.5 rounded border border-border bg-card text-[10px] font-mono ml-2 mr-1">&crarr;</kbd>
            open
          </span>
          <span className="text-[10px] text-muted-foreground">
            <kbd className="px-1 py-0.5 rounded border border-border bg-card text-[10px] font-mono mr-1">&#8984;K</kbd>
            toggle
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
