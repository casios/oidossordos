// apps/web/app/eventos/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { fetchEventDetail } from '../../../lib/api-client';
import { UtilityBar, UtilityLink } from '../../../components/UtilityBar';
import { PageLayout } from '../../../components/PageLayout';
import { SidebarCard, SidebarItem } from '../../../components/SidebarCard';
import { LineupStageList } from '../../../components/LineupStageList';

export default async function EventDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  let event;
  try {
    event = await fetchEventDetail(params.slug);
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_FOUND') notFound();
    throw err;
  }

  const startDate = new Date(event.startDate);
  const dateRange = event.endDate
    ? `${startDate.toLocaleDateString('es-MX')} — ${new Date(event.endDate).toLocaleDateString('es-MX')}`
    : startDate.toLocaleDateString('es-MX');

  return (
    <>
      <UtilityBar>
        <UtilityLink>Eventos</UtilityLink>
        <span>›</span>
        <UtilityLink>{event.venue.name}</UtilityLink>
        <span>›</span>
        <UtilityLink active>{event.name}</UtilityLink>
      </UtilityBar>

      <PageLayout
        main={
          <div>
            <div className="pb-5 border-b border-rule mb-5">
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted mb-2">
                Evento
              </p>
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <h1 className="text-[28px] font-bold mb-1.5 leading-tight">
                    {event.name}
                  </h1>
                  <p className="font-mono text-xs text-muted">
                    {dateRange} · {event.venue.name}, {event.venue.city}
                  </p>
                </div>
                {event.status === 'aprobado' && (
                  <span className="font-mono text-[11px] uppercase tracking-wide text-bg bg-accent px-3 py-1.5 -rotate-3 inline-block">
                    Aprobado
                  </span>
                )}
              </div>
            </div>

            <LineupStageList eventBands={event.eventBands} />
          </div>
        }
        sidebar={
          <>
            {event.ticketInfo && (
              <SidebarCard title="Boletos">
                <SidebarItem
                  label={
                    event.ticketInfo.priceMin
                      ? `Desde $${event.ticketInfo.priceMin} ${event.ticketInfo.currency}`
                      : 'Precio por confirmar'
                  }
                  detail={event.ticketInfo.externalUrl ? 'Comprar boletos ↗' : undefined}
                />
              </SidebarCard>
            )}
            <SidebarCard title="Venue">
              <SidebarItem
                label={event.venue.name}
                detail={`Capacidad ${event.venue.capacity ?? '—'} · ${event.venue.city}`}
              />
            </SidebarCard>
          </>
        }
      />
    </>
  );
}
