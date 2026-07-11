/** Skeleton do detalhe da campanha (breadcrumb + h1 + KPIs + gráfico). */
export default function CampanhaDetalheLoading() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-44 rounded-lg" />
      </header>
      <div className="flex flex-col gap-5 p-6">
        <div className="skeleton h-4 w-40 rounded-lg" />
        <div className="skeleton h-8 w-72 rounded-lg" />
        <div className="skeleton h-9 w-96 max-w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-56 rounded-2xl" />
      </div>
    </>
  );
}
