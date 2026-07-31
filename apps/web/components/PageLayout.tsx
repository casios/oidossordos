// apps/web/components/PageLayout.tsx
export function PageLayout({
  main,
  sidebar,
}: {
  main: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_280px] gap-6 max-w-[1100px] mx-auto px-5 py-6">
      <div className="min-w-0">{main}</div>
      <div className="flex flex-col gap-5">{sidebar}</div>
    </div>
  );
}
