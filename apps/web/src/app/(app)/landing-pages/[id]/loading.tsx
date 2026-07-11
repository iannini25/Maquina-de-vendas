/** Skeleton do editor de landing page (shimmer). */
export default function LandingEditorLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,380px)]">
      <div className="skeleton h-[420px]" />
      <div className="skeleton h-[560px]" />
      <div className="skeleton hidden h-[560px] lg:block" />
    </div>
  );
}
