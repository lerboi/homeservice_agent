// Shared design tokens for consistent styling across onboarding + dashboard

export const colors = {
  brandOrange: '#C2410C',
  brandOrangeDark: '#9A3412',
  navy: '#0F172A',
  warmSurface: '#F5F5F4',
  bodyText: '#475569',
};

export const btn = {
  primary:
    'bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95 text-white shadow-[0_1px_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all duration-150',
};

export const card = {
  base: 'bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-stone-200/60',
  hover: 'hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200',
};

export const glass = {
  topBar: 'bg-white/80 backdrop-blur-md border-b border-stone-200/60',
};

export const gridTexture = {
  dark: 'bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]',
  light: 'bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-[size:48px_48px]',
};

export const heading = 'text-[#0F172A] tracking-tight';
export const body = 'text-[#475569]';

export const focus = {
  ring: 'focus:outline-none focus:ring-2 focus:ring-[#C2410C] focus:ring-offset-1',
};

export const selected = {
  card: 'border-[#C2410C] bg-[#C2410C]/[0.04]',
  cardIdle: 'border-stone-200 bg-[#F5F5F4] hover:bg-stone-100',
};
