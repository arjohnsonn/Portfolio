const FFLAGS = {
  "Wrapped": false
}

export async function GET(request: Request) {
  return new Response(JSON.stringify(FFLAGS), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
