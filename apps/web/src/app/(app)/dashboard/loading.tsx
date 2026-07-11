/** Skeleton do Dashboard (shimmer) enquanto as agregações carregam. */
export default function DashboardLoading() {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div>
          <div className="skeleton h-4 w-28" />
          <div className="skeleton mt-1.5 h-3 w-56" />
        </div>
        <div className="skeleton ml-auto h-9 w-32 rounded-full" />
      </div>
      <div className="grid grid-cols-12 gap-4 p-6">
        <div className="skeleton col-span-12 h-48 xl:col-span-8" />
        <div className="skeleton col-span-12 h-48 xl:col-span-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`kpi-${i}`} className="skeleton col-span-12 h-32 sm:col-span-6 xl:col-span-4" />
        ))}
        <div className="skeleton col-span-12 h-56 xl:col-span-8" />
        <div className="skeleton col-span-12 h-56 xl:col-span-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`list-${i}`} className="skeleton col-span-12 h-52 md:col-span-6 xl:col-span-4" />
        ))}
      </div>
    </>
  );
}
