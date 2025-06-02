// app/api/bettercanvas-ai/route.ts

import { NextResponse } from "next/server";
import { constants } from "node:fs";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler: simple text‐only chat via Responses API
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o-mini";

    // Create a new Response via the Responses endpoint:
    // - input can be a plain string when you just have text.
    const resp = await openai.responses.create({
      model,
      input: prompt,
    });

    // The Responses API returns an array of “output” items.
    // We’ll assume the first (and only) output_text is what we want.
    const outputItem = resp.output?.[0];
    let text = "";
    if (outputItem && outputItem.type === "message") {
      // In the “message” case, content is an array of { type, text } objects.
      text = outputItem.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // Return the generated text, plus the new response’s ID so the client can continue later.
    return NextResponse.json({
      text,
      responseId: resp.id,
    });
  } catch (err: any) {
    console.error("GET /bettercanvas‐ai error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST handler: “file chat” via Responses API
 *
 * On the first call, you must upload a file blob + question:
 *   • upload the file to OpenAI (purpose: “assistants”)
 *   • call openai.responses.create with input = [ { type: "file", file_id }, question ]
 *
 * On follow‐ups, you pass `previousResponseId` to continue the same conversation:
 *   • input = question (string)
 *   • previous_response_id = previousResponseId
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const maybeFile = form.get("file");
    const question = form.get("question")?.toString() || "";
    const previousResponseId =
      form.get("previousResponseId")?.toString() || null;
    const model = form.get("model")?.toString() || "gpt-4o-mini";

    const createArgs: any = { model };

    if (!previousResponseId) {
      // INITIAL call: must have a File
      if (!(maybeFile instanceof File)) {
        throw new Error("Missing or invalid file on initial POST");
      }

      // 1) Upload to OpenAI
      const upload = await openai.files.create({
        file: maybeFile,
        purpose: "assistants",
      });

      // 2) Build “input” as an array: first the file, then the user’s question
      createArgs.input = [{ type: "file", file_id: upload.id }, question];
    } else {
      // FOLLOW‐UP: just pass the raw question string and link to previousResponseId
      createArgs.input = question;
      createArgs.previous_response_id = previousResponseId;
    }

    // 3) Call Responses.create()
    const resp = await openai.responses.create(createArgs);

    // 4) Extract the assistant’s reply text (first output item)
    const outputItem = resp.output?.[0];
    let text = "";
    if (outputItem && outputItem.type === "message") {
      text = outputItem.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    return NextResponse.json({
      text,
      responseId: resp.id,
    });
  } catch (err: any) {
    console.error("POST /bettercanvas‐ai error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
