import { randomUUID } from "node:crypto";
import { runGeneration, runPageRegeneration } from "@/lib/ai/storybook";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/env";
import { updateBook } from "@/lib/books/store";
import type {
  GenerationJob,
  GenerationJobStatus,
  GenerationJobType,
} from "@/lib/books/types";

const ACTIVE: GenerationJobStatus[] = ["pending", "running"];
const STALE_LOCK_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

const globalForJobs = globalThis as unknown as {
  __mockGenerationJobs?: Map<string, GenerationJob>;
};
const mockJobs = (globalForJobs.__mockGenerationJobs ??= new Map());

type EnqueueInput = {
  bookId: string;
  userId: string;
  type: GenerationJobType;
  pageIndex?: number | null;
};

type ProcessResult = {
  claimed: number;
  completed: number;
  failed: number;
};

type JobRow = Record<string, string | number | null>;

export async function enqueueGenerationJob(
  input: EnqueueInput,
): Promise<GenerationJob> {
  const pageIndex = input.type === "page" ? input.pageIndex ?? null : null;

  if (!isSupabaseConfigured) {
    const existing = [...mockJobs.values()].find(
      (job) =>
        job.bookId === input.bookId &&
        job.type === input.type &&
        job.pageIndex === pageIndex &&
        ACTIVE.includes(job.status),
    );
    if (existing) return existing;

    const job: GenerationJob = {
      id: randomUUID(),
      bookId: input.bookId,
      userId: input.userId,
      type: input.type,
      pageIndex,
      status: "pending",
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextRunAt: nowIso(),
      lockedAt: null,
      lastError: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    mockJobs.set(job.id, job);
    return job;
  }

  const supabase = getAdminClient();
  let existingQuery = supabase
    .from("generation_jobs")
    .select()
    .eq("book_id", input.bookId)
    .eq("type", input.type)
    .in("status", ACTIVE)
    .limit(1);
  existingQuery =
    pageIndex === null
      ? existingQuery.is("page_index", null)
      : existingQuery.eq("page_index", pageIndex);

  const { data: existing, error: existingError } = await existingQuery;
  if (existingError) {
    throw new Error(`enqueueGenerationJob: ${existingError.message}`);
  }
  if (existing?.[0]) return rowToJob(existing[0]);

  const { data, error } = await supabase
    .from("generation_jobs")
    .insert({
      book_id: input.bookId,
      user_id: input.userId,
      type: input.type,
      page_index: pageIndex,
      status: "pending",
      max_attempts: DEFAULT_MAX_ATTEMPTS,
    })
    .select()
    .single();

  if (error) {
    // A concurrent request may have inserted the same active job.
    if (error.code === "23505") {
      return enqueueGenerationJob(input);
    }
    throw new Error(`enqueueGenerationJob: ${error.message}`);
  }
  return rowToJob(data);
}

export async function processGenerationJobs(
  opts: { limit?: number } = {},
): Promise<ProcessResult> {
  const jobs = await claimGenerationJobs(opts.limit ?? 2);
  const result: ProcessResult = { claimed: jobs.length, completed: 0, failed: 0 };

  for (const job of jobs) {
    try {
      if (job.type === "page") {
        if (job.pageIndex === null) {
          throw new Error("Page generation job missing pageIndex");
        }
        await runPageRegeneration(job.bookId, job.pageIndex, { admin: true });
      } else {
        await runGeneration(job.bookId, { admin: true });
      }
      await completeGenerationJob(job.id);
      result.completed += 1;
    } catch (err) {
      await failGenerationJob(job, err);
      result.failed += 1;
    }
  }

  return result;
}

async function claimGenerationJobs(limit: number): Promise<GenerationJob[]> {
  if (!isSupabaseConfigured) return claimMockJobs(limit);

  const supabase = getAdminClient();
  const now = nowIso();
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();

  const { data: pending, error: pendingError } = await supabase
    .from("generation_jobs")
    .select()
    .eq("status", "pending")
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(limit);
  if (pendingError) throw new Error(`claim pending jobs: ${pendingError.message}`);

  const remaining = Math.max(0, limit - (pending?.length ?? 0));
  const { data: stale, error: staleError } =
    remaining > 0
      ? await supabase
          .from("generation_jobs")
          .select()
          .eq("status", "running")
          .lt("locked_at", staleBefore)
          .order("locked_at", { ascending: true })
          .limit(remaining)
      : { data: [], error: null };
  if (staleError) throw new Error(`claim stale jobs: ${staleError.message}`);

  const candidates = [...(pending ?? []), ...(stale ?? [])].slice(0, limit);
  const claimed: GenerationJob[] = [];

  for (const row of candidates) {
    const job = rowToJob(row);
    const { data, error } = await supabase
      .from("generation_jobs")
      .update({
        status: "running",
        locked_at: nowIso(),
        attempts: job.attempts + 1,
        updated_at: nowIso(),
      })
      .eq("id", job.id)
      .select()
      .single();
    if (!error && data) claimed.push(rowToJob(data));
  }

  return claimed;
}

function claimMockJobs(limit: number): GenerationJob[] {
  const now = Date.now();
  const staleBefore = now - STALE_LOCK_MS;
  const candidates = [...mockJobs.values()]
    .filter((job) => {
      if (job.status === "pending") {
        return new Date(job.nextRunAt).getTime() <= now;
      }
      return (
        job.status === "running" &&
        job.lockedAt !== null &&
        new Date(job.lockedAt).getTime() < staleBefore
      );
    })
    .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))
    .slice(0, limit);

  return candidates.map((job) => {
    const claimed = {
      ...job,
      status: "running" as const,
      lockedAt: nowIso(),
      attempts: job.attempts + 1,
      updatedAt: nowIso(),
    };
    mockJobs.set(job.id, claimed);
    return claimed;
  });
}

