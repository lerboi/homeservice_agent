// Shared design tokens for consistent styling across onboarding + dashboard
// Phase 49: all color references migrated to CSS variables (DARK-04, POLISH-08)

export const colors = {
  brandOrange: 'var(--brand-accent)',
  brandOrangeDark: 'var(--brand-accent-hover)',
  navy: 'var(--sidebar)',
  warmSurface: 'var(--warm-surface)',
  bodyText: 'var(--body-text)',
};

export const btn = {
  primary:
    'bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 active:bg-[var(--brand-accent-hover)] active:scale-95 text-[var(--brand-accent-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-all duration-150',
};

export const card = {
  base: 'bg-card rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-border',
  hover: 'hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200',
};

export const glass = {
  topBar: 'bg-card/80 backdrop-blur-md border-b border-border',
};

export const gridTexture = {
  dark: 'bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]',
  light: 'bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-[size:48px_48px]',
};

export const heading = 'text-foreground tracking-tight';
export const body = 'text-muted-foreground';

export const focus = {
  ring: 'focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1',
};

export const selected = {
  card: 'border-[var(--brand-accent)] bg-[var(--selected-fill)]',
  cardIdle: 'border-border bg-muted hover:bg-accent',
};
