import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler for text-only chat with optional system prompt
 * Using Chat Completions with conversation history management
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o-mini";
    const systemPrompt = searchParams.get("system_prompt") || "";
    const conversationId = searchParams.get("conversation_id") || null;

    // Build messages array
    const messages = [] as any[];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    // For now, use Chat Completions API until Responses API is fully supported
    const completion = await openai.chat.completions.create({
      model,
      messages,
    });

    console.log("OpenAI completion response:", completion);

    const text = completion.choices?.[0]?.message?.content || "";
    
    return NextResponse.json({ 
      text, 
      conversationId: conversationId || `conv_${Date.now()}`,
      model: completion.model,
      usage: completion.usage
    });
  } catch (err: any) {
    console.error("OpenAI request failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST handler: file upload and analysis using file_search tool
 * Uses Assistants API with file search capability
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const question = form.get("question")?.toString() || "";
    const systemPrompt = form.get("system_prompt")?.toString() || "";
    const conversationId = form.get("conversation_id")?.toString() || null;
    const vectorStoreId = form.get("vector_store_id")?.toString() || null;
    const modelOverride = form.get("model")?.toString() || "gpt-4o-mini";

    let currentVectorStoreId = vectorStoreId;

    // If this is a new conversation with a file, upload and create vector store
    if (!conversationId && file) {
      // Upload file
      const upload = await openai.files.create({ 
        file, 
        purpose: "assistants" 
      });

      // Create vector store and add file
      const vectorStore = await openai.vectorStores.create({
        name: `Document Analysis - ${file.name}`,
        expires_after: {
          anchor: "last_active_at",
          days: 1 // Auto-cleanup after 1 day of inactivity
        }
      });

      await openai.vectorStores.files.create(vectorStore.id, {
        file_id: upload.id
      });

      currentVectorStoreId = vectorStore.id;
    }

    // Create or update assistant with file search tool
    const assistantConfig = {
      model: modelOverride,
      tools: [{ type: "file_search" as const }],
      ...(systemPrompt ? { instructions: systemPrompt } : {}),
      ...(currentVectorStoreId ? {
        tool_resources: {
          file_search: {
            vector_store_ids: [currentVectorStoreId]
          }
        }
      } : {})
    };

    // Create a temporary assistant for this request
    const assistant = await openai.beta.assistants.create(assistantConfig);

    try {
      // Create thread and add message
      const thread = await openai.beta.threads.create();
      
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: question,
      });

      // Run the assistant
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });

      // Poll until run completes
      let status = run;
      while (["queued", "in_progress"].includes(status.status)) {
        await new Promise((r) => setTimeout(r, 500));
        status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      }

      if (status.status !== "completed") {
        throw new Error(`Run ended with status: ${status.status}`);
      }

      // Retrieve assistant reply
      const msgs = await openai.beta.threads.messages.list(thread.id, {
        run_id: run.id,
        limit: 1,
        order: "desc",
      });

      const reply = msgs.data[0];
      const text = reply.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text.value)
        .join("");

      // Extract file search annotations if available
      const annotations = reply.content
        .filter((c: any) => c.type === "text")
        .flatMap((c: any) => c.text.annotations || []);

      return NextResponse.json({ 
        text, 
        conversationId: conversationId || `conv_${Date.now()}`,
        vectorStoreId: currentVectorStoreId,
        threadId: thread.id,
        annotations,
        usage: status.usage
      });

    } finally {
      // Clean up temporary assistant
      await openai.beta.assistants.del(assistant.id);
    }

  } catch (err: any) {
    console.error("POST handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE handler: cleanup vector stores when done
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vectorStoreId = searchParams.get("vector_store_id");
    const threadId = searchParams.get("thread_id");

    if (vectorStoreId) {
      try {
        await openai.vectorStores.del(vectorStoreId);
      } catch (err) {
        console.warn("Failed to delete vector store:", err);
      }
    }

    if (threadId) {
      try {
        await openai.beta.threads.del(threadId);
      } catch (err) {
        console.warn("Failed to delete thread:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}