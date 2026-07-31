// apps/web/app/page.tsx
import { fetchEvents } from '../lib/api-client';
import { EventRow } from '../components/EventRow';
import { UtilityBar, UtilityLink } from '../components/UtilityBar';
import { PageLayout } from '../components/PageLayout';
import { SidebarCard, SidebarItem } from '../components/SidebarCard';

export default async function HomePage() {
  const { data: events } = await fetchEvents({});

  return (
    <>
      <UtilityBar>
        <UtilityLink active>Todas las ciudades</UtilityLink>
        <UtilityLink>Este mes</UtilityLink>
        <UtilityLink>Death Metal</UtilityLink>
        <UtilityLink>Festivales</UtilityLink>
        <UtilityLink>Excluir tributos</UtilityLink>
      </UtilityBar>

      <PageLayout
        main={
          events.length === 0 ? (
            <p className="font-mono text-sm text-muted py-10">
              Todavía no hay eventos aprobados. Sé el primero en agregar uno.
            </p>
          ) : (
            events.map((event) => <EventRow key={event.id} event={event} />)
          )
        }
        sidebar={
          <>
            <SidebarCard title="Actividad reciente">
              <SidebarItem
                label="Gojira"
                detail="agregado al line-up de Hell and Heaven"
              />
              <SidebarItem
                label="Foro Underground Coyoacán"
                detail="venue nuevo, pendiente"
              />
            </SidebarCard>
            <SidebarCard title="En cifras">
              <SidebarItem label="1,204 eventos activos" />
              <SidebarItem label="312 bandas homologadas" />
            </SidebarCard>
          </>
        }
      />
    </>
  );
}
