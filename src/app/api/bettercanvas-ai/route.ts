import { OpenAI } from "openai";

// Initialize OpenAI client with server-side API key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt") ?? "Hello, how can I help you?";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        // { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    const text = completion.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("OpenAI request failed:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch completion from OpenAI." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
