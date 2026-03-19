export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <nav className="mb-6 text-sm text-slate-500" aria-label="Breadcrumb">
          <span>Dashboard</span>
          <span className="mx-2 text-slate-300">&rsaquo;</span>
          <span className="text-slate-900 font-semibold">Services</span>
        </nav>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {children}
        </div>
      </div>
    </div>
  );
}
