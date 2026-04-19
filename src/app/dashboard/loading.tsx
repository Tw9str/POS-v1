export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-200 rounded-2xl" />
        <div className="space-y-2">
          <div className="h-6 w-40 bg-slate-200 rounded-lg" />
          <div className="h-4 w-56 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
          >
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="h-6 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Nav grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
          >
            <div className="w-10 h-10 bg-slate-100 rounded-xl" />
            <div className="h-4 w-20 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
