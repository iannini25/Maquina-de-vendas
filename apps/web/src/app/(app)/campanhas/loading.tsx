/** Skeleton da lista de campanhas (topbar + chips + grid 2-col de cards). */
export default function CampanhasLoading() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-44 rounded-lg" />
      </header>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    </>
  );
}
