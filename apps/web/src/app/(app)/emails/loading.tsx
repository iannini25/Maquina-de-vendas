/** Skeleton dos Templates de E-mail (topbar + banner + grid de cards). */
export default function EmailsLoading() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-48 rounded-lg" />
      </header>
      <div className="flex flex-col gap-5 p-6">
        <div className="skeleton h-12 rounded-2xl" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-52 rounded-2xl" />
          ))}
        </div>
      </div>
    </>
  );
}
