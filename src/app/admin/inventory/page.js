'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

// --- Status Badge ---
function StatusBadge({ status }) {
  if (status === 'available') {
    return (
      <Badge className="bg-blue-700/10 text-blue-700 border-0 rounded-full text-xs font-medium">
        available
      </Badge>
    );
  }
  if (status === 'assigned') {
    return (
      <Badge className="bg-green-800/10 text-green-800 border-0 rounded-full text-xs font-medium">
        assigned
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-600/10 text-slate-600 border-0 rounded-full text-xs font-medium">
      retired
    </Badge>
  );
}

// --- Retire/Reactivate confirmation dialogs ---
function RetireDialog({ row, onConfirm, loading }) {
  const isAssigned = row.status === 'assigned';
  const title = isAssigned ? 'Retire an assigned number?' : 'Retire number?';
  const description = isAssigned
    ? 'This removes the number from inventory tracking but does not disconnect it from the active tenant. Proceed only if you have already transferred this tenant to a new number.'
    : 'This number will no longer be assigned to new tenants. It will not affect any tenant currently using it.';

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-red-700 border-red-200 hover:bg-red-50 h-7 px-2 text-xs"
          disabled={loading}
        >
          Retire
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-700 hover:bg-red-800 text-white"
            onClick={() => onConfirm(row.id, 'retire')}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Retire'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReactivateDialog({ row, onConfirm, loading }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-blue-700 border-blue-200 hover:bg-blue-50 h-7 px-2 text-xs"
          disabled={loading}
        >
          Re-activate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Re-activate number?</AlertDialogTitle>
          <AlertDialogDescription>
            This returns the number to available status and it can be assigned to new tenants.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-[#1D4ED8] hover:bg-blue-800 text-white"
            onClick={() => onConfirm(row.id, 'reactivate')}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Re-activate'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Main Page ---
export default function PhoneInventoryPage() {
  // Table state
  const [numbers, setNumbers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // id of row being acted on

  // Add number form
  const [addInput, setAddInput] = useState('');
  const [addError, setAddError] = useState(null);
  const [addLoading, setAddLoading] = useState(false);

  // CSV import
  const [csvExpanded, setCsvExpanded] = useState(false);
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);

  // Search debounce
  const searchDebounceRef = useRef(null);

  const PAGE_SIZE = 25;

  const fetchInventory = useCallback(async (currentPage, currentSearch) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage });
      if (currentSearch) params.set('search', currentSearch);
      const res = await fetch('/api/admin/inventory?' + params.toString());
      const json = await res.json();
      if (res.ok) {
        setNumbers(json.data || []);
        setTotal(json.total || 0);
      } else {
        toast.error('Failed to load inventory');
      }
    } catch {
      toast.error('Network error loading inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchInventory(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Search with 300ms debounce — reset page on new search
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPage(0);
      fetchInventory(0, val);
    }, 300);
  };

  // Add single number
  async function handleAddNumber() {
    if (addInput.length !== 8) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: addInput }),
      });
      const json = await res.json();
      if (res.ok) {
        setAddInput('');
        toast.success('Number added to inventory');
        fetchInventory(0, search);
        setPage(0);
      } else if (res.status === 409 || json.error === 'duplicate') {
        setAddError('That number is already in the inventory. Check the existing entries below.');
      } else {
        toast.error(json.error || 'Failed to add number');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setAddLoading(false);
    }
  }

  // Retire / Reactivate
  async function handleAction(id, action) {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        const label = action === 'retire' ? 'Number retired' : 'Number re-activated';
        toast.success(label);
        fetchInventory(page, search);
      } else {
        const json = await res.json();
        toast.error(json.error || 'Action failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(null);
    }
  }

  // CSV file parsing
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((row, i) => {
          const raw = Array.isArray(row) ? row[0] : row;
          const digits = String(raw).trim().replace(/\D/g, '');
          const valid = /^\d{8}$/.test(digits);
          return { raw: String(raw).trim(), digits, valid, line: i + 1 };
        });
        setCsvPreview(rows);
      },
    });
  }

  // CSV import submission
  async function handleCsvImport() {
    if (!csvPreview) return;
    const validRows = csvPreview.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setCsvLoading(true);
    try {
      const res = await fetch('/api/admin/inventory/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numbers: validRows.map((r) => ({ phone_number: r.digits })),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Imported ${json.inserted} numbers successfully`);
        setCsvPreview(null);
        setCsvExpanded(false);
        fetchInventory(0, search);
        setPage(0);
      } else {
        toast.error(json.error || 'Import failed');
      }
    } catch {
      toast.error('Network error during import');
    } finally {
      setCsvLoading(false);
    }
  }

  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);
  const hasInvalidCsvRows = csvPreview ? csvPreview.some((r) => !r.valid) : false;
  const validCsvCount = csvPreview ? csvPreview.filter((r) => r.valid).length : 0;

  return (
    <div>
      {/* Page heading */}
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Phone Inventory</h1>

      {/* Top cards row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Add Number card */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Add Singapore Number</h2>
          <div className="flex items-stretch gap-0">
            <span className="bg-slate-100 px-3 py-2 text-sm text-slate-500 border border-r-0 border-slate-200 rounded-l-md flex items-center select-none">
              +65
            </span>
            <Input
              className="rounded-l-none border-slate-200 flex-1"
              placeholder="81234567"
              value={addInput}
              maxLength={8}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                setAddInput(val);
                if (addError) setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && addInput.length === 8 && !addLoading) {
                  handleAddNumber();
                }
              }}
            />
          </div>
          {addError && (
            <p className="text-red-600 text-sm mt-2">{addError}</p>
          )}
          <Button
            className="mt-3 bg-[#1D4ED8] hover:bg-blue-800 text-white w-full sm:w-auto"
            disabled={addInput.length !== 8 || addLoading}
            onClick={handleAddNumber}
          >
            {addLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adding...</>
            ) : (
              'Add Number'
            )}
          </Button>
        </Card>

        {/* Bulk CSV Import card */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Bulk Import</h2>
            <button
              className="text-sm text-[#1D4ED8] hover:underline font-medium"
              onClick={() => {
                setCsvExpanded(!csvExpanded);
                if (csvExpanded) setCsvPreview(null);
              }}
            >
              {csvExpanded ? 'Close' : 'Import CSV'}
            </button>
          </div>

          {csvExpanded && (
            <div>
              <p className="text-xs text-slate-500 mb-2">
                One phone number per row, local digits only (e.g. 81234567)
              </p>
              <input
                type="file"
                accept=".csv"
                className="block w-full text-sm text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#1D4ED8] file:text-white hover:file:bg-blue-800 cursor-pointer"
                onChange={handleFileChange}
              />

              {/* CSV preview table */}
              {csvPreview && csvPreview.length > 0 && (
                <div className="mt-3 border border-slate-200 rounded-md overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Line</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Value</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row) => (
                          <tr
                            key={row.line}
                            className={row.valid ? '' : 'bg-red-50'}
                          >
                            <td className="px-3 py-1.5 text-slate-400">{row.line}</td>
                            <td className={`px-3 py-1.5 font-mono ${row.valid ? 'text-slate-700' : 'text-red-700'}`}>
                              {row.raw}
                            </td>
                            <td className="px-3 py-1.5">
                              {row.valid ? (
                                <span className="text-green-700 font-medium">valid</span>
                              ) : (
                                <span className="text-red-700 font-medium">invalid</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hasInvalidCsvRows && (
                    <p className="px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
                      Import failed: {csvPreview.filter((r) => !r.valid).length} row(s) have invalid phone numbers. Fix the highlighted rows and try again.
                    </p>
                  )}
                </div>
              )}

              {csvPreview && (
                <Button
                  className="mt-3 bg-[#1D4ED8] hover:bg-blue-800 text-white"
                  disabled={hasInvalidCsvRows || validCsvCount === 0 || csvLoading}
                  onClick={handleCsvImport}
                >
                  {csvLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importing...</>
                  ) : (
                    `Import ${validCsvCount} Number${validCsvCount !== 1 ? 's' : ''}`
                  )}
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          className="pl-9 border-slate-200"
          placeholder="Search phone numbers..."
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-slate-200">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-4 py-3">Phone Number</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-4 py-3">Country</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-4 py-3">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-4 py-3">Assigned Tenant</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-4 py-3">Created Date</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-4 py-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Loading skeleton — 3 rows
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-slate-50 border-slate-100">
                  <TableCell className="px-4 py-3"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="px-4 py-3"><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell className="px-4 py-3"><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell className="px-4 py-3"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="px-4 py-3"><Skeleton className="h-7 w-16" /></TableCell>
                </TableRow>
              ))
            ) : numbers.length === 0 ? (
              // Empty state
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="px-4 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-700 mb-1">No numbers in inventory</p>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto">
                    Add Singapore phone numbers individually or import a CSV file to make them available for assignment during onboarding.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              numbers.map((row) => (
                <TableRow key={row.id} className="hover:bg-slate-50 border-slate-100">
                  <TableCell className="px-4 py-3 font-mono text-sm text-slate-800">{row.phone_number}</TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-600">{row.country}</TableCell>
                  <TableCell className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-600">
                    {row.assigned_tenant?.business_name || '—'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-slate-500">
                    {new Date(row.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {row.status === 'retired' ? (
                      <ReactivateDialog
                        row={row}
                        onConfirm={handleAction}
                        loading={actionLoading === row.id}
                      />
                    ) : (
                      <RetireDialog
                        row={row}
                        onConfirm={handleAction}
                        loading={actionLoading === row.id}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Showing {start}–{end} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 text-slate-700"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 text-slate-700"
              disabled={end >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
