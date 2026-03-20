export function GridTexture({ variant = 'light' }) {
  const style =
    variant === 'dark'
      ? {
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }
      : {
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.015) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        };

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={style}
      aria-hidden="true"
    />
  );
}
