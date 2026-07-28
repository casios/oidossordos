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
