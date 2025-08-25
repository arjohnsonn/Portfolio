const QUOTES = [
  "OU STILL SUCKS",
  "what is an aggie😭",
  "Hook 'em",
  "can we pet bevo",
  "WELCOME BACK!",
  "new year new me prob",
  "let's lock in fr this time",
];

export async function GET(request: Request) {
  // Get random string from quotes

  const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  return new Response(JSON.stringify(randomQuote), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
