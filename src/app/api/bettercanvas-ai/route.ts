// app/api/bettercanvas-ai/route.ts

import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler: plain text chat (no file).
 * GET /api/bettercanvas-ai?prompt=…&model=…
 * Returns { text, responseId }.
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

    // Send a single string; SDK wraps it as a user message.
    const resp = await openai.responses.create({
      model,
      input: prompt,
    });

    // Extract assistant’s reply from resp.output[0]
    let text = "";
    const firstOutput = resp.output?.[0];
    if (firstOutput?.type === "message") {
      text = firstOutput.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    return NextResponse.json({
      text,
      responseId: resp.id, // e.g. "resp_ABC123"
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
 * POST handler: file‐based Q&A using File Search.
 *
 * Initial call (no previousResponseId):
 *  - Expects FormData: file (PDF) + question
 *  - Uploads file, creates & indexes vector store
 *  - Calls Responses.create({ input:[{id:"msg_…",…}], tools:[{type:"file_search",vector_store_ids:[vsId]}] })
 *  - Returns { text, responseId, vectorStoreId }
 *
 * Follow-up call (previousResponseId & vectorStoreId provided):
 *  - Expects FormData: question + previousResponseId + vectorStoreId
 *  - Calls Responses.create(...) with same vectorStoreId + previousResponseId
 *  - Returns { text, responseId, vectorStoreId }
 *
 *  ▫ Every user‐message ID must begin with "msg_".
 *  ▫ We return **only** resp.id (“resp_…”) to the client. Never return a “msg_…” ID.
 *  ▫ On follow‐ups, client sends back that “resp_…” as previousResponseId.
 *  ▫ Also return vectorStoreId so client re‐uses it.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const maybeFile = form.get("file");
    const question = form.get("question")?.toString() || "";
    const previousResponseId =
      form.get("previousResponseId")?.toString() || null;
    const vectorStoreId = form.get("vectorStoreId")?.toString() || null;
    const model = form.get("model")?.toString() || "gpt-4o-mini";

    if (!question) {
      return NextResponse.json(
        { error: "Missing `question` in form data" },
        { status: 400 }
      );
    }

    // Determine if we truly have a resp.id (starts with "resp_")
    const isFollowUp =
      previousResponseId != null && previousResponseId.startsWith("resp_");

    let vsId: string | null = vectorStoreId;
    let toolsArray: Array<{
      type: "file_search";
      vector_store_ids: string[];
      max_num_results?: number;
      filters?: unknown;
    }> = [];

    if (!isFollowUp) {
      // ── INITIAL CALL ───────────────────────────────────────────────────
      if (!(maybeFile instanceof File)) {
        return NextResponse.json(
          { error: "Missing or invalid file on initial POST" },
          { status: 400 }
        );
      }

      // 1) Upload PDF
      const upload = await openai.files.create({
        file: maybeFile,
        purpose: "assistants",
      });

      // 2) Create vector store
      const vectorStore = await openai.vectorStores.create({
        name: `vs_${uuidv4()}`,
      });
      vsId = vectorStore.id; // e.g. "vs_ABC123"

      // 3) Index file into vector store
      await openai.vectorStores.files.create(vectorStore.id, {
        file_id: upload.id, // MUST be snake_case
      });

      // 4) Build tools array
      toolsArray = [
        {
          type: "file_search" as const,
          vector_store_ids: [vsId],
        },
      ];
    } else {
      // ── FOLLOW‐UP CALL ─────────────────────────────────────────────────
      if (!vectorStoreId || !vectorStoreId.startsWith("vs_")) {
        return NextResponse.json(
          {
            error:
              "Missing or invalid `vectorStoreId` on follow-up. Use the `vectorStoreId` returned initially.",
          },
          { status: 400 }
        );
      }
      vsId = vectorStoreId;
      toolsArray = [
        {
          type: "file_search" as const,
          vector_store_ids: [vsId],
        },
      ];
    }

    // ── Build user‐message object. Its ID must start with "msg_".
    const messageInput = {
      id: `msg_${uuidv4()}`,    // MUST start with "msg_"
      type: "message" as const,
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: question,
        },
      ],
    };

    // ── Build payload for openai.responses.create()
    const createPayload: any = {
      model,
      input: [messageInput],
      tools: toolsArray,
    };
    if (isFollowUp) {
      createPayload.previous_response_id = previousResponseId;
    }

    // 5) Call Responses.create()
    const resp = await openai.responses.create(createPayload);

    // 6) Extract assistant’s reply
    let text = "";
    const firstOutput = resp.output?.[0];
    if (firstOutput?.type === "message") {
      text = firstOutput.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // 7) Return only resp.id (never a msg_…) + vectorStoreId
    return NextResponse.json({
      text,
      responseId: resp.id,  // e.g. "resp_ABC123"
      vectorStoreId: vsId,  // e.g. "vs_ABC123"
    });
  } catch (err: any) {
    console.error("POST /bettercanvas-ai error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
