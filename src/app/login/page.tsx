"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
  Signin: "Try signing in with a different account.",
  OAuthSignin: "Try signing in with a different account.",
  OAuthCallbackError: "Try signing in with a different account.",
  OAuthCreateAccount: "Try signing in with a different account.",
  EmailCreateAccount: "Could not create account. Please try again.",
  Callback:
    "The login link is invalid or has expired. Please request a new one.",
  OAuthAccountNotLinked:
    "This email is already linked to another sign-in method.",
  EmailSignin:
    "Failed to send the login email. Please check your email address and try again.",
  CredentialsSignin: "Invalid credentials. Please try again.",
  SessionRequired: "Please sign in to access this page.",
  Verification:
    "The login link has expired or has already been used. Please request a new one.",
  AdapterError: "A server error occurred. Please try again later.",
  Default: "Something went wrong. Please try again.",
};

function getErrorMessage(errorCode: string | null): string {
  if (!errorCode) return "";
  return ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      setError(getErrorMessage(urlError));
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("nodemailer", {
        email,
        redirect: false,
        callbackUrl: "/",
      });

      if (res?.error) {
        setError(getErrorMessage(res.error));
      } else {
        setSent(true);
      }
    } catch {
      setError("Unable to connect. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16a34a"
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
            We sent a login link to <strong>{email}</strong>
          </p>
          <p className="mt-4 text-sm text-gray-400">
            Click the link in the email to sign in. If you don&apos;t see it,
            check your spam folder.
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-6 text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            Use a different email
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-2xl flex items-center justify-center">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to Shampay
          </h1>
          <p className="mt-2 text-gray-500">Admin sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Send magic link
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          We&apos;ll email you a secure login link. No password needed.
        </p>
      </Card>
    </div>
  );
}
