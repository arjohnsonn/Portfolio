// app/api/bettercanvas-ai/route.ts

import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const maybeFile = form.get("file");
    const question = form.get("question")?.toString() || "";
    const previousResponseId =
      form.get("previousResponseId")?.toString() || null;
    const model = form.get("model")?.toString() || "gpt-4o-mini";

    // Build the args for openai.responses.create
    const createArgs: any = { model };

    if (!previousResponseId) {
      // ── INITIAL CALL (no previousResponseId) ───────────────────────────────────
      if (!(maybeFile instanceof File)) {
        throw new Error("Missing or invalid file on initial POST");
      }

      // 1) Upload the file (purpose “assistants”)
      const upload = await openai.files.create({
        file: maybeFile,
        purpose: "assistants",
      });

      // 2) Use a single file_search_call item that includes our question as a “queries” entry:
      createArgs.input = [
        {
          id: uuidv4(),
          type: "file_search_call",
          file_id: upload.id,
          queries: [question],
        },
      ];
    } else {
      // ── FOLLOW‐UP CALL (previousResponseId provided) ───────────────────────────
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

    // 3) Call Responses.create()
    const resp = await openai.responses.create(createArgs);

    // 4) Extract assistant’s reply from resp.output[0]
    let text = "";
    const outputItem = resp.output?.[0];
    if (outputItem && outputItem.type === "message") {
      text = outputItem.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // 5) Return text + new responseId
    return NextResponse.json({
      text,
      responseId: resp.id,
    });
  } catch (err: any) {
    console.error("POST /bettercanvas-ai error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
