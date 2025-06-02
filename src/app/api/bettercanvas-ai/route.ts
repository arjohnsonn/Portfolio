import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler: text‐only chat via Responses API
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o-mini";

    // Create a new Response via the Responses API, using a plain string for input
    const resp = await openai.responses.create({
      model,
      input: prompt, // plain string → simple chat
    });

    let text = "";
    const outputItem = resp.output?.[0];

    if (outputItem && outputItem.type === "message") {
      // Combine all “output_text” segments inside the message
      text = outputItem.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // (No need for a `else if (type === "output_text")`—that cannot occur at the top level.)

    return NextResponse.json({
      text,
      responseId: resp.id,
    });
  } catch (err: any) {
    console.error("GET /bettercanvas-ai error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST handler: “file chat” with Responses API
 *
 * - On the very first call (no previousResponseId), we:
 *     1) upload the file (purpose: "assistants")
 *     2) call `responses.create({ input: [ { type: "file_search_call", file_id }, { type: "message", role:"user", content: question } ] })`
 *
 * - On follow-ups (previousResponseId != null), we:
 *     1) send only the user message in input
 *     2) set previous_response_id to the prior response’s ID
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const maybeFile = form.get("file");
    const question = form.get("question")?.toString() || "";
    const previousResponseId =
      form.get("previousResponseId")?.toString() || null;
    const model = form.get("model")?.toString() || "gpt-4o-mini";

    let createArgs: any = { model };

    if (!previousResponseId) {
      // ─── INITIAL CALL: must include a File + question ───────────────────────
      if (!(maybeFile instanceof File)) {
        throw new Error("Missing or invalid file on initial POST");
      }

      // 1) Upload the file to OpenAI with purpose "assistants"
      const upload = await openai.files.create({
        file: maybeFile,
        purpose: "assistants",
      });

      // 2) Build input array: first a file_search_call, then the user’s message
      createArgs.input = [
        { type: "file_search_call", file_id: upload.id },
        { type: "message", role: "user", content: question },
      ];
    } else {
      // ─── FOLLOW-UP: only a user message + previous_response_id ─────────────────
      createArgs.input = [{ type: "message", role: "user", content: question }];
      createArgs.previous_response_id = previousResponseId;
    }

    // 3) Call the Responses API
    const resp = await openai.responses.create(createArgs);

    // 4) Extract the assistant’s reply from resp.output[0]
    let text = "";
    const outputItem = resp.output?.[0];

    if (outputItem && outputItem.type === "message") {
      text = outputItem.content
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
    }

    // 5) Return the text + the new responseId for the client to pass next time
    return NextResponse.json({
      text,
      responseId: resp.id,
    });
  } catch (err: any) {
    console.error("POST /bettercanvas-ai error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
