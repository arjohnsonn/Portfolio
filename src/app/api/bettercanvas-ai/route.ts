import { OpenAI } from "openai";
import { createHash } from "crypto";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// In-memory cache: map SHA256(file_data) -> OpenAI file ID
const fileCache = new Map<string, string>();

/**
 * GET handler for text-only chat with conversation chaining
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") || "";
    const model = searchParams.get("model") || "gpt-4o";
    const previousResponseId =
      searchParams.get("previous_response_id") || undefined;

    const resp = await openai.responses.create({
      model,
      store: true,
      previous_response_id: previousResponseId,
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
 * POST handler for file + text chat with caching and conversation chaining
 */
export async function POST(request: Request) {
  try {
    const { filename, file_data, question, model, previous_response_id } =
      await request.json();
    const visionModel = model || "gpt-4o";

    // Compute hash of base64 data for deduplication
    const hash = createHash("sha256").update(file_data).digest("hex");
    let fileId = fileCache.get(hash);

    // Upload once if not cached
    if (!fileId) {
      const base64 = file_data.split(",")[1];
      const buffer = Buffer.from(base64, "base64");

      const upload = await openai.files.create({
        file: buffer as unknown as any,
        purpose: "user_data",
      });
      fileId = upload.id;
      fileCache.set(hash, fileId);
    }

    // Build input content: include file_id only on first turn
    const contentBlocks: Array<any> = [];
    if (!previous_response_id) {
      contentBlocks.push({
        type: "input_file",
        file_id: fileId,
      });
    }
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
