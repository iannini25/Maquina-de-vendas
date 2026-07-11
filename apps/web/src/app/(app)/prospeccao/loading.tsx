/** Skeleton da Prospecção (topbar + abas + banner Vibe + cards de fonte). */
export default function ProspeccaoLoading() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-44 rounded-lg" />
      </header>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-36 rounded-lg" />
          ))}
        </div>
        <div className="skeleton h-24 rounded-2xl" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    </>
  );
}
