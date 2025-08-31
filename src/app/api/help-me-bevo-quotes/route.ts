const QUOTES = [
  "OU STILL SUCKS",
  "what is an aggie😭",
  "Hook 'em",
  "can we pet bevo",
  "let's lock in fr this time",
  "use arrow keys to control bevo",
  
];

export async function GET(request: Request) {
  // Get random string from quotes

  const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  return new Response(JSON.stringify(randomQuote), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
