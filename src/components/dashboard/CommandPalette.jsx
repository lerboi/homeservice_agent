'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, Phone, FileText, Calendar, Loader2 } from 'lucide-react';

const TYPE_ICONS = {
  leads: Users,
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
  const router = useRouter();

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
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
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch {
      setResults([]);
    }
    setLoading(false);
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="relative flex justify-center pt-[15vh] px-4">
        <div className="w-full max-w-lg bg-popover rounded-xl shadow-2xl border border-border overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-border">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search leads, calls, invoices, estimates..."
              className="flex-1 h-12 text-sm text-foreground placeholder:text-muted-foreground bg-transparent outline-none"
            />
            {loading && <Loader2 className="size-4 text-muted-foreground animate-spin shrink-0" />}
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] text-muted-foreground font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="max-h-80 overflow-y-auto py-2">
              {(() => {
                let flatIndex = 0;
                return results.map((group) => {
                  const Icon = TYPE_ICONS[group.type] || Search;
                  return (
                    <div key={group.type}>
                      <p className="px-4 pt-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        const currentIndex = flatIndex++;
                        const isSelected = currentIndex === selectedIndex;
                        return (
                          <button
                            key={item.id}
                            type="button"
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
        </div>
      </div>
    </div>
  );
}
