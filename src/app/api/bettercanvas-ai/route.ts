// app/api/bettercanvas-ai/route.ts

import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler for text-only chat (no file).
 * Example usage:
 *   GET /api/bettercanvas-ai?prompt=Hello&model=gpt-4o-mini
 * Returns: { text, responseId }
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

    // ── Call Responses.create() with a single‐string user input
    //    (SDK automatically wraps it as a "user" message under the hood)
    const resp = await openai.responses.create({
      model,
      input: prompt,
    });

    // ── Extract the assistant’s reply from resp.output[0].content[*].text
    let text = "";
    const firstOutput = resp.output?.[0];
    if (firstOutput?.type === "message") {
      text = firstOutput.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // ── Return only the actual OpenAI response ID (resp.id), NOT a msg_ ID
    return NextResponse.json({
      text,
      responseId: resp.id, // e.g. "resp_xxx"
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
 * POST handler for file-based Q&A using the File Search tool.
 *
 *   • Initial call (no previousResponseId):
 *       - Expects: FormData with `file` + `question`.
 *       - Uploads file, creates a vector store, indexes the file.
 *       - Calls Responses.create() with tools: [{ type: "file_search", vector_store_ids: [vsId] }]
 *       - Returns { text, responseId, vectorStoreId } (where responseId is resp.id)
 *
 *   • Follow-up call (previousResponseId + vectorStoreId provided):
 *       - Expects: FormData with `question`, `previousResponseId`, and `vectorStoreId`.
 *       - Calls Responses.create() again with the same vectorStoreId and previousResponseId.
 *       - Returns { text, responseId, vectorStoreId }.
 *
 * **Important**:
 *   - The client must store the `responseId` that this endpoint returns, and send that (not a “msg_…” ID) on subsequent follow-ups.
 *   - Likewise, store `vectorStoreId` from the initial call and re-send it for follow-ups.
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

    let vsId: string | null = vectorStoreId;

    // ── Build the user’s message input. Every “message” must have an ID that begins with “msg_”
    //    but we do NOT return or reuse that msg_ ID on the client—client only uses resp.id.
    const messageInput = {
      id: `msg_${uuidv4()}`, // MUST start with "msg_"
      type: "message" as const,
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: question,
        },
      ],
    };

    // ── We'll build a `tools` array that references our vector store (if applicable)
    let toolsArray: Array<{
      type: "file_search";
      vector_store_ids: string[];
      max_num_results?: number;
      filters?: unknown;
    }> = [];

    if (!previousResponseId) {
      // ── INITIAL CALL (file + question) ───────────────────────────────────
      if (!(maybeFile instanceof File)) {
        return NextResponse.json(
          { error: "Missing or invalid file on initial POST" },
          { status: 400 }
        );
      }

      // 1) Upload the file to OpenAI (purpose="assistants")
      const upload = await openai.files.create({
        file: maybeFile,
        purpose: "assistants",
      });

      // 2) Create a brand-new vector store
      const vectorStore = await openai.vectorStores.create({
        name: `vs_${uuidv4()}`,
      });
      vsId = vectorStore.id; // e.g. "vs_xxx"

      // 3) Index the uploaded file into that vector store
      await openai.vectorStores.files.create(vectorStore.id, {
        file_id: upload.id, // Must be snake_case here
      });

      // 4) Build the tools array so the model can run `file_search` on vsId
      toolsArray = [
        {
          type: "file_search" as const,
          vector_store_ids: [vsId],
        },
      ];
    } else {
      // ── FOLLOW-UP CALL (question + previousResponseId + vectorStoreId) ─────────
      if (!vectorStoreId) {
        return NextResponse.json(
          {
            error:
              "Missing `vectorStoreId` on follow-up POST. Use the vectorStoreId from the initial response.",
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

    // ── Build the payload for openai.responses.create()
    const createPayload: any = {
      model,
      input: [messageInput], // always send just this new user message
      tools: toolsArray,
    };
    if (previousResponseId) {
      // Note: previousResponseId must be the response.id (resp.id), not a "msg_..."
      createPayload.previous_response_id = previousResponseId;
    }

    // 5) Call Responses.create() with file_search enabled (or just the user msg if follow-up)
    const resp = await openai.responses.create(createPayload);

    // 6) Extract the assistant’s reply (the first output item of type "message")
    let text = "";
    const firstOutput = resp.output?.[0];
    if (firstOutput?.type === "message") {
      text = firstOutput.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // 7) Return text, the new responseId (resp.id), and vsId (vectorStoreId) if any
    return NextResponse.json({
      text,
      responseId: resp.id, // e.g. "resp_xxx"
      vectorStoreId: vsId, // e.g. "vs_xxx"
    });
  } catch (err: any) {
    console.error("POST /bettercanvas-ai error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
