import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// This is required for streaming in Next.js App Router
export const dynamic = "force-dynamic";

/**
 * GET handler with proper streaming support
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o-mini";
    const systemPrompt = searchParams.get("system_prompt") || "";
    const conversationId = searchParams.get("conversation_id") || null;
    const stream = searchParams.get("stream") === "true";

    // If streaming is requested
    if (stream) {
      const encoder = new TextEncoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Use OpenAI's streaming with Chat Completions
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
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "response.created",
                  data: {
                    id: `conv_${Date.now()}`,
                    status: "in_progress",
                    conversationId: conversationId || `conv_${Date.now()}`,
                  },
                })}\n\n`
              )
            );

            let fullText = "";
            for await (const chunk of completion) {
              const delta = chunk.choices[0]?.delta?.content || "";
              if (delta) {
                fullText += delta;
                const event = {
                  type: "response.output_text.delta",
                  delta,
                  text: fullText,
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                );
              }
            }

            // Send completion event
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "response.completed",
                  data: {
                    text: fullText,
                    status: "completed",
                    conversationId: conversationId || `conv_${Date.now()}`,
                  },
                })}\n\n`
              )
            );

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

    // Non-streaming response
    const messages = [] as any[];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const completion = await openai.chat.completions.create({
      model,
      messages,
    });

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
 * POST handler: file upload and analysis with streaming support
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

    // If streaming is requested
    if (stream) {
      const encoder = new TextEncoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          let assistant: any = null;
          try {
            // Send initial events
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "response.created",
                  data: {
                    id: `conv_${Date.now()}`,
                    status: "in_progress",
                    conversationId: conversationId || `conv_${Date.now()}`,
                    vectorStoreId: currentVectorStoreId,
                  },
                })}\n\n`
              )
            );

            if (currentVectorStoreId) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "response.file_search_call.in_progress",
                    data: { vectorStoreId: currentVectorStoreId },
                  })}\n\n`
                )
              );
            }

            // Create assistant
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

            assistant = await openai.beta.assistants.create(assistantConfig);
            const thread = await openai.beta.threads.create();

            await openai.beta.threads.messages.create(thread.id, {
              role: "user",
              content: question,
            });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "response.file_search_call.searching",
                  data: {},
                })}\n\n`
              )
            );

            const run = await openai.beta.threads.runs.create(thread.id, {
              assistant_id: assistant.id,
            });

            // Poll for completion and stream updates
            let status = run;
            while (["queued", "in_progress"].includes(status.status)) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "response.in_progress",
                    data: { status: status.status },
                  })}\n\n`
                )
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

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "response.file_search_call.completed",
                  data: {},
                })}\n\n`
              )
            );

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

            // Send text as if it was streaming (simulate delta for UX)
            const words = text.split(" ");
            let currentText = "";
            for (const word of words) {
              currentText += (currentText ? " " : "") + word;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "response.output_text.delta",
                    delta: currentText === word ? word : " " + word,
                    text: currentText,
                  })}\n\n`
                )
              );
              // Small delay to make it feel like streaming
              await new Promise((r) => setTimeout(r, 50));
            }

            // Send completion event
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "response.completed",
                  data: {
                    text,
                    conversationId: conversationId || `conv_${Date.now()}`,
                    vectorStoreId: currentVectorStoreId,
                    threadId: thread.id,
                    status: "completed",
                  },
                })}\n\n`
              )
            );

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
          } finally {
            // Cleanup assistant
            if (assistant) {
              try {
                await openai.beta.assistants.del(assistant.id);
              } catch (err) {
                console.warn("Failed to cleanup assistant:", err);
              }
            }
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

    // Non-streaming response (your existing logic)
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
