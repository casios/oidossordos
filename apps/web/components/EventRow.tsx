// apps/web/components/EventRow.tsx
import Link from 'next/link';
import type { EventListItem } from '../lib/api-client';

export function EventRow({ event }: { event: EventListItem }) {
  const date = new Date(event.startDate);
  const day = date.toLocaleDateString('es-MX', { day: '2-digit' });
  const month = date.toLocaleDateString('es-MX', { month: 'short' });

  return (
    <Link
      href={`/eventos/${event.slug}`}
      className="grid grid-cols-[70px_1fr] gap-4 items-center py-4 px-3.5 border-b border-rule even:bg-stripe hover:bg-stripe/60 transition-colors no-underline text-fg"
    >
      <div className="font-mono">
        <div className="text-xl font-bold text-accent leading-none">{day}</div>
        <div className="text-[10px] text-muted uppercase tracking-wider">{month}</div>
      </div>
      <div>
        <p className="text-base font-medium mb-1">{event.name}</p>
        <p className="font-mono text-[11px] text-muted">
          {event.venue.name} · {event.venue.city}
        </p>
      </div>
    </Link>
  );
}
