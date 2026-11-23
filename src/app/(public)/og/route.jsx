import { ImageResponse } from 'next/og';

// Note: `export const runtime = 'edge'` was removed for Next.js 16 cacheComponents compatibility.
// `runtime` segment config is rejected when nextConfig.cacheComponents is enabled (Phase 54 INTFOUND-03).
// ImageResponse runs on the default (Node) runtime without regressions.

// Brand colours (2026-11 rebrand): paper, ink, signal. Kept as literals:
// ImageResponse cannot read the CSS tokens.
const PAPER = '#F7F8F5';
const INK = '#0B0F14';
const SIGNAL = '#00B37E';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get('title') ?? 'AI that does the work.').slice(0, 120);
  const type = (searchParams.get('type') ?? 'VOCO').slice(0, 24);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          padding: '72px 80px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '999px', background: SIGNAL, marginRight: '14px' }} />
          <div style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '0.16em', color: '#55606B', textTransform: 'uppercase' }}>
            {type}
          </div>
        </div>

        <div style={{ fontSize: '76px', fontWeight: 600, color: INK, lineHeight: 1.05, letterSpacing: '-0.03em', maxWidth: '1000px' }}>
          {title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `2px solid ${INK}`, paddingTop: '24px' }}>
          <div style={{ fontSize: '34px', fontWeight: 700, color: INK, letterSpacing: '-0.02em' }}>Voco</div>
          <div style={{ fontSize: '24px', color: '#55606B' }}>Voice agents and AI agents in your systems</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
