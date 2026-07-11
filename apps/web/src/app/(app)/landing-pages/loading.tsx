/** Skeleton da listagem de landing pages (shimmer). */
export default function LandingPagesLoading() {
  return (
    <div className="p-6">
      <div className="skeleton mb-5 h-12 w-full" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton h-60" />
        ))}
      </div>
    </div>
  );
}
