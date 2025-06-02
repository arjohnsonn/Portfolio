import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Missing PDF file in request" },
        { status: 400 }
      );
    }

    // Read the uploaded file into a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use pdf-parse to extract all text
    const parsed = await pdfParse(buffer);
    const text = parsed.text;

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("PDF parse failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
