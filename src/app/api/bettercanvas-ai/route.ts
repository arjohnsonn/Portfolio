import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Required for streaming in Next.js App Router
export const dynamic = "force-dynamic";

/**
 * GET handler with proper conversation chaining
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o-mini";
    const systemPrompt = searchParams.get("system_prompt") || "";
    const previousResponseId = searchParams.get("conversation_id") || null;
    const stream = searchParams.get("stream") === "true";

    // Build the request - use previous_response_id for conversation continuity
    const requestParams: any = {
      model,
      input: prompt, // For new conversations, just the prompt
      ...(systemPrompt ? { instructions: systemPrompt } : {}),
      user: "BC",
      store: true,
    };

    // If we have a previous response, chain the conversation
    if (previousResponseId && previousResponseId !== "undefined") {
      requestParams.previous_response_id = previousResponseId;
      // When chaining, input should be an array with the new message
      requestParams.input = [{ role: "user", content: prompt }];
    }

    if (stream) {
      const encoder = new TextEncoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Add stream: true to the params
            const streamParams = { ...requestParams, stream: true };
            const responseStream = await openai.responses.create(streamParams);

            let responseId = "";
            let fullText = "";

            // Properly type the async iterator
            for await (const event of responseStream as any) {
              let eventData: any = {
                type: event.type,
                data: event,
              };

              if (event.type === "response.output_text.delta") {
                eventData.delta = event.delta;
                fullText += event.delta || "";
              } else if (event.type === "response.completed") {
                responseId = event.response?.id || "";
                eventData.data = {
                  text: event.response?.output_text || fullText,
                  conversationId: responseId, // Use the actual response ID as conversation ID
                  responseId: responseId,
                  status: "completed",
                  usage: event.response?.usage || null,
                };

                console.log("Streaming response completed:", eventData.data);
              } else if (event.type === "error") {
                eventData.error = event.message || "Unknown error";
              }

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`)
              );
            }

            controller.close();
          } catch (error) {
            console.error("Streaming error:", error);
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

    // Non-streaming response
    const response = await openai.responses.create(requestParams);

    // Type assertion for the response
    const typedResponse = response as any;
    const text = typedResponse.output_text || "";

    return NextResponse.json({
      text,
      conversationId: response.id, // Use the actual response ID
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
 * POST handler with conversation chaining for file uploads
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const question = form.get("question")?.toString() || "";
    const systemPrompt = form.get("system_prompt")?.toString() || "";
    const previousResponseId = form.get("conversation_id")?.toString() || null;
    const vectorStoreId = form.get("vector_store_id")?.toString() || null;
    const modelOverride = form.get("model")?.toString() || "gpt-4o-mini";
    const stream = form.get("stream") === "true";

    let currentVectorStoreId = vectorStoreId;

    console.log("POST request received:", {
      hasFile: !!file,
      fileName: file?.name,
      question: question.substring(0, 50) + "...",
      previousResponseId,
      vectorStoreId,
      modelOverride,
      stream,
    });

    // Handle file upload for new conversations
    if (!previousResponseId && file) {
      console.log("Creating new vector store for file:", file.name);

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

      // Wait for file processing
      let fileStatus = await openai.vectorStores.files.retrieve(
        vectorStore.id,
        upload.id
      );

      while (fileStatus.status === "in_progress") {
        await new Promise((resolve) => setTimeout(resolve, 100));
        fileStatus = await openai.vectorStores.files.retrieve(
          vectorStore.id,
          upload.id
        );
      }

      if (fileStatus.status === "failed") {
        throw new Error("File processing failed in vector store");
      }

      currentVectorStoreId = vectorStore.id;
      console.log("Vector store created:", currentVectorStoreId);
    }

    // Build tools array for file search
    const tools: any[] = [];
    if (currentVectorStoreId) {
      tools.push({
        type: "file_search",
        vector_store_ids: [currentVectorStoreId],
      });
    }

    // Build the request with proper conversation chaining
    const requestParams: any = {
      model: modelOverride,
      input: question,
      ...(systemPrompt ? { instructions: systemPrompt } : {}),
      ...(tools.length > 0 ? { tools } : {}),
      user: "BC",
      store: true,
      ...(currentVectorStoreId
        ? { include: ["file_search_call.results"] }
        : {}),
    };

    // Chain conversation if we have a previous response
    if (previousResponseId && previousResponseId !== "undefined") {
      requestParams.previous_response_id = previousResponseId;
      requestParams.input = [{ role: "user", content: question }];
      console.log(
        "Chaining conversation with previous response:",
        previousResponseId
      );
    }

    if (stream) {
      const encoder = new TextEncoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Add stream: true to the params
            const streamParams = { ...requestParams, stream: true };
            const responseStream = await openai.responses.create(streamParams);

            let responseId = "";
            let fullText = "";

            // Properly handle the async iterator
            for await (const event of responseStream as any) {
              let eventData: any = {
                type: event.type,
                data: event,
              };

              // Handle specific event types
              if (event.type === "response.output_text.delta") {
                eventData.delta = event.delta;
                fullText += event.delta || "";
              } else if (event.type === "response.completed") {
                responseId = event.response?.id || "";
                eventData.data = {
                  text: event.response?.output_text || fullText,
                  conversationId: responseId, // Use actual response ID
                  vectorStoreId: currentVectorStoreId,
                  responseId: responseId,
                  status: "completed",
                  usage: event.response?.usage || null,
                };
                console.log(
                  "Streaming file response completed:",
                  eventData.data
                );
              } else if (event.type === "error") {
                eventData.error = event.message || "Unknown error";
              } else if (
                event.type === "response.file_search_call.in_progress"
              ) {
                eventData.data = { message: "Searching files..." };
              } else if (event.type === "response.file_search_call.completed") {
                eventData.data = {
                  message: "File search completed. Generating response...",
                };
              }

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`)
              );
            }

            controller.close();
          } catch (error) {
            console.error("Streaming POST error:", error);
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

    console.log("Creating non-streaming response...");

    // Non-streaming response
    const response = await openai.responses.create(requestParams);

    // Type assertion for the response
    const typedResponse = response as any;
    const text = typedResponse.output_text || "";

    const result = {
      text,
      conversationId: response.id, // Use actual response ID
      vectorStoreId: currentVectorStoreId,
      responseId: response.id,
      usage: response.usage,
    };

    console.log("Non-streaming response completed:", result);

    return NextResponse.json(result);
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

    console.log("DELETE request for cleanup:", { vectorStoreId, responseId });

    if (vectorStoreId) {
      try {
        await openai.vectorStores.del(vectorStoreId);
        console.log("Vector store deleted:", vectorStoreId);
      } catch (err) {
        console.warn("Failed to delete vector store:", err);
      }
    }

    if (responseId) {
      try {
        await openai.responses.del(responseId);
        console.log("Response deleted:", responseId);
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
