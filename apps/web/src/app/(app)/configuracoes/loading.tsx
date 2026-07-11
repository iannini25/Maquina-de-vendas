/** Skeleton das Configurações (topbar + sub-nav + banner + cards). */
export default function ConfiguracoesLoading() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-64 rounded-lg" />
      </header>
      <div className="flex gap-6 p-6">
        <div className="hidden w-56 shrink-0 space-y-2 lg:block">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-[11px]" />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="skeleton h-14 rounded-2xl" />
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton h-9 rounded-full" />
            ))}
          </div>
          <div className="skeleton h-12 rounded-2xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    </>
  );
}
