/**
 * Marketing-site primitives (2026-11 rebrand).
 *
 * Every public page is built from these so spacing, type and colour stay in
 * one place. Tokens live in globals.css (`mk-*` colours, `font-display`,
 * `font-code`). Light first: paper and white surfaces, ink for the one or two
 * dark sections, a single green-teal "signal" colour for live states, links
 * and the primary button, hairline borders instead of shadows.
 */
import Link from 'next/link';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function Container({ className, size = 'default', children }) {
  // One page width everywhere so section edges line up with the nav.
  const width = size === 'narrow' ? 'max-w-3xl' : 'max-w-7xl';
  return <div className={cx('mx-auto w-full px-6', width, className)}>{children}</div>;
}

const TONES = {
  paper: 'bg-mk-paper text-mk-ink',
  white: 'bg-white text-mk-ink',
  ink: 'bg-mk-ink text-white',
};

export function Section({ tone = 'paper', id, className, containerClassName, size, bordered = false, children }) {
  return (
    <section
      id={id}
      data-tone={tone}
      className={cx(TONES[tone], 'py-20 md:py-28 scroll-mt-16', bordered && 'border-t border-mk-line', className)}
    >
      <Container size={size} className={containerClassName}>{children}</Container>
    </section>
  );
}

const EM_TONES = {
  signal: 'text-mk-signal',
  spark: 'text-mk-spark',
  'signal-deep': 'text-mk-signal-deep',
  'spark-deep': 'text-mk-spark-deep',
  // Both products at once: green running into amber. Home hero only.
  both: 'bg-linear-to-r from-mk-signal to-mk-spark bg-clip-text text-transparent',
};

/**
 * The emphasised words inside a headline. Same face and weight as the rest of
 * the line; the emphasis is the product's colour (signal = Voice, spark =
 * Agent; use the -deep variants on light surfaces).
 */
export function Em({ children, tone, className }) {
  return <span className={cx(tone && EM_TONES[tone], className)}>{children}</span>;
}

const EYEBROW_TONES = {
  signal: { ink: 'text-mk-signal', light: 'text-mk-signal-deep' },
  spark: { ink: 'text-mk-spark', light: 'text-mk-spark-deep' },
};

/** Small mono label above a heading. */
export function Eyebrow({ children, onInk = false, tone = 'signal', className }) {
  return (
    <p
      className={cx(
        'font-code text-[11px] uppercase tracking-[0.16em]',
        EYEBROW_TONES[tone][onInk ? 'ink' : 'light'],
        className,
      )}
    >
      {children}
    </p>
  );
}

export function PageTitle({ children, className }) {
  return (
    <h1
      className={cx(
        'font-display text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[4.25rem]',
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function SectionTitle({ children, className, as: Tag = 'h2' }) {
  return (
    <Tag className={cx('font-display text-3xl font-medium leading-[1.1] tracking-[-0.025em] md:text-[2.75rem]', className)}>
      {children}
    </Tag>
  );
}

export function Lede({ children, onInk = false, className }) {
  return (
    <p className={cx('text-lg leading-relaxed', onInk ? 'text-white/70' : 'text-mk-muted', className)}>
      {children}
    </p>
  );
}

/** Eyebrow + title + optional lede, the standard section opener. */
export function SectionHeader({ eyebrow, title, lede, onInk = false, tone, align = 'left', className }) {
  return (
    <div className={cx('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && <Eyebrow onInk={onInk} tone={tone}>{eyebrow}</Eyebrow>}
      <SectionTitle className={eyebrow ? 'mt-4' : undefined}>{title}</SectionTitle>
      {lede && <Lede onInk={onInk} className="mt-5">{lede}</Lede>}
    </div>
  );
}

const HERO_TONES = {
  paper: 'border-b border-mk-line bg-mk-paper text-mk-ink',
  white: 'border-b border-mk-line bg-white text-mk-ink',
  signal: 'border-b border-mk-ink/10 bg-mk-signal-wash text-mk-ink',
  spark: 'border-b border-mk-ink/10 bg-mk-spark-wash text-mk-ink',
  ink: 'bg-mk-ink text-white',
};

/**
 * Page opener for interior pages, with room for the fixed nav. `tone` sets the
 * surface so pages do not all open alike: signal for Voco Voice pages, spark
 * for Voco Agent pages, ink for the tools pages, paper or white otherwise.
 */
export function PageHero({ eyebrow, title, lede, children, size, tone = 'paper' }) {
  const onInk = tone === 'ink';
  return (
    <section className={cx('relative overflow-hidden pb-16 pt-32 md:pb-20 md:pt-40', HERO_TONES[tone])}>
      <div
        className={cx(
          'pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_right,transparent_30%,black)]',
          onInk ? 'mk-grid-ink' : 'mk-grid-paper',
        )}
        aria-hidden="true"
      />
      <Container size={size} className="relative">
        {eyebrow && <Eyebrow onInk={onInk} tone={tone === 'spark' ? 'spark' : 'signal'}>{eyebrow}</Eyebrow>}
        <PageTitle className={cx('max-w-4xl', eyebrow && 'mt-5')}>{title}</PageTitle>
        {lede && <Lede onInk={onInk} className="mt-6 max-w-2xl">{lede}</Lede>}
        {children && <div className="mt-9">{children}</div>}
      </Container>
    </section>
  );
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-signal focus-visible:ring-offset-2';
const BUTTON_SIZES = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};
const BUTTON_VARIANTS = {
  // Ink text on the signal colour: about 7:1 contrast. White text on it fails.
  primary: 'bg-mk-signal text-mk-ink hover:bg-[#00C48A]',
  // Voco Agent's colour. Ink text on amber, same contrast reasoning.
  spark: 'bg-mk-spark text-mk-ink hover:bg-[#FFBD45]',
  secondary: 'border border-mk-ink/20 bg-transparent text-mk-ink hover:border-mk-ink/50',
  secondaryOnInk: 'border border-white/25 bg-transparent text-white hover:border-white/60',
  ink: 'bg-mk-ink text-white hover:bg-mk-ink-soft',
};

export function buttonClasses({ variant = 'primary', size = 'md', className } = {}) {
  return cx(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_VARIANTS[variant], className);
}

export function ButtonLink({ href, variant = 'primary', size = 'md', className, children, ...rest }) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}

export function Card({ className, as: Tag = 'div', children, ...rest }) {
  return (
    <Tag className={cx('rounded-xl border border-mk-line bg-white', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Text link in the signal colour. */
export function TextLink({ href, children, className }) {
  return (
    <Link
      href={href}
      className={cx(
        'font-medium text-mk-signal-deep underline decoration-mk-signal-deep/30 underline-offset-4 hover:decoration-mk-signal-deep',
        className,
      )}
    >
      {children}
    </Link>
  );
}
