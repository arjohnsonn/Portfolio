import { NextResponse } from "next/server";

const QUOTES = [
  "OU STILL SUCKS",
  "new semester new me",
  "does this help yalls grade",
  "what is an aggie😭",
  "Hook 'em",
  "can we pet bevo",
];

export async function OPTIONS() {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new NextResponse(null, { status: 200, headers });
}

export async function GET(request: Request) {
  // Get random string from quotes

  const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  return new Response(JSON.stringify(randomQuote), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
