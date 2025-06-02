import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";
import textToSpeech from "@google-cloud/text-to-speech";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const client = new textToSpeech.TextToSpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || "{}"),
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

type DialogueLine = {
  speaker: string;
  text: string;
};

const PODCAST_SYSTEM_PROMPT = `You are a solo podcast host named Alex. Create an engaging monologue as if Alex is recording a podcast episode.

Guidelines:
- Alex is energetic, casual, and shares personal insights (uses "lmaoo", "yo", "dude" etc.)
- Keep the tone conversational and natural
- Include filler words, reactions, and casual language
- Aim for a natural flow of thoughts
- Stay on topic but allow minor tangents

Return ONLY a JSON object in this exact format:
{
  "dialogue": [
    { "speaker": "Alex", "text": "Yo, welcome back to the pod! It's just me today, and we’re gonna talk about something cool." },
    { "speaker": "Alex", "text": "Seriously, this is something I’ve been thinking about a lot lately." }
  ]}`;

function stripSSML(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.topic) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: PODCAST_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Create a solo podcast episode about: ${body.topic}`,
          },
        ],
        temperature: 0.8,
      });

      const responseText = completion.choices?.[0]?.message?.content ?? "";

      try {
        body.dialogue = JSON.parse(responseText).dialogue;
      } catch {
        return NextResponse.json(
          { error: "Failed to parse dialogue JSON from AI" },
          { status: 500 }
        );
      }
    }

    const dialogue: DialogueLine[] = body.dialogue;

    if (!dialogue || !Array.isArray(dialogue)) {
      return NextResponse.json(
        { error: "Missing or invalid dialogue array" },
        { status: 400 }
      );
    }

    const ssmlText = dialogue
      .map((line) => `${stripSSML(line.text)}<break time="500ms"/>`)
      .join("\n");

    const [response] = await client.synthesizeSpeech({
      input: {
        ssml: `<speak>${ssmlText}</speak>`,
      },
      voice: {
        languageCode: "en-US",
        name: "en-US-Studio-M",
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
      model: "studio",
    } as any);

    const filename = `podcasts/${uuidv4()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("tts")
      .upload(filename, response.audioContent as Buffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase upload failed:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to Supabase" },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from("tts").getPublicUrl(filename);

    return NextResponse.json({
      url: data.publicUrl,
      dialogue,
      topic: body.topic ?? null,
    });
  } catch (err: any) {
    console.error("TTS API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
