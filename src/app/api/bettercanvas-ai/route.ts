// app/api/bettercanvas-ai/route.ts

import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler for simple text‐only chat (no file_search).
 * Used when you just want a normal Q&A (no PDF involved).
 *
 * Example:
 *   GET /api/bettercanvas-ai?prompt=Hello&model=gpt-4o-mini
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

    // Build a single “message” input. Note: content must be an array of { type: "input_text", text }.
    const inputItem = {
      id: uuidv4(),
      type: "message" as const,
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: prompt,
        },
      ],
    };

    // Call Responses.create() with only that one input item.
    const resp = await openai.responses.create({
      model,
      input: [inputItem],
    });

    // Pull out the assistant’s reply from resp.output[0].content[*].text
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
 * POST handler for “file chat” using the File Search tool.
 *
 * - If no previousResponseId ⇒ initial call with (file + question).
 *   We:
 *     1. Upload the file to OpenAI’s File API (purpose="assistants")
 *     2. Create a brand‐new vector store
 *     3. Add the uploaded file to that vector store
 *     4. Send question → openai.responses.create({ …, tools:[{ type:"file_search", vector_store_ids: [vectorStore.id] }]})
 *     5. Return { text, responseId, vectorStoreId }
 *
 * - If previousResponseId & vectorStoreId ⇒ follow-up call with just (question).
 *   We:
 *     1. Call openai.responses.create({ … input:[{type:"message", …}], previous_response_id, tools:[{ type:"file_search", vector_store_ids:[vectorStoreId] }] })
 *     2. Return { text, responseId, vectorStoreId } again.
 *
 * The client must store and re‐send `vectorStoreId` on follow-ups.
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

    // This will hold our eventual vectorStoreId (either newly created or passed‐in).
    let vsId: string | null = vectorStoreId;

    // Build the base of our create‐response payload:
    // We always send the user’s question as a normal “message” input item.
    const messageInput = {
      id: uuidv4(),
      type: "message" as const,
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: question,
        },
      ],
    };

    // The "tools" array must exist and must point at at least one vector store ID.
    // If this is the first time, we’ll build that array after creating vsId.
    let toolsArray: Array<{
      type: "file_search";
      vector_store_ids: string[];
      max_num_results?: number;
      filters?: unknown;
    }> = [];

    if (!previousResponseId) {
      // ── INITIAL CALL (file + question) ─────────────────────────────────────
      if (!(maybeFile instanceof File)) {
        return NextResponse.json(
          { error: "Missing or invalid file on initial POST" },
          { status: 400 }
        );
      }

      // 1) Upload PDF to OpenAI File API:
      const upload = await openai.files.create({
        file: maybeFile,
        purpose: "assistants",
      });
      // upload.id is something like "file-AbCdEfGhIjKlMnOpQrStUvWx"

      // 2) Create a brand‐new vector store:
      const vectorStore = await openai.vectorStores.create({
        name: `vc-${uuidv4()}`, // any unique name you like
      });
      vsId = vectorStore.id;

      // 3) Add the file into that vector store (this triggers indexing):
      await openai.vectorStores.files.create(vectorStore.id, {
        file_id: upload.id,
      });

      // (Optional: poll until the vector store has status "completed" before proceeding.
      //  In many small PDFs, indexing happens within a second or two—so you often get away
      //  without polling. If you see “no results” or timing errors in practice, you can add
      //  a short loop here to wait for `openai.vectorStores.files.list({ vector_store_id: vsId })`
      //  to show a completed status.)

      // 4) Build our tools array now that vsId exists:
      toolsArray = [
        {
          type: "file_search" as const,
          vector_store_ids: [vsId],
          // you can optionally set max_num_results or metadata‐filters here:
          // max_num_results: 5,
          // filters: { type: "eq", key: "department", value: "science" },
        },
      ];
    } else {
      // ── FOLLOW‐UP CALL (previousResponseId + question) ───────────────────────
      if (!vectorStoreId) {
        return NextResponse.json(
          {
            error:
              "Missing `vectorStoreId` on follow-up POST. First call returns vectorStoreId; reuse it.",
          },
          { status: 400 }
        );
      }
      vsId = vectorStoreId;

      // Reuse the same vector store in our tools array:
      toolsArray = [
        {
          type: "file_search" as const,
          vector_store_ids: [vsId],
          // you can optionally set max_num_results or filters here, too
        },
      ];
    }

    // ── At this point, we have:
    //    • messageInput
    //    • vsId (string)
    //    • toolsArray pointing at [vsId]
    //    • possibly previousResponseId

    // Build the final argument for openai.responses.create():
    const createPayload: any = {
      model,
      input: [messageInput],
      tools: toolsArray,
    };
    if (previousResponseId) {
      createPayload.previous_response_id = previousResponseId;
    }

    // 5) Finally, call Responses.create() with file_search enabled:
    const resp = await openai.responses.create(createPayload);

    // 6) Extract the assistant’s reply from resp.output[0]:
    let text = "";
    const firstOutput = resp.output?.[0];
    if (firstOutput?.type === "message") {
      text = firstOutput.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // 7) Return text + responseId + vectorStoreId back to the client:
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
