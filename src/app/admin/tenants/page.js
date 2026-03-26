'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const PAGE_SIZE = 25;

function SubStatusBadge({ status }) {
  if (!status) return <span className="text-slate-400">---</span>;

  const styles = {
    active: 'bg-green-800/10 text-green-800',
    trialing: 'bg-blue-700/10 text-blue-700',
    past_due: 'bg-amber-800/10 text-amber-800',
    canceled: 'bg-slate-600/10 text-slate-600',
  };

  const style = styles[status] || 'bg-slate-600/10 text-slate-600';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <TableRow key={i}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // tenant ID with in-progress action

  // Pending provisioning_failed toggle state
  const [pendingToggle, setPendingToggle] = useState(null); // { tenantId, newValue, businessName }

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/tenants?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch tenants');
      const json = await res.json();
      setTenants(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      toast.error('Failed to load tenants');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function handleToggleProvisioningFailed(tenantId, newValue) {
    setActionLoading(tenantId);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provisioning_failed: newValue }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to update');
      }
      // Update local state
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, provisioning_failed: newValue } : t))
      );
      toast.success(newValue ? 'Tenant flagged as provisioning failed' : 'Provisioning failed flag cleared');
    } catch (err) {
      toast.error(err.message || 'Update failed');
    } finally {
      setActionLoading(null);
      setPendingToggle(null);
    }
  }

  async function handleReProvision(tenantId, businessName) {
    setActionLoading(tenantId);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(
            'Re-provisioning failed. No Singapore numbers are available. Add numbers to inventory and try again.'
          );
        }
        throw new Error(json.error || 'Re-provisioning failed');
      }
      toast.success('Number provisioned successfully');
      fetchTenants();
    } catch (err) {
      toast.error(err.message || 'Re-provisioning failed');
    } finally {
      setActionLoading(null);
    }
  }

  const startIndex = page * PAGE_SIZE + 1;
  const endIndex = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Tenants</h1>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by business name or owner..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full max-w-sm pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-white hover:bg-white">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Business Name
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Owner
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Country
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Phone Number
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Plan
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sub Status
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Onboarding
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Prov. Failed
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <p className="text-base font-semibold text-slate-900 mb-1">No tenants yet</p>
                  <p className="text-sm text-slate-500">
                    Tenants will appear here after completing onboarding. Check back after the first signup.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant) => (
                <TableRow key={tenant.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-900 text-sm">
                    {tenant.business_name || '---'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {tenant.owner_name || '---'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700 uppercase">
                    {tenant.country || '---'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {tenant.retell_phone_number || '---'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {tenant.plan_id
                      ? tenant.plan_id.charAt(0).toUpperCase() + tenant.plan_id.slice(1)
                      : '---'}
                  </TableCell>
                  <TableCell>
                    <SubStatusBadge status={tenant.subscription_status} />
                  </TableCell>
                  <TableCell>
                    {tenant.onboarding_complete ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-slate-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    {/* Switch wrapped in AlertDialog for confirmation */}
                    <AlertDialog
                      open={pendingToggle?.tenantId === tenant.id}
                      onOpenChange={(open) => {
                        if (!open) setPendingToggle(null);
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Switch
                          checked={tenant.provisioning_failed === true}
                          disabled={actionLoading === tenant.id}
                          onCheckedChange={(checked) => {
                            setPendingToggle({
                              tenantId: tenant.id,
                              newValue: checked,
                              businessName: tenant.business_name,
                            });
                          }}
                        />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {pendingToggle?.newValue
                              ? 'Mark as provisioning failed?'
                              : 'Clear provisioning failed flag?'}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {pendingToggle?.newValue
                              ? 'This flags the tenant for admin follow-up.'
                              : 'Only clear this after confirming the tenant has a working phone number assigned.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleToggleProvisioningFailed(
                                pendingToggle.tenantId,
                                pendingToggle.newValue
                              )
                            }
                          >
                            Confirm
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* View as button */}
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard?impersonate=${tenant.id}&impersonate_name=${encodeURIComponent(
                              tenant.business_name || ''
                            )}`
                          )
                        }
                        className="text-xs px-2 py-1 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        View as
                      </button>

                      {/* Trigger Re-Provisioning — only when provisioning_failed = true */}
                      {tenant.provisioning_failed && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              disabled={actionLoading === tenant.id}
                              className="text-xs px-2 py-1 bg-[#1D4ED8] text-white rounded hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {actionLoading === tenant.id ? 'Working...' : 'Trigger Re-Provisioning'}
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Trigger re-provisioning for {tenant.business_name}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will attempt to assign a Singapore number from inventory. The
                                tenant must have provisioning_failed = true.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleReProvision(tenant.id, tenant.business_name)
                                }
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Showing {startIndex}–{endIndex} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="p-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={endIndex >= total || loading}
              className="p-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
