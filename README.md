# PodScribe

Simple one-page web app for podcasters:
- Upload audio
- Transcribe with OpenAI Whisper
- Generate show notes and 3 social posts with Claude
- Copy outputs from the UI

## Tech
- Next.js (App Router)
- Tailwind CSS
- Supabase Auth (magic link)

## Setup

1. Copy env file:
   - `cp .env.example .env.local`
2. Fill environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
3. Install dependencies:
   - `npm install`
4. Run:
   - `npm run dev`

## Supabase Auth Quick Setup

1. Create a Supabase project.
2. In **Authentication > Providers**, enable Email auth.
3. In **Authentication > URL Configuration**, add:
   - Site URL: `http://localhost:3000`
4. Copy Project URL and anon key into `.env.local`.

## Notes

- The app uses a single API route: `src/app/api/process/route.ts`.
- Audio upload is sent directly to Whisper (`whisper-1`).
- Transcript is passed to Claude (`claude-3-5-sonnet-latest`) to generate:
  - Show notes (markdown)
  - Twitter post
  - LinkedIn post
  - Instagram post
