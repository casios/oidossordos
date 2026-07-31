// apps/web/components/LineupStageList.tsx
import Link from 'next/link';
import type { EventBandEntry } from '../lib/api-client';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function LineupStageList({ eventBands }: { eventBands: EventBandEntry[] }) {
  // Agrupar por nombre de escenario (o "General" si el evento tiene uno solo)
  const byStage = new Map<string, EventBandEntry[]>();
  for (const eb of eventBands) {
    const stageName =
      eb.eventStage?.displayName ?? eb.eventStage?.stage.name ?? 'General';
    if (!byStage.has(stageName)) byStage.set(stageName, []);
    byStage.get(stageName)!.push(eb);
  }

  return (
    <div className="mt-5">
      <p className="text-[13px] font-medium uppercase tracking-wide text-muted mb-3.5">
        Line-up
      </p>

      {Array.from(byStage.entries()).map(([stageName, bands]) => (
        <div key={stageName} className="mb-7">
          <p className="text-sm font-medium uppercase mb-2.5">{stageName}</p>
          <div className="grid grid-cols-[80px_1fr] font-mono text-[10px] uppercase tracking-wide text-muted border-b border-rule pb-1.5">
            <span>Hora</span>
            <span>Banda</span>
          </div>
          {bands
            .sort((a, b) => (a.billingOrder ?? 99) - (b.billingOrder ?? 99))
            .map((eb) => (
              <div
                key={eb.id}
                className="grid grid-cols-[80px_1fr] items-center py-2.5 px-2 border-b border-rule even:bg-stripe"
              >
                <span className="font-mono text-xs text-muted">
                  {formatTime(eb.startTime)}
                </span>
                <Link
                  href={`/bandas/${eb.band.slug}`}
                  className={`text-[13px] no-underline hover:underline ${
                    eb.billingOrder === 1
                      ? 'text-accent-bright font-bold'
                      : 'text-accent'
                  }`}
                >
                  {eb.band.name}
                  {eb.billingOrder === 1 ? ' · Headliner' : ''}
                </Link>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
