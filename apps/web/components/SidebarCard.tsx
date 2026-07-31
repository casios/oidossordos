// apps/web/components/SidebarCard.tsx
export function SidebarCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-bg border border-rule p-4">
      <h3 className="text-[11px] uppercase tracking-wide text-accent mb-3">{title}</h3>
      {children}
    </div>
  );
}

export function SidebarItem({
  label,
  detail,
}: {
  label: string;
  detail?: string;
}) {
  return (
    <div className="font-mono text-xs text-muted py-2 border-b border-rule last:border-b-0">
      <b className="font-display block text-[13px] font-medium text-fg">{label}</b>
      {detail}
    </div>
  );
}
