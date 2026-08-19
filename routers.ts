import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { getRunStatus, getSystemHealth, runBenchmark, startTextRun, startVoiceRun } from "./service";
import { latencyRegistry } from "./telemetry";

const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  rag: router({
    health: publicProcedure.query(() => getSystemHealth()),
    metrics: publicProcedure.query(() => latencyRegistry.metrics()),
    startQuery: publicProcedure
      .input(z.object({ question: z.string().trim().min(3).max(1_000) }))
      .mutation(({ input }) => startTextRun(input.question)),
    startVoice: publicProcedure
      .input(
        z.object({
          audioBase64: z.string().min(4).max(11_200_000),
          mimeType: z.string().min(3).max(120),
          languageCode: z.string().min(2).max(16).default("unknown"),
        }),
      )
      .mutation(({ input }) => startVoiceRun(input)),
    runStatus: publicProcedure
      .input(z.object({ runId: z.string().uuid() }))
      .query(({ input }) => getRunStatus(input.runId)),
    benchmark: publicProcedure.mutation(() => runBenchmark()),
  }),
});

export type AppRouter = typeof appRouter;
