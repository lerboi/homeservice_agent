/**
 * The labelled pills either side of a product hero's illustration, each wired
 * to it by a short line: what the product listens to on one side, where its
 * work lands on the other. Desktop only; hidden below `lg`.
 *
 * @param {string[]} items
 * @param {'left'|'right'} side  - which side of the illustration it sits on
 * @param {'signal'|'spark'} tone - the product's colour
 * @param {string} [label]        - small heading above the pills
 */
export function ReachColumn({ items, side, tone = 'signal', label }) {
  const left = side === 'left';
  const dot = tone === 'spark' ? 'bg-mk-spark-deep' : 'bg-mk-signal-deep';
  const text = tone === 'spark' ? 'text-mk-spark-deep' : 'text-mk-signal-deep';
  return (
    <div className={`hidden flex-col justify-center gap-5 lg:flex ${left ? 'items-end' : 'items-start'}`} aria-hidden="true">
      {label && (
        <p className={`font-code text-[10px] uppercase tracking-[0.16em] ${text} ${left ? 'pr-[5.5rem]' : 'pl-[5.5rem]'}`}>{label}</p>
      )}
      <ul className={`flex flex-col gap-5 ${left ? 'items-end' : 'items-start'}`}>
        {items.map((item, i) => (
          <li key={item} className={`flex items-center ${left ? 'flex-row' : 'flex-row-reverse'}`}>
            <span className="whitespace-nowrap rounded-full border border-mk-ink/15 bg-white px-4 py-2 font-code text-[11px] uppercase tracking-[0.12em] text-mk-ink">
              {item}
            </span>
            <span className={`h-px bg-mk-ink/25 ${i === 1 ? 'w-10' : 'w-20'}`} />
            <span className={`size-1.5 rounded-full ${dot}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
