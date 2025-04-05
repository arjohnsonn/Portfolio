const QUOTES = [
  "OU STILL SUCKS",
  "new semester new me",
  "does this help yalls grade",
  "what is an aggie😭",
  "Hook 'em",
  "can we pet bevo",
];

export async function GET(request: Request) {
  // Get random string from quotes

  const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  return new Response(JSON.stringify(randomQuote), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
