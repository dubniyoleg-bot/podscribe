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

const features = [
  {
    icon: "🎙️",
    title: "Transcript in minutes",
    body: "Upload your episode audio and get a full transcript powered by the Whisper API."
  },
  {
    icon: "📝",
    title: "Show notes from your episode",
    body: "Claude turns your transcript into structured show notes, ready to publish."
  },
  {
    icon: "📣",
    title: "Three social posts",
    body: "Twitter, LinkedIn, and Instagram drafts in one run—copy and paste when you are ready."
  },
  {
    icon: "⚡",
    title: "One focused workspace",
    body: "Transcript, notes, and posts live on one screen—no tab hopping."
  }
];

const planIncludes = [
  "Unlimited transcripts",
  "Show notes",
  "Social posts",
  "Powered by AI"
];

export default function Home() {
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
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
      setError("Check your email—we sent you a magic link.");
    }
    setAuthLoading(false);
  };

  const scrollToSignUp = () => {
    document.getElementById("signup")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (!session?.access_token) {
      setError("Sign in to generate content.");
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
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
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

  const handleUpgrade = async () => {
    if (!session?.user?.id || !session.user.email) {
      setError("You need a signed-in session with an email to upgrade.");
      return;
    }
    setCheckoutLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.user.id,
          email: session.user.email
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Could not start checkout.");
      }
      if (typeof payload.url === "string" && payload.url.length > 0) {
        window.location.href = payload.url;
      } else {
        throw new Error("Checkout URL missing from server response.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (!sessionReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a14] px-4">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#0a0a14] text-slate-100">
        <header className="border-b border-white/5 bg-[#0a0a14]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10b981] text-sm font-black text-[#0a0a14] shadow-lg shadow-emerald-500/20">
                P
              </span>
              <span className="text-lg font-semibold tracking-tight text-white">PodScribe</span>
            </div>
            <button
              type="button"
              onClick={scrollToSignUp}
              className="rounded-full border border-[#10b981]/40 px-4 py-2 text-sm font-medium text-[#10b981] transition hover:bg-[#10b981] hover:text-[#0a0a14]"
            >
              Sign Up
            </button>
          </div>
        </header>

        <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:pt-24">
          <div className="absolute left-1/2 top-10 -z-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#10b981]/20 blur-3xl" />
          <p className="relative mx-auto mb-5 inline-flex rounded-full border border-[#10b981]/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-[#10b981]">
            Built for podcasters
          </p>
          <h1 className="relative mx-auto max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Turn podcast audio into{" "}
            <span className="text-[#10b981]">show notes</span>,{" "}
            <span className="text-[#10b981]">transcripts</span>, and social content
          </h1>
          <p className="relative mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            PodScribe automates your post-production workflow: speech-to-text, polished show notes,
            and ready-to-share social copy so you can publish and promote faster.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={scrollToSignUp}
              className="rounded-full bg-[#10b981] px-6 py-3 text-sm font-bold text-[#0a0a14] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Get started free
            </button>
            <button
              type="button"
              onClick={scrollToSignUp}
              className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-[#10b981]/50 hover:text-white"
            >
              No password needed
            </button>
          </div>

          <div className="relative mx-auto mt-16 max-w-4xl rounded-3xl border border-white/10 bg-[#111827] p-4 text-left shadow-2xl shadow-black/40">
            <div className="rounded-2xl border border-white/10 bg-[#0a0a14] p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#10b981]">
                    Generated output
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Episode Show Notes</h2>
                </div>
                <span className="rounded-full bg-[#10b981]/10 px-3 py-1 text-xs font-medium text-[#10b981]">
                  Ready to copy
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl bg-[#111827] p-5">
                  <p className="text-sm font-semibold text-white">
                    How independent creators build loyal audiences
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                    <li>• Why consistency compounds trust with listeners</li>
                    <li>• A lightweight workflow for post-production</li>
                    <li>• Practical ideas for turning one episode into multiple assets</li>
                  </ul>
                </div>
                <div className="rounded-2xl bg-[#111827] p-5">
                  <p className="text-sm font-semibold text-white">Social drafts</p>
                  <p className="mt-4 rounded-xl bg-[#0a0a14] p-3 text-sm text-slate-400">
                    New episode is live: practical ways creators can turn one conversation into a
                    week of audience growth.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/5 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold text-white">What you get</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
              Everything you need after editing—in one simple flow.
            </p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {features.map((item) => (
                <li
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-[#111827] p-7 shadow-xl shadow-black/20 transition hover:border-[#10b981]/40"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10b981]/10 text-2xl">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-white/5 py-20">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <h2 className="text-3xl font-bold text-white">Simple pricing</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              One simple plan—everything you need to ship every episode.
            </p>
            <div className="mx-auto mt-10 max-w-md rounded-3xl border border-[#10b981]/70 bg-[#111827] p-8 text-left shadow-2xl shadow-emerald-950/20">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#10b981]">Pro</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-5xl font-bold text-white">$19</span>
                <span className="text-slate-400">/month</span>
              </p>
              <ul className="mt-8 space-y-4">
                {planIncludes.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10b981]/10 text-[#10b981]" aria-hidden="true">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={scrollToSignUp}
                className="mt-8 w-full rounded-full bg-[#10b981] py-3 text-sm font-bold text-[#0a0a14] transition hover:bg-emerald-400"
              >
                Get started
              </button>
            </div>
          </div>
        </section>

        <section id="signup" className="scroll-mt-8 border-t border-white/5 py-20">
          <div className="mx-auto max-w-lg px-4">
            <h2 className="text-center text-3xl font-bold text-white">Get started free</h2>
            <p className="mt-2 text-sm text-slate-400">
              Enter your email and we will send a sign-in link. It doubles as sign-up—one step,
              no separate registration form.
            </p>
            <div className="mt-6 space-y-3">
              <input
                type="email"
                placeholder="you@podcast.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-[#111827] px-5 py-3 text-sm text-slate-100 outline-none ring-[#10b981] focus:ring-1"
              />
              <button
                type="button"
                onClick={signInWithMagicLink}
                disabled={authLoading}
                className="w-full rounded-full bg-[#10b981] py-3 text-sm font-bold text-[#0a0a14] hover:bg-emerald-400 disabled:opacity-50"
              >
                {authLoading ? "Sending…" : "Sign up—email magic link"}
              </button>
            </div>
            {error && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-sm text-slate-300">
                {error}
              </div>
            )}
          </div>
        </section>

        <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-600">
          PodScribe · Next.js · Supabase
        </footer>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">PodScribe</h1>
        <p className="mt-2 text-slate-300">
          Upload your episode audio, then get transcript, show notes, and social posts in one click.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-slate-300">
            Signed in as <span className="font-medium text-slate-100">{session.user.email}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkoutLoading ? "Redirecting…" : "Upgrade"}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
            >
              Sign Out
            </button>
          </div>
        </div>
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
            type="button"
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
                type="button"
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
                type="button"
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
                      type="button"
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
