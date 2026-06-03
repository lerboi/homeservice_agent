import Link from 'next/link';

// Server component — rendered for unmatched routes. Lives inside the root
// layout, so Tailwind utility classes are available here.
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
      >
        Go home
      </Link>
    </div>
  );
}
