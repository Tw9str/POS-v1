import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center max-w-sm space-y-4">
        <p className="text-6xl font-bold text-slate-200">404</p>
        <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
        <p className="text-sm text-slate-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
