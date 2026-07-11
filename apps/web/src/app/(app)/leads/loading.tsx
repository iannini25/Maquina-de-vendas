/** Skeleton da tela Leads durante o carregamento. */
export default function LeadsLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-4 border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-24" />
        <div className="ml-auto">
          <div className="skeleton h-9 w-32 rounded-full" />
        </div>
      </div>
      <div className="space-y-4 p-6">
        <div className="skeleton h-12 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}
