/**
 * GET /api/health
 *
 * Health check endpoint for load balancers, container orchestrators,
 * and monitoring tools. Returns 200 if the service is healthy.
 */
export async function GET() {
  return Response.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
