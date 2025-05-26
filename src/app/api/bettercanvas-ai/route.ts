import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler for text-only chat with optional conversation chaining
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o";
    const prevId = searchParams.get("previous_response_id") || undefined;

    // Use the Responses API to enable conversation state
    const resp = await openai.responses.create({
      model,
      store: true,
      previous_response_id: prevId,
      input: [{ role: "user", content: prompt }],
    });

    return new Response(
      JSON.stringify({ text: resp.output_text, id: resp.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("OpenAI GET error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * POST handler for file + text chat with optional conversation chaining
 */
export async function POST(request: Request) {
  try {
    const { filename, file_data, question, model, previous_response_id } =
      await request.json();
    const visionModel = model || "gpt-4o";

    // Build input array: on first turn include file, subsequent turns omit file
    const fileInput = !previous_response_id
      ? [{ type: "input_file" as const, filename, data: file_data }]
      : [];

    const resp = await openai.responses.create({
      model: visionModel,
      store: true,
      previous_response_id,
      input: [
        {
          role: "user",
          content: [...fileInput, { type: "input_text", text: question }],
        },
      ],
    });

    return new Response(
      JSON.stringify({ text: resp.output_text, id: resp.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("OpenAI POST error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
