"use client";

import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-browser";

type ProcessResult = {
  transcript: string;
  showNotes: string;
  socialPosts: {
    twitter: string;
    linkedin: string;
    instagram: string;
  };
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signInWithMagicLink = async () => {
    if (!email) return;
    setAuthLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({ email });
    if (signInError) {
      setError(signInError.message);
    } else {
      setError("Check your email for the magic link.");
    }
    setAuthLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setResult(null);
    setFile(null);
  };

  const processAudio = async () => {
    if (!file) {
      setError("Please select an audio file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const response = await fetch("/api/process", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to process audio.");
      }

      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">PodScribe</h1>
        <p className="mt-2 text-slate-300">
          Upload your episode audio, then get transcript, show notes, and social posts in one click.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
        {!session ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Sign in with Supabase</h2>
            <p className="text-sm text-slate-400">Use a magic link email sign-in.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                placeholder="you@podcast.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-1"
              />
              <button
                onClick={signInWithMagicLink}
                disabled={authLoading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
              >
                {authLoading ? "Sending..." : "Send Magic Link"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">
              Signed in as <span className="font-medium text-slate-100">{session.user.email}</span>
            </p>
            <button
              onClick={signOut}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-lg font-semibold">Episode Upload</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const selected = e.target.files?.[0] ?? null;
              setFile(selected);
              setError(null);
            }}
            className="block w-full cursor-pointer rounded-md border border-slate-700 bg-slate-950 p-2 text-sm"
          />
          <button
            onClick={processAudio}
            disabled={!file || loading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Processing..." : "Generate Content"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {file ? `Selected: ${file.name}` : "No file selected yet."}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Transcript</h3>
              <button
                onClick={() => copyToClipboard(result.transcript)}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
              >
                Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-slate-200">{result.transcript}</pre>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Show Notes</h3>
              <button
                onClick={() => copyToClipboard(result.showNotes)}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
              >
                Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-slate-200">{result.showNotes}</pre>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="mb-3 text-lg font-semibold">Social Posts</h3>
            <div className="space-y-4">
              {(
                [
                  ["Twitter", result.socialPosts.twitter],
                  ["LinkedIn", result.socialPosts.linkedin],
                  ["Instagram", result.socialPosts.instagram]
                ] as const
              ).map(([platform, text]) => (
                <div key={platform} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">{platform}</p>
                    <button
                      onClick={() => copyToClipboard(text)}
                      className="rounded-md border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-slate-200">{text}</pre>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
