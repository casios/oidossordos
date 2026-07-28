// apps/web/app/page.tsx
import { fetchEvents } from '../lib/api-client';
import { EventRow } from '../components/EventRow';

export default async function HomePage() {
  const { data: events } = await fetchEvents({});

  return (
    <div className="max-w-[820px] mx-auto">
      <nav className="flex justify-between items-center px-2 py-5 border-b border-rule">
        <span className="font-bold tracking-wide">Agenda Metal</span>
        <div className="flex gap-6 text-sm font-mono">
          <a className="text-accent border-b border-accent pb-0.5">Eventos</a>
          <a className="text-muted">Bandas</a>
          <a className="text-muted">Venues</a>
          <a className="text-muted">Mi cuenta</a>
        </div>
      </nav>

      <header className="px-2 pt-9 pb-2">
        <h1 className="text-[28px] font-bold mb-1.5">Próximos eventos</h1>
        <p className="font-mono text-sm text-muted">
          Conciertos y festivales de metal, cargados por la comunidad.
        </p>
      </header>

      <section>
        {events.length === 0 ? (
          <p className="px-2 py-10 text-muted font-mono text-sm">
            Todavía no hay eventos aprobados. Sé el primero en agregar uno.
          </p>
        ) : (
          events.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </section>
    </div>
  );
}
