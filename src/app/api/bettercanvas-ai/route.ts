import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler for text-only chat
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
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("OpenAI request failed:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * POST handler for file uploads (PDF, PNG, etc.)
 */
export async function POST(request: Request) {
  try {
    const { filename, file_data, question, model } = await request.json();
    const visionModel = model || "gpt-4o";

    // Call Responses API with mixed file + text input
    const visionResponse = await openai.responses.create({
      model: visionModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", filename, file_data },
            { type: "input_text", text: question },
          ],
        },
      ],
    });

    return new Response(JSON.stringify({ text: visionResponse.output_text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Vision request failed:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
