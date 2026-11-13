import { probeHeaders } from "@/libs/health";

// Liveness probe: the server answers. Checks nothing else, so no dependency outage restarts the pod.
export function GET() {
  return Response.json({ status: "ok" }, { headers: probeHeaders });
}
