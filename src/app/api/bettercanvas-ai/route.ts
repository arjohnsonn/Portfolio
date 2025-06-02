// app/api/bettercanvas-ai/route.ts

import { NextResponse } from "next/server";
import constants from "node:constants";
import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST handler: “file chat” using Responses API.
 * On the very first call (no previousResponseId):
 *   1) upload the file (purpose: "assistants")
 *   2) call openai.responses.create with an input array that has two items:
 *      • { id: "...", type: "file_search_call", file_id: upload.id }
 *      • { id: "...", type: "message", role: "user", content: question }
 *
 * On follow‐up calls (previousResponseId != null):
 *   1) call openai.responses.create with:
 *      • input: [ { id: "...", type: "message", role: "user", content: question } ]
 *      • previous_response_id: previousResponseId
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const maybeFile = form.get("file");
    const question = form.get("question")?.toString() || "";
    const previousResponseId =
      form.get("previousResponseId")?.toString() || null;
    const model = form.get("model")?.toString() || "gpt-4o-mini";

    // Base argument object for openai.responses.create
    const createArgs: any = { model };

    if (!previousResponseId) {
      // ─── INITIAL CALL: must include a File + question ───────────────────────
      if (!(maybeFile instanceof File)) {
        throw new Error("Missing or invalid file on initial POST");
      }

      // 1) Upload file under "assistants"
      const upload = await openai.files.create({
        file: maybeFile,
        purpose: "assistants",
      });

      // 2) Build input array with unique IDs
      createArgs.input = [
        {
          id: uuidv4(), // e.g. "c12a3f45-..."
          type: "file_search_call",
          file_id: upload.id,
        },
        {
          id: uuidv4(), // e.g. "d67b8e90-..."
          type: "message",
          role: "user",
          content: question,
        },
      ];
    } else {
      // ─── FOLLOW‐UP CALL: send only the user message + previous_response_id ─────
      createArgs.input = [
        {
          id: uuidv4(),
          type: "message",
          role: "user",
          content: question,
        },
      ];
      createArgs.previous_response_id = previousResponseId;
    }

    // 3) Call the Responses API
    const resp = await openai.responses.create(createArgs);

    // 4) Extract the assistant’s reply from resp.output[0]
    let text = "";
    const outputItem = resp.output?.[0];
    if (outputItem && outputItem.type === "message") {
      // Combine all nested output_text pieces
      text = outputItem.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // 5) Return the generated text + the new responseId
    return NextResponse.json({
      text,
      responseId: resp.id,
    });
  } catch (err: any) {
    console.error("POST /bettercanvas-ai error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
