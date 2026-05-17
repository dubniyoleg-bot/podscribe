import { NextResponse } from "next/server";
import { requirePro } from "@/lib/require-pro";

type ClaudePayload = {
  showNotes: string;
  socialPosts: {
    twitter: string;
    linkedin: string;
    instagram: string;
  };
};

const claudeSystemPrompt = `
You are an assistant for podcast production.
Given a podcast transcript, produce:
1) concise, polished show notes in markdown
2) social posts for Twitter, LinkedIn, and Instagram

Return strict JSON with this shape:
{
  "showNotes": "string",
  "socialPosts": {
    "twitter": "string",
    "linkedin": "string",
    "instagram": "string"
  }
}
Do not include markdown code fences.
`;

function extractJsonObject(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    throw new Error("Claude response did not include valid JSON.");
  }
  return text.slice(firstBrace, lastBrace + 1);
}

export async function POST(req: Request) {
  try {
    const proGate = await requirePro(req);
    if (proGate instanceof NextResponse) {
      return proGate;
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!openAiApiKey || !anthropicApiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY or ANTHROPIC_API_KEY in environment." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audio);
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "text");

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`
      },
      body: whisperForm
    });

    if (!whisperResponse.ok) {
      const whisperError = await whisperResponse.text();
      return NextResponse.json(
        { error: `Whisper transcription failed: ${whisperError}` },
        { status: 500 }
      );
    }

    const transcript = await whisperResponse.text();

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1200,
        system: claudeSystemPrompt,
        messages: [
          {
            role: "user",
            content: `Podcast transcript:\n\n${transcript}`
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const claudeError = await claudeResponse.text();
      return NextResponse.json({ error: `Claude generation failed: ${claudeError}` }, { status: 500 });
    }

    const claudeJson = await claudeResponse.json();
    const generatedText = claudeJson?.content?.[0]?.text as string | undefined;
    if (!generatedText) {
      return NextResponse.json(
        { error: "Claude response did not include content text." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(extractJsonObject(generatedText)) as ClaudePayload;

    return NextResponse.json({
      transcript,
      showNotes: parsed.showNotes,
      socialPosts: parsed.socialPosts
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error."
      },
      { status: 500 }
    );
  }
}
