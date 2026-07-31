// apps/web/components/UtilityBar.tsx
export function UtilityBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg px-5 py-2.5 font-mono text-[11px] text-muted flex gap-5 flex-wrap border-b border-rule">
      {children}
    </div>
  );
}

export function UtilityLink({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`uppercase tracking-wide cursor-pointer ${active ? 'text-accent' : 'text-muted'}`}
    >
      {children}
    </span>
  );
}
