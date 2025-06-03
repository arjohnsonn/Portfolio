// app/api/bettercanvas-ai/route.ts

import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler for simple text-only chat (no file).
 * Example: GET /api/bettercanvas-ai?prompt=Hello&model=gpt-4o-mini
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

    // Build a "message" input item with id starting with "msg_"
    const inputItem = {
      id: `msg_${uuidv4()}`, // must begin with "msg_"
      type: "message" as const,
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: prompt,
        },
      ],
    };

    // Call Responses.create()
    const resp = await openai.responses.create({
      model,
      input: [inputItem],
    });

    // Extract the assistant's reply
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
 * POST handler for file-based Q&A using the File Search tool.
 *
 * Initial call (no previousResponseId):
 *   • Accepts `file` + `question`.
 *   • Uploads file, creates vector store, indexes file.
 *   • Calls Responses.create() with tools: [{ type: "file_search", vector_store_ids: [vsId] }]
 *   • Returns { text, responseId, vectorStoreId }.
 *
 * Follow-up call (previousResponseId + vectorStoreId provided):
 *   • Accepts `question`, `previousResponseId`, and `vectorStoreId`.
 *   • Calls Responses.create() with the same vectorStoreId and previousResponseId.
 *   • Returns { text, responseId, vectorStoreId }.
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

    // Build the user's message input with id prefixed "msg_"
    const messageInput = {
      id: `msg_${uuidv4()}`, // must begin with "msg_"
      type: "message" as const,
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: question,
        },
      ],
    };

    let toolsArray: Array<{
      type: "file_search";
      vector_store_ids: string[];
      max_num_results?: number;
      filters?: unknown;
    }> = [];

    if (!previousResponseId) {
      // ── INITIAL CALL ────────────────────────────────────────────────────────
      if (!(maybeFile instanceof File)) {
        return NextResponse.json(
          { error: "Missing or invalid file on initial POST" },
          { status: 400 }
        );
      }

      // 1) Upload file to OpenAI File API
      const upload = await openai.files.create({
        file: maybeFile,
        purpose: "assistants",
      });

      // 2) Create a new vector store
      const vectorStore = await openai.vectorStores.create({
        name: `vs_${uuidv4()}`,
      });
      vsId = vectorStore.id;

      // 3) Add the file to that vector store
      await openai.vectorStores.files.create(vectorStore.id, {
        file_id: upload.id,
      });

      // 4) Build tools array to point at our new vector store
      toolsArray = [
        {
          type: "file_search" as const,
          vector_store_ids: [vsId],
        },
      ];
    } else {
      // ── FOLLOW-UP CALL ───────────────────────────────────────────────────────
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

    // Build payload for Responses.create()
    const createPayload: any = {
      model,
      input: [messageInput],
      tools: toolsArray,
    };
    if (previousResponseId) {
      createPayload.previous_response_id = previousResponseId;
    }

    // 5) Call Responses.create()
    const resp = await openai.responses.create(createPayload);

    // 6) Extract assistant's reply
    let text = "";
    const firstOutput = resp.output?.[0];
    if (firstOutput?.type === "message") {
      text = firstOutput.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // 7) Return text, responseId, and vectorStoreId
    return NextResponse.json({
      text,
      responseId: resp.id,
      vectorStoreId: vsId,
    });
  } catch (err: any) {
    console.error("POST /bettercanvas-ai error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
