import { z } from "zod";
import { observationSchema } from "./observation.js";
import { engramTimestampSchema } from "./timestamp.js";

const sessionFields = {
  id: z.string().min(1),
  project: z.string().min(1),
  started_at: engramTimestampSchema,
  updated_at: engramTimestampSchema.optional(),
  observation_count: z.number().int().nonnegative(),
};

function normalizeUpdatedAt<T extends { started_at: string; updated_at?: string }>(
  session: T,
): Omit<T, "updated_at"> & { updated_at: string } {
  return {
    ...session,
    updated_at: session.updated_at ?? session.started_at,
  };
}

export const sessionSchema = z.object(sessionFields).transform(normalizeUpdatedAt);

export const sessionWithObservationsSchema = z
  .object({
    ...sessionFields,
    observations: z.array(observationSchema),
  })
  .transform(normalizeUpdatedAt);

export type SessionSchema = z.infer<typeof sessionSchema>;
export type SessionWithObservationsSchema = z.infer<typeof sessionWithObservationsSchema>;
