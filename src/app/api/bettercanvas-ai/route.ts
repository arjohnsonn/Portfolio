import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID!;

/**
 * GET handler for simple text-only chat
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o";

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices?.[0]?.message?.content || "";
    return new NextResponse(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("OpenAI request failed:", err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * POST handler: upload a file, attach it to a Thread, and ask the assistant
 * Expects multipart/form-data:
 *   - file: File (your PDF, PNG, etc)
 *   - question: string
 *   - threadId?: string
 *   - model?: string
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File;
    const question = form.get("question")?.toString() || "";
    const threadId = form.get("threadId")?.toString();
    const modelOverride = form.get("model")?.toString();

    // 1) Upload the file to OpenAI
    const upload = await openai.files.create({
      file,
      purpose: "assistants",
    });

    // 2) Create (or reuse) a Thread
    let thread_id = threadId;
    if (!thread_id) {
      const newThread = await openai.beta.threads.create();
      thread_id = newThread.id;
    }

    // 3) Post your question + the file as an attachment (for file_search)
    await openai.beta.threads.messages.create(thread_id, {
      role: "user",
      content: question,
      attachments: [
        {
          file_id: upload.id,
          tools: [{ type: "file_search" }],
        },
      ],
    });

    // 4) Kick off a Run
    const run = await openai.beta.threads.runs.create(thread_id, {
      assistant_id: ASSISTANT_ID,
      ...(modelOverride ? { model: modelOverride } : {}),
    });

    // 5) Poll until the Run completes
    let status = run;
    while (["queued", "in_progress"].includes(status.status)) {
      await new Promise((r) => setTimeout(r, 500));
      status = await openai.beta.threads.runs.retrieve(thread_id, run.id);
    }
    if (status.status !== "completed") {
      throw new Error(`Run ended with status: ${status.status}`);
    }

    // 6) Fetch the assistant’s reply from that run
    const msgs = await openai.beta.threads.messages.list(thread_id, {
      run_id: run.id,
      limit: 1,
      order: "desc",
    });
    const reply = msgs.data[0];
    const text = reply.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text.value : ""))
      .join("");

    return new NextResponse(JSON.stringify({ text, threadId: thread_id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("POST handler error:", err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
