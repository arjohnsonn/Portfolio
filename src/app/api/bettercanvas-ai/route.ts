// app/api/bettercanvas-ai/route.ts

import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler for text‐only chat (no file involved).
 *
 * Example:
 *   GET /api/bettercanvas-ai?prompt=Hello&model=gpt-4o-mini
 *
 * Returns JSON: { text: string, responseId: string }
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
    //    The SDK will wrap it as a user message under the hood.
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

    // ── Return only the OpenAI response ID (resp.id), never a `msg_…`
    return NextResponse.json({
      text,
      responseId: resp.id, // e.g. "resp_xyz123"
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
 * POST handler for file‐based Q&A (using the File Search tool).
 *
 * Initial call (no previousResponseId):
 *   • Expects FormData with `file` + `question`.
 *   • Uploads the file (purpose="assistants").
 *   • Creates a new vector store, indexes the file.
 *   • Calls Responses.create() with tools: [{ type: "file_search", vector_store_ids: [vsId] }]
 *   • Returns { text, responseId, vectorStoreId }
 *
 * Follow‐up call (previousResponseId + vectorStoreId provided):
 *   • Expects FormData with `question`, `previousResponseId`, `vectorStoreId`.
 *   • Calls Responses.create() with the same vectorStoreId and previousResponseId.
 *   • Returns { text, responseId, vectorStoreId } again.
 *
 * IMPORTANT:
 *  - Always generate `messageInput.id` as `msg_${uuidv4()}` (so it begins with "msg_").
 *  - **Never** return a “msg_…” ID to the client. Instead, return `resp.id` (which starts with "resp_") as `responseId`.
 *  - On follow‐ups, the client must send back **that** `responseId` as `previousResponseId`.
 *  - Also return `vectorStoreId` on the first call, so the client re‐sends it on follow‐ups.
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

    // ── Build the single user‐message input. Its ID must begin with "msg_"
    const messageInput = {
      id: `msg_${uuidv4()}`, // MUST begin with "msg_"
      type: "message" as const,
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: question,
        },
      ],
    };

    // ── Prepare the tools array if/when we have a vector store
    let toolsArray: Array<{
      type: "file_search";
      vector_store_ids: string[];
      max_num_results?: number;
      filters?: unknown;
    }> = [];

    if (!previousResponseId) {
      // ── INITIAL CALL (expects file + question) ────────────────────────────
      if (!(maybeFile instanceof File)) {
        return NextResponse.json(
          { error: "Missing or invalid file on initial POST" },
          { status: 400 }
        );
      }

      // 1) Upload the file (purpose="assistants")
      const upload = await openai.files.create({
        file: maybeFile,
        purpose: "assistants",
      });

      // 2) Create a brand‐new vector store
      const vectorStore = await openai.vectorStores.create({
        name: `vs_${uuidv4()}`,
      });
      vsId = vectorStore.id; // e.g. "vs_abcdef123"

      // 3) Index the uploaded file into that vector store
      await openai.vectorStores.files.create(vectorStore.id, {
        file_id: upload.id, // 🔴 note: MUST be snake_case here
      });

      // 4) Build our tools array so the model can use file_search on vsId
      toolsArray = [
        {
          type: "file_search" as const,
          vector_store_ids: [vsId],
        },
      ];
    } else {
      // ── FOLLOW‐UP CALL (expects question + previousResponseId + vectorStoreId) ─
      if (!vectorStoreId) {
        return NextResponse.json(
          {
            error:
              "Missing `vectorStoreId` on follow-up POST. Use the vectorStoreId returned in the initial response.",
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
      input: [messageInput],
      tools: toolsArray,
    };
    if (previousResponseId) {
      // NOTE: previousResponseId must be a "resp_…" ID from the previous response
      createPayload.previous_response_id = previousResponseId;
    }

    // 5) Call Responses.create() (with file_search if vsId exists)
    const resp = await openai.responses.create(createPayload);

    // 6) Extract assistant’s reply from resp.output[0].content[*].text
    let text = "";
    const firstOutput = resp.output?.[0];
    if (firstOutput?.type === "message") {
      text = firstOutput.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // 7) Return JSON: text, responseId (resp.id), and vectorStoreId if any
    return NextResponse.json({
      text,
      responseId: resp.id, // e.g. "resp_abcdef123"
      vectorStoreId: vsId, // e.g. "vs_abcdef123"
    });
  } catch (err: any) {
    console.error("POST /bettercanvas-ai error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
