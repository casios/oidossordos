// apps/web/lib/api-client.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface EventListItem {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  venue: { name: string; city: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function fetchEvents(params: {
  city?: string;
  q?: string;
  page?: number;
}): Promise<PaginatedResponse<EventListItem>> {
  const search = new URLSearchParams();
  if (params.city) search.set('city', params.city);
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));

  const res = await fetch(`${API_BASE}/events?${search.toString()}`, {
    next: { revalidate: 60 }, // ISR corto — listados cambian con frecuencia moderada
  });

  if (!res.ok) {
    throw new Error(`Error al cargar eventos: ${res.status}`);
  }

  return res.json();
}

export interface EventBandEntry {
  id: string;
  startTime: string | null;
  endTime: string | null;
  billingOrder: number | null;
  band: { id: string; name: string; slug: string };
  eventStage: { id: string; displayName: string | null; stage: { name: string } } | null;
}

export interface EventDetail extends EventListItem {
  description: string | null;
  endDate: string | null;
  status: string;
  venue: { name: string; city: string; capacity: number | null };
  ticketInfo: { priceMin: number | null; priceMax: number | null; currency: string; externalUrl: string | null } | null;
  eventBands: EventBandEntry[];
}

export async function fetchEventDetail(idOrSlug: string): Promise<EventDetail> {
  const res = await fetch(`${API_BASE}/events/${idOrSlug}`, {
    next: { revalidate: 60 },
  });

  if (res.status === 404) {
    throw new Error('NOT_FOUND');
  }
  if (!res.ok) {
    throw new Error(`Error al cargar el evento: ${res.status}`);
  }

  return res.json();
}
