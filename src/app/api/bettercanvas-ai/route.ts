import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID!;

/**
 * GET handler for text-only chat with optional system prompt
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o-mini";
    const systemPrompt = searchParams.get("system_prompt") || "";

    const messages = [] as any;
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const completion = await openai.chat.completions.create({
      model,
      messages,
    });

    const text = completion.choices?.[0]?.message?.content || "";
    return NextResponse.json({ text: text });
  } catch (err: any) {
    console.error("OpenAI request failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST handler: upload file once, then reuse thread for follow-ups
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const question = form.get("question")?.toString() || "";
    const systemPrompt = form.get("system_prompt")?.toString() || "";
    const threadId = form.get("threadId")?.toString() || null;
    const modelOverride = form.get("model")?.toString() || undefined;

    let thread_id = threadId;

    // Initial: upload and index file
    if (!thread_id) {
      if (!file) throw new Error("Missing file on initial upload");
      const upload = await openai.files.create({ file, purpose: "assistants" });
      const thread = await openai.beta.threads.create();
      thread_id = thread.id;
      await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: question,
        attachments: [{ file_id: upload.id, tools: [{ type: "file_search" }] }],
      });
    } else {
      // Follow-up: append question only
      await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: question,
      });
    }

    // Kick off assistant run with optional overrides
    const run = await openai.beta.threads.runs.create(thread_id, {
      assistant_id: ASSISTANT_ID,
      ...(modelOverride ? { model: modelOverride } : {}),
      ...(systemPrompt ? { instructions: systemPrompt } : {}),
    });

    // Poll until run completes
    let status = run;
    while (["queued", "in_progress"].includes(status.status)) {
      await new Promise((r) => setTimeout(r, 500));
      status = await openai.beta.threads.runs.retrieve(thread_id, run.id);
    }
    if (status.status !== "completed") {
      throw new Error(`Run ended with status: ${status.status}`);
    }

    // Retrieve assistant reply
    const msgs = await openai.beta.threads.messages.list(thread_id, {
      run_id: run.id,
      limit: 1,
      order: "desc",
    });
    const reply = msgs.data[0];
    const raw = reply.content
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { type: string; text: { value: any } }) =>
        c.type === "text" ? c.text.value : ""
      )
      .join("");
    const text = raw;

    return NextResponse.json({ text, threadId: thread_id });
  } catch (err: any) {
    console.error("POST handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
