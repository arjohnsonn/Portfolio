import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Required for streaming in Next.js App Router
export const dynamic = "force-dynamic";

/**
 * GET handler using the actual Responses API with streaming
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o-mini";
    const systemPrompt = searchParams.get("system_prompt") || "";
    const conversationId = searchParams.get("conversation_id") || null;
    const stream = searchParams.get("stream") === "true";

    // Build the input for Responses API
    const input = prompt;

    if (stream) {
      const encoder = new TextEncoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Use the actual Responses API with streaming
            const stream = await openai.responses.create({
              model,
              input,
              ...(systemPrompt ? { instructions: systemPrompt } : {}),
              stream: true,
              store: true,
            });

            // Process the stream events
            for await (const event of stream) {
              let eventData: any = {
                type: event.type,
                data: event,
              };

              // Handle specific event types with proper type checking
              if (event.type === "response.output_text.delta") {
                const deltaEvent = event as any;
                eventData.delta = deltaEvent.delta;
              } else if (event.type === "response.completed") {
                const completedEvent = event as any;
                eventData.data = {
                  text: completedEvent.response?.output_text || "",
                  conversationId: conversationId || `conv_${Date.now()}`,
                  status: "completed",
                };
              } else if (event.type === "error") {
                const errorEvent = event as any;
                eventData.error = errorEvent.message || "Unknown error";
              }

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`)
              );
            }

            controller.close();
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Non-streaming response using Responses API
    const response = await openai.responses.create({
      model,
      input,
      ...(systemPrompt ? { instructions: systemPrompt } : {}),
      store: true,
    });

    const text = (response as any).output_text || "";

    return NextResponse.json({
      text,
      conversationId: conversationId || `conv_${Date.now()}`,
      responseId: response.id,
      model: response.model,
      usage: response.usage,
    });
  } catch (err: any) {
    console.error("OpenAI request failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST handler for file uploads using Responses API with file_search tool
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
    const stream = form.get("stream") === "true";

    let currentVectorStoreId = vectorStoreId;

    console.log("POST request received:", {
      hasFile: !!file,
      fileName: file?.name,
      question: question.substring(0, 50) + "...",
      conversationId,
      vectorStoreId,
      modelOverride,
      stream,
      currentVectorStoreId,
    });

    // If this is a new conversation with a file, upload and create vector store
    if (!conversationId && file) {
      const upload = await openai.files.create({
        file,
        purpose: "assistants",
      });

      const vectorStore = await openai.vectorStores.create({
        name: `Document Analysis - ${file.name}`,
        expires_after: {
          anchor: "last_active_at",
          days: 1,
        },
      });

      await openai.vectorStores.files.create(vectorStore.id, {
        file_id: upload.id,
      });

      let fileStatus = await openai.vectorStores.files.retrieve(
        vectorStore.id,
        upload.id
      );
      while (fileStatus.status === "in_progress") {
        await new Promise((resolve) => setTimeout(resolve, 50));
        fileStatus = await openai.vectorStores.files.retrieve(
          vectorStore.id,
          upload.id
        );
      }

      if (fileStatus.status === "failed") {
        throw new Error("File processing failed in vector store");
      }

      currentVectorStoreId = vectorStore.id;
    }

    // Build tools array for file search
    const tools: any[] = [];
    if (currentVectorStoreId) {
      tools.push({
        type: "file_search",
        vector_store_ids: [currentVectorStoreId],
      });
    }

    if (stream) {
      console.log("if stream after :", {
        hasFile: !!file,
        fileName: file?.name,
        question: question.substring(0, 50) + "...",
        conversationId,
        vectorStoreId,
        modelOverride,
        stream,
        currentVectorStoreId,
      });

      const encoder = new TextEncoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Use Responses API with file_search tool and streaming
            const stream = await openai.responses.create({
              model: modelOverride,
              input: question,
              ...(systemPrompt ? { instructions: systemPrompt } : {}),
              ...(tools.length > 0 ? { tools } : {}),
              stream: true,
              store: true,
              // Include search results in response
              ...(currentVectorStoreId
                ? {
                    include: ["file_search_call.results"],
                  }
                : {}),
            });

            // Process the stream events
            for await (const event of stream) {
              let eventData: any = {
                type: event.type,
                data: event,
              };

              // Handle specific event types with proper type checking
              if (event.type === "response.output_text.delta") {
                const deltaEvent = event as any;
                eventData.delta = deltaEvent.delta;
              } else if (event.type === "response.completed") {
                const completedEvent = event as any;
                eventData.data = {
                  text: completedEvent.response?.output_text || "",
                  conversationId: conversationId || `conv_${Date.now()}`,
                  vectorStoreId: currentVectorStoreId,
                  responseId: completedEvent.response?.id,
                  status: "completed",
                };
              } else if (event.type === "error") {
                const errorEvent = event as any;
                eventData.error = errorEvent.message || "Unknown error";
              }

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`)
              );
            }

            controller.close();
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    console.log("Not streaming, using Responses API directly:");

    // Non-streaming response using Responses API
    const response = await openai.responses.create({
      model: modelOverride,
      input: question,
      ...(systemPrompt ? { instructions: systemPrompt } : {}),
      ...(tools.length > 0 ? { tools } : {}),
      store: true,
      ...(currentVectorStoreId
        ? {
            include: ["file_search_call.results"],
          }
        : {}),
    });

    const text = (response as any).output_text || "";

    return NextResponse.json({
      text,
      conversationId: conversationId || `conv_${Date.now()}`,
      vectorStoreId: currentVectorStoreId,
      responseId: response.id,
      usage: response.usage,
    });
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
    const responseId = searchParams.get("response_id");

    if (vectorStoreId) {
      try {
        await openai.vectorStores.del(vectorStoreId);
      } catch (err) {
        console.warn("Failed to delete vector store:", err);
      }
    }

    if (responseId) {
      try {
        await openai.responses.del(responseId);
      } catch (err) {
        console.warn("Failed to delete response:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
