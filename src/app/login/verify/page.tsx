import { Card } from "@/components/ui/Card";
import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
        <p className="mt-2 text-gray-500">
          A sign-in link has been sent to your email address.
        </p>
        <p className="mt-4 text-sm text-gray-400">
          Click the link in the email to complete your sign in.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-blue-600 hover:text-blue-700"
        >
          Back to sign in
        </Link>
      </Card>
    </div>
  );
}
