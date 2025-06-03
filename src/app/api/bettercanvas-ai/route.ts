import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler for text-only chat with optional streaming
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o-mini";
    const systemPrompt = searchParams.get("system_prompt") || "";
    const conversationId = searchParams.get("conversation_id") || null;
    const stream = searchParams.get("stream") === "true";

    // If streaming is requested, set up SSE response
    if (stream) {
      const encoder = new TextEncoder();

      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            // For now, use Chat Completions streaming until Responses API is fully supported
            const completion = await openai.chat.completions.create({
              model,
              messages: [
                ...(systemPrompt
                  ? [{ role: "system" as const, content: systemPrompt }]
                  : []),
                { role: "user" as const, content: prompt },
              ],
              stream: true,
            });

            // Send initial event
            const initialEvent = {
              type: "response.created",
              data: {
                id: `conv_${Date.now()}`,
                model,
                conversationId: conversationId || `conv_${Date.now()}`,
                status: "in_progress",
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`)
            );

            let fullText = "";
            for await (const chunk of completion) {
              const delta = chunk.choices[0]?.delta?.content || "";
              if (delta) {
                fullText += delta;
                const deltaEvent = {
                  type: "response.output_text.delta",
                  delta,
                  text: fullText,
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(deltaEvent)}\n\n`)
                );
              }
            }

            // Send completion event
            const completionEvent = {
              type: "response.completed",
              data: {
                text: fullText,
                conversationId: conversationId || `conv_${Date.now()}`,
                status: "completed",
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(completionEvent)}\n\n`)
            );
            controller.close();
          } catch (error) {
            const errorEvent = {
              type: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(customReadable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming response (existing logic)
    const messages = [] as any[];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

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
      usage: completion.usage,
    });
  } catch (err: any) {
    console.error("OpenAI request failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST handler: file upload and analysis with optional streaming
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

      currentVectorStoreId = vectorStore.id;
    }

    // If streaming is requested for file analysis
    if (stream) {
      const encoder = new TextEncoder();

      const customReadable = new ReadableStream({
        async start(controller) {
          try {
            // Send initial events
            const initialEvent = {
              type: "response.created",
              data: {
                id: `conv_${Date.now()}`,
                model: modelOverride,
                conversationId: conversationId || `conv_${Date.now()}`,
                vectorStoreId: currentVectorStoreId,
                status: "in_progress",
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`)
            );

            if (currentVectorStoreId) {
              const searchEvent = {
                type: "response.file_search_call.in_progress",
                data: { vectorStoreId: currentVectorStoreId },
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(searchEvent)}\n\n`)
              );
            }

            // Create and run assistant (simplified for streaming)
            const assistantConfig = {
              model: modelOverride,
              tools: [{ type: "file_search" as const }],
              ...(systemPrompt ? { instructions: systemPrompt } : {}),
              ...(currentVectorStoreId
                ? {
                    tool_resources: {
                      file_search: {
                        vector_store_ids: [currentVectorStoreId],
                      },
                    },
                  }
                : {}),
            };

            const assistant = await openai.beta.assistants.create(
              assistantConfig
            );
            const thread = await openai.beta.threads.create();

            await openai.beta.threads.messages.create(thread.id, {
              role: "user",
              content: question,
            });

            const run = await openai.beta.threads.runs.create(thread.id, {
              assistant_id: assistant.id,
            });

            // Poll for completion and stream updates
            let status = run;
            while (["queued", "in_progress"].includes(status.status)) {
              const progressEvent = {
                type: "response.in_progress",
                data: { status: status.status },
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(progressEvent)}\n\n`)
              );

              await new Promise((r) => setTimeout(r, 1000));
              status = await openai.beta.threads.runs.retrieve(
                thread.id,
                run.id
              );
            }

            if (status.status !== "completed") {
              throw new Error(`Run ended with status: ${status.status}`);
            }

            // Get final response
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

            // Send completion event
            const completionEvent = {
              type: "response.completed",
              data: {
                text,
                conversationId: conversationId || `conv_${Date.now()}`,
                vectorStoreId: currentVectorStoreId,
                threadId: thread.id,
                status: "completed",
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(completionEvent)}\n\n`)
            );

            // Cleanup
            await openai.beta.assistants.del(assistant.id);
            controller.close();
          } catch (error) {
            const errorEvent = {
              type: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(customReadable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming response (existing logic)
    const assistantConfig = {
      model: modelOverride,
      tools: [{ type: "file_search" as const }],
      ...(systemPrompt ? { instructions: systemPrompt } : {}),
      ...(currentVectorStoreId
        ? {
            tool_resources: {
              file_search: {
                vector_store_ids: [currentVectorStoreId],
              },
            },
          }
        : {}),
    };

    const assistant = await openai.beta.assistants.create(assistantConfig);

    try {
      const thread = await openai.beta.threads.create();

      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: question,
      });

      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });

      let status = run;
      while (["queued", "in_progress"].includes(status.status)) {
        await new Promise((r) => setTimeout(r, 500));
        status = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      }

      if (status.status !== "completed") {
        throw new Error(`Run ended with status: ${status.status}`);
      }

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

      const annotations = reply.content
        .filter((c: any) => c.type === "text")
        .flatMap((c: any) => c.text.annotations || []);

      return NextResponse.json({
        text,
        conversationId: conversationId || `conv_${Date.now()}`,
        vectorStoreId: currentVectorStoreId,
        threadId: thread.id,
        annotations,
        usage: status.usage,
      });
    } finally {
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
