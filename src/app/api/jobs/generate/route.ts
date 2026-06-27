import { env } from "@/lib/env";
import { processGenerationJobs } from "@/lib/jobs/generation";

export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (env.cronSecret) {
    if (auth !== `Bearer ${env.cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  } else if (process.env.VERCEL_ENV === "production") {
    return new Response("CRON_SECRET is required in production", {
      status: 401,
    });
  }

  const result = await processGenerationJobs({ limit: 2 });
  return Response.json({ ok: true, ...result });
}
