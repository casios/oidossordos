// apps/web/components/PrimaryNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Eventos' },
  { href: '/bandas', label: 'Bandas' },
  { href: '/venues', label: 'Venues' },
  { href: '/moderacion', label: 'Moderación' },
];

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-black flex justify-center items-center border-b border-rule">
      {LINKS.map((link) => {
        // "/" solo está activo en la home exacta; el resto por prefijo,
        // para que /bandas/gojira siga marcando "Bandas" como activo.
        const isActive =
          link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-[13px] px-5 py-3.5 border-b-2 no-underline ${
              isActive
                ? 'text-fg border-accent'
                : 'text-muted border-transparent'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <div className="ml-auto px-5 py-2.5">
        <input
          placeholder="Buscar..."
          className="bg-stripe border border-rule text-fg font-mono text-xs px-2.5 py-1.5 w-[150px]"
        />
      </div>
    </nav>
  );
}
