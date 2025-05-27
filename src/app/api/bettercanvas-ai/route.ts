import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID!;

/**
 * GET handler for simple text-only chat
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices?.[0]?.message?.content || "";
    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("OpenAI request failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST handler: upload a file once, then reuse thread for follow-up questions
 * Expects multipart/form-data:
 *   - file?: File (only on first call)
 *   - question: string
 *   - threadId?: string
 *   - model?: string
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const question = form.get("question")?.toString() || "";
    const threadId = form.get("threadId")?.toString() || null;
    const modelOverride = form.get("model")?.toString();

    let thread_id = threadId;
    console.log("Received POST request:", {
      threadId: thread_id,
      question,
      modelOverride,
      hasFile: !!file,
    });

    // Initial request: upload file, create thread, index file
    if (!thread_id) {
      if (!file) {
        throw new Error("Missing file on initial upload");
      }
      const upload = await openai.files.create({
        file,
        purpose: "assistants",
      });
      const thread = await openai.beta.threads.create();
      thread_id = thread.id;
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
    } else {
      // Follow-up: just append question
      await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: question,
      });
    }

    // Kick off a run for the assistant
    const run = await openai.beta.threads.runs.create(thread_id, {
      assistant_id: ASSISTANT_ID,
      ...(modelOverride ? { model: modelOverride } : {}),
    });

    // Poll until completion
    let status = run;
    while (["queued", "in_progress"].includes(status.status)) {
      await new Promise((r) => setTimeout(r, 500));
      status = await openai.beta.threads.runs.retrieve(thread_id, run.id);
    }
    if (status.status !== "completed") {
      throw new Error(`Run ended with status: ${status.status}`);
    }

    // Retrieve the assistant's reply
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

    return NextResponse.json({ text, threadId: thread_id });
  } catch (err: any) {
    console.error("POST handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
