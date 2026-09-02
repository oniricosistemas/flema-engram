import { z } from "zod";

export const localHealthResponseSchema = z.object({
  service: z.string().min(1),
  status: z.string().min(1),
  version: z.string().min(1),
});

export type LocalHealthResponse = z.infer<typeof localHealthResponseSchema>;
