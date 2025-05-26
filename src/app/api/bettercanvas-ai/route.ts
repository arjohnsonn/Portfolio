import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET handler for text-only chat with conversation chaining
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o";
    const previous_response_id =
      searchParams.get("previous_response_id") || undefined;

    const resp = await openai.responses.create({
      model,
      store: true,
      previous_response_id,
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
 * POST handler for file + text chat with conversation chaining
 * Clients should send either `file_data`+`filename` (first turn) or `file_id` (subsequent turns)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      file_id,
      filename,
      file_data,
      question,
      model,
      previous_response_id,
    } = body;
    const visionModel = model || "gpt-4o";

    // Determine whether to upload or reuse
    let fid = file_id;
    if (!fid) {
      if (!file_data || !filename) {
        throw new Error("Missing file_data or filename for initial upload");
      }
      // file_data is data:<mime>;base64,<b64>
      const base64 = file_data.split(",")[1];
      const buffer = Buffer.from(base64, "base64");

      const upload = await openai.files.create({
        file: buffer as any,
        purpose: "user_data",
      });
      fid = upload.id;
    }

    // Build input blocks
    const contentBlocks: Array<any> = [];
    // initial turn: attach file_id
    if (!previous_response_id) {
      contentBlocks.push({ type: "input_file", file_id: fid });
    }
    // always attach the question text
    contentBlocks.push({ type: "input_text", text: question });

    const resp = await openai.responses.create({
      model: visionModel,
      store: true,
      previous_response_id,
      input: [
        {
          role: "user",
          content: contentBlocks,
        },
      ],
    });

    return new Response(
      JSON.stringify({ text: resp.output_text, id: resp.id, file_id: fid }),
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
