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
                  data: { id: `conv_${Date.now()}`, status: "in_progress" },
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
                  data: { text: fullText, status: "completed" },
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
          // CORS headers if needed
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Non-streaming response (your existing code)
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
      conversationId: `conv_${Date.now()}`,
      model: completion.model,
      usage: completion.usage,
    });
  } catch (err: any) {
    console.error("OpenAI request failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST handler - keep your existing logic for file uploads
 */
export async function POST(request: Request) {
  // Your existing POST code here - no changes needed for now
  // ... (keep all your existing POST logic)

  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const question = form.get("question")?.toString() || "";
    const systemPrompt = form.get("system_prompt")?.toString() || "";
    // ... rest of your existing POST code

    return NextResponse.json(
      { error: "POST streaming not implemented yet" },
      { status: 501 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
