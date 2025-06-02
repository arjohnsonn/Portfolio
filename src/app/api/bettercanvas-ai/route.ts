// app/api/bettercanvas-ai/route.ts

import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler for text-only chat (no file).
 * Expects:  /api/bettercanvas-ai?prompt=...&model=...
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

    // ── Build a single "message"-type input item ─────────────────────────────────
    const inputItem = {
      id: uuidv4(),
      type: "message" as const,
      role: "user" as const,
      // NOTE: content must be an array of { type: "input_text"; text: string }
      content: [
        {
          type: "input_text" as const,
          text: prompt,
        },
      ],
    };

    // ── Call openai.responses.create() ───────────────────────────────────────────
    const resp = await openai.responses.create({
      model,
      input: [inputItem],
    });

    // ── Extract assistant’s output (first "message"‐type item) ────────────────────
    let text = "";
    const outputItem = resp.output?.[0];
    if (outputItem?.type === "message") {
      text = outputItem.content
        .filter((c) => c.type === "output_text")
        .map((c) => c.text || "")
        .join("");
    }

    return NextResponse.json({
      text,
      responseId: resp.id,
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
 * POST handler for file‐based chat.
 * • On first call: expect a `file` + `question` (no previousResponseId).
 * • On follow‐up: expect `question` + `previousResponseId` (no file).
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

    // Build the object we’ll pass into openai.responses.create()
    const createArgs: any = { model };

    if (!previousResponseId) {
      // ── INITIAL CALL (file + question) ───────────────────────────────────────
      if (!(maybeFile instanceof File)) {
        return NextResponse.json(
          { error: "Missing or invalid file on initial POST" },
          { status: 400 }
        );
      }

      // 1) Upload the file (purpose = "assistants")
      const upload = await openai.files.create({
        file: maybeFile,
        purpose: "assistants",
      });

      // 2) Build a single `file_search_call` input item:
      createArgs.input = [
        {
          id: uuidv4(),
          type: "file_search_call" as const,
          file_id: upload.id,
          queries: [question],
        },
      ];
    } else {
      // ── FOLLOW‐UP CALL (only question + previousResponseId) ─────────────────
      createArgs.input = [
        {
          id: uuidv4(),
          type: "message" as const,
          role: "user" as const,
          content: [
            {
              type: "input_text" as const,
              text: question,
            },
          ],
        },
      ];
      createArgs.previous_response_id = previousResponseId;
    }

    // ── Call openai.responses.create() ─────────────────────────────────────────
    const resp = await openai.responses.create(createArgs);

    // ── Extract assistant’s reply from resp.output[0] ───────────────────────────
    let text = "";
    const outputItem = resp.output?.[0];
    if (outputItem?.type === "message") {
      text = outputItem.content
        .filter((c) => c.type === "output_text")
        .map((c) => c.text || "")
        .join("");
    }

    return NextResponse.json({
      text,
      responseId: resp.id,
    });
  } catch (err: any) {
    console.error("POST /bettercanvas-ai error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
