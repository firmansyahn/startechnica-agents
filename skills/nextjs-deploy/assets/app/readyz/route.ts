import { probeHeaders, readiness } from "@/libs/health";

// Readiness probe: 200 while the pod can serve traffic, otherwise 503 and it leaves the Service.
export function GET() {
  const { ready, reason } = readiness();
  return Response.json(ready ? { status: "ok" } : { status: "unavailable", reason }, {
    status: ready ? 200 : 503,
    headers: probeHeaders,
  });
}
