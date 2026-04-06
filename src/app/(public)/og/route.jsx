import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? 'Voco AI Receptionist';
  const type = searchParams.get('type') ?? 'PAGE';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0F172A 0%, #1C1412 60%, #C2410C 100%)',
          padding: '80px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Page type badge */}
        <div
          style={{
            background: '#F97316',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            padding: '6px 16px',
            borderRadius: '999px',
            marginBottom: '32px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {type}
        </div>
        {/* Title */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: '700',
            color: 'white',
            lineHeight: 1.15,
            maxWidth: '900px',
          }}
        >
          {title}
        </div>
        {/* Voco branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '80px',
            fontSize: '24px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          voco.live
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
