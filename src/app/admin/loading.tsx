export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-slate-200 rounded-lg" />
          <div className="h-4 w-44 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-10 w-24 bg-slate-200 rounded-xl" />
      </div>

      {/* 6-column stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
          >
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="h-6 w-12 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="h-12 bg-slate-50 border-b border-slate-200" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 h-14 border-b border-slate-100"
          >
            <div className="h-4 w-32 bg-slate-100 rounded" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-100 rounded" />
            <div className="flex-1" />
            <div className="h-4 w-16 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
