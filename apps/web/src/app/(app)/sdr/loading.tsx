/** Skeleton do SDR de IA (topbar + abas + formulário e painel de prévia). */
export default function SdrLoading() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-40 rounded-lg" />
      </header>
      <div className="p-6">
        <div className="flex gap-2 border-b border-hairline-soft pb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-6 w-28 rounded-lg" />
          ))}
        </div>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <div className="skeleton h-11 rounded-[11px]" />
            <div className="skeleton h-11 rounded-[11px]" />
            <div className="skeleton h-10 rounded-full" />
            <div className="skeleton h-10 w-56 rounded-full" />
            <div className="skeleton h-14 rounded-2xl" />
            <div className="skeleton h-14 rounded-2xl" />
          </div>
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    </>
  );
}
