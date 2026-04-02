'use client';

export default function DashboardError({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h2 className="text-lg font-semibold text-[#0F172A] mb-2">Something went wrong</h2>
      <p className="text-sm text-[#475569] mb-4 max-w-md">
        An unexpected error occurred. Try refreshing the page.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium text-white bg-[#C2410C] rounded-lg hover:bg-[#B53B0A] transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
