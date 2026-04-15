'use client';

/**
 * RevenueInput — inline dollar amount input shown when changing status to Completed or Paid.
 */
export default function RevenueInput({ value, onChange, required, error }) {
  const hasError = required && (value === '' || value === null || value === undefined);
  const showError = error || hasError;

  return (
    <div className="space-y-1">
      <div
        className={`
          flex items-center h-10 rounded-md border bg-card overflow-hidden transition-colors
          ${showError ? 'border-red-500 ring-1 ring-red-200' : 'border-border focus-within:border-[var(--brand-accent)] focus-within:ring-1 focus-within:ring-[var(--brand-accent)]/30'}
        `}
      >
        {/* Dollar prefix */}
        <span className="flex-shrink-0 flex items-center justify-center h-full px-2.5 text-sm font-medium text-muted-foreground bg-muted border-r border-border select-none">
          $
        </span>
        {/* Number input */}
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Revenue amount in dollars"
          aria-required={required}
          aria-invalid={!!showError}
          className="
            flex-1 h-full px-2.5 text-sm text-foreground bg-transparent outline-none
            placeholder:text-muted-foreground
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
          "
        />
      </div>

      {/* Validation error message */}
      {showError && (
        <p className="text-xs text-red-600" role="alert">
          {error || 'Enter a revenue amount to save this as Paid.'}
        </p>
      )}
    </div>
  );
}
