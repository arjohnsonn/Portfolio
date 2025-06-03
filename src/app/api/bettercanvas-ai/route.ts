// app/api/bettercanvas-ai/route.ts

import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";

const SDK = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_BASE = "https://api.openai.com/v1";

/**
 * GET handler for text-only chat (no file):
 *   GET /api/bettercanvas-ai?prompt=…&model=…
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt");
    const model = searchParams.get("model") || "gpt-4o-mini";

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing `prompt` query parameter" },
        { status: 400 }
      );
    }

    // Build the exact payload for /v1/responses (snake-case everything):
    const payload = {
      model,
      input: [
        {
          id: uuidv4(),
          type: "message",
          role: "user",
          // “content” must be an array of { type: "input_text", text: string }
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
    };

    // Call /v1/responses directly via fetch():
    const resp = await fetch(`${OPENAI_BASE}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("OpenAI /responses error (GET):", errText);
      return NextResponse.json(
        { error: `OpenAI returned ${resp.status}: ${errText}` },
        { status: 500 }
      );
    }

    const json = await resp.json();
    // Extract the assistant’s reply from json.output[0].content[*].text
    let text = "";
    const firstOutput = json.output?.[0];
    if (firstOutput?.type === "message") {
      text = firstOutput.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    return NextResponse.json({
      text,
      responseId: json.id,
    });
  } catch (err: any) {
    console.error("GET /bettercanvas-ai error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}

/**
 * POST handler for file-based chat:
 *   • If no previousResponseId, expect `file` + `question` → first call.
 *   • Otherwise expect `question` + `previousResponseId` → follow-up.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const maybeFile = form.get("file");
    const question = form.get("question")?.toString() || "";
    const previousResponseId =
      form.get("previousResponseId")?.toString() || null;
    const model = form.get("model")?.toString() || "gpt-4o-mini";

    if (!question) {
      return NextResponse.json(
        { error: "Missing `question` in form data" },
        { status: 400 }
      );
    }

    // We’ll build a “payload” object that exactly matches the REST API’s snake_case expectation:
    let payload: any = { model };

    if (!previousResponseId) {
      // ── INITIAL CALL (we have a file + question) ──────────────────────────────
      if (!(maybeFile instanceof File)) {
        return NextResponse.json(
          { error: "Missing or invalid file on initial POST" },
          { status: 400 }
        );
      }

      // 1) Upload the file via SDK
      const upload = await SDK.files.create({
        file: maybeFile,
        purpose: "assistants",
      });

      // 2) Construct the single-file_search_call input item in snake_case:
      payload.input = [
        {
          id: uuidv4(),
          type: "file_search_call",
          file_id: upload.id, // ↓ must be file_id (snake_case)
          queries: [question],
        },
      ];
    } else {
      // ── FOLLOW-UP CALL (only question + previousResponseId) ──────────────────
      payload.input = [
        {
          id: uuidv4(),
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: question,
            },
          ],
        },
      ];
      payload.previous_response_id = previousResponseId; // ← snake_case here
    }

    // 3) POST directly to /v1/responses with the correct snake-case JSON:
    const resp = await fetch(`${OPENAI_BASE}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("OpenAI /responses error (POST):", errText);
      return NextResponse.json(
        { error: `OpenAI returned ${resp.status}: ${errText}` },
        { status: 500 }
      );
    }

    const json = await resp.json();
    // 4) Extract the assistant’s reply from json.output[0]
    let text = "";
    const firstOutput = json.output?.[0];
    if (firstOutput?.type === "message") {
      text = firstOutput.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    return NextResponse.json({
      text,
      responseId: json.id,
    });
  } catch (err: any) {
    console.error("POST /bettercanvas-ai error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
