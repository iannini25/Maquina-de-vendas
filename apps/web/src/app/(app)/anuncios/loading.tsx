/** Skeleton da tela Anúncios & Tráfego (shimmer). */
export default function AnunciosLoading() {
  return (
    <div className="space-y-5 p-6">
      <div className="skeleton h-10 w-96 max-w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-16" />
          ))}
        </div>
        <div className="skeleton h-80" />
      </div>
    </div>
  );
}