async function completeGenerationJob(id: string) {
  if (!isSupabaseConfigured) {
    const job = mockJobs.get(id);
    if (job) {
      mockJobs.set(id, {
        ...job,
        status: "completed",
        lockedAt: null,
        updatedAt: nowIso(),
      });
    }
    return;
  }

  const { error } = await getAdminClient()
    .from("generation_jobs")
    .update({ status: "completed", locked_at: null, updated_at: nowIso() })
    .eq("id", id);
  if (error) throw new Error(`completeGenerationJob: ${error.message}`);
}

async function failGenerationJob(job: GenerationJob, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const terminal = job.attempts >= job.maxAttempts;
  const patch = terminal
    ? {
        status: "failed",
        locked_at: null,
        last_error: message,
        updated_at: nowIso(),
      }
    : {
        status: "pending",
        locked_at: null,
        last_error: message,
        next_run_at: backoffTime(job.attempts),
        updated_at: nowIso(),
      };

  if (!isSupabaseConfigured) {
    mockJobs.set(job.id, {
      ...job,
      status: patch.status as GenerationJobStatus,
      lockedAt: null,
      lastError: message,
      nextRunAt: "next_run_at" in patch ? patch.next_run_at : job.nextRunAt,
      updatedAt: nowIso(),
    });
  } else {
    const { error } = await getAdminClient()
      .from("generation_jobs")
      .update(patch)
      .eq("id", job.id);
    if (error) throw new Error(`failGenerationJob: ${error.message}`);
  }

  if (terminal) {
    await updateBook(
      job.bookId,
      { status: "failed", error: message },
      { admin: true },
    );
  }
}

function getAdminClient() {
  if (!isSupabaseAdminConfigured) {
    throw new Error("Supabase service role key is required for generation jobs");
  }
  return createSupabaseAdminClient()!;
}

function rowToJob(row: JobRow): GenerationJob {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    userId: String(row.user_id),
    type: row.type as GenerationJobType,
    pageIndex: row.page_index === null ? null : Number(row.page_index),
    status: row.status as GenerationJobStatus,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    nextRunAt: String(row.next_run_at),
    lockedAt: row.locked_at === null ? null : String(row.locked_at),
    lastError: row.last_error === null ? null : String(row.last_error),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function backoffTime(attempts: number): string {
  const minutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function nowIso() {
  return new Date().toISOString();
}
