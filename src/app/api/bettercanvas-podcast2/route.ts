import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import util from "util";
import { v4 as uuidv4 } from "uuid";
import textToSpeech from "@google-cloud/text-to-speech/build/src/v1beta1";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const client = new textToSpeech.TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

type DialogueLine = {
  speaker: string;
  text: string;
};

const PODCAST_SYSTEM_PROMPT = `You are a podcast dialogue generator. Create engaging conversations between two hosts: Alex and Jamie.

Guidelines:
- Alex is energetic, casual, and asks great questions (uses "lmaoo", "yo", "dude" etc.)
- Jamie is knowledgeable, thoughtful, and provides insights
- Keep each speaker turn conversational and natural
- Include filler words, reactions, and casual language
- Aim for 8-12 exchanges total
- Make it feel like a real podcast conversation
- Stay on topic but let the conversation flow naturally

Return ONLY a JSON object in this exact format:
{
  "dialogue": [
    { "speaker": "Alex", "text": "Welcome to the show! lmaoo" },
    { "speaker": "Jamie", "text": "Thanks Alex! I'm excited to discuss our topic today." }
  ]}`;

const speakerMap: Record<string, string> = {
  Alex: "R",
  Jamie: "S",
};

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
            content: `Create a podcast dialogue about: ${body.topic}`,
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

    const multiSpeakerMarkup = {
      turns: dialogue.map((line) => ({
        text: line.text,
        speaker: speakerMap[line.speaker] || "R",
      })),
    };

    const [response] = await client.synthesizeSpeech({
      input: { multiSpeakerMarkup },
      voice: {
        languageCode: "en-US",
        name: "en-US-Studio-Multispeaker",
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    });

    const filename = `${uuidv4()}.mp3`;
    const outputDir = path.join(process.cwd(), "public", "tts");
    const outputPath = path.join(outputDir, filename);

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    await util.promisify(fs.writeFile)(
      outputPath,
      response.audioContent as Buffer,
      "binary"
    );

    return NextResponse.json({
      url: `/tts/${filename}`,
      dialogue,
      topic: body.topic ?? null,
    });
  } catch (err: any) {
    console.error("TTS API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
