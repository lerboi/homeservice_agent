import Link from 'next/link';

export const metadata = { title: 'Access Denied | Voco Admin' };

export default function AdminForbiddenPage() {
  return (
    <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-slate-300 mb-4">403</div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500 mb-6">
          You don&apos;t have permission to access the admin dashboard. Sign in with an admin account or return to your dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/auth/signin"
            className="px-4 py-2 bg-[#1D4ED8] text-white rounded-md text-sm font-medium hover:bg-blue-800 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
