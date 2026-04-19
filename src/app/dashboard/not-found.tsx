import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-4">
        <p className="text-6xl font-bold text-slate-200">404</p>
        <h2 className="text-lg font-bold text-slate-900">Page not found</h2>
        <p className="text-sm text-slate-500">
          This dashboard page doesn't exist.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
