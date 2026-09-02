import { z } from "zod";
import { engramTimestampSchema } from "./timestamp.js";

export const observationSchema = z.object({
  id: z.number().int().positive(),
  type: z.string().min(1),
  title: z.string().min(1),
  topic_key: z.string().default(""),
  content: z.string(),
  project: z.string().min(1),
  scope: z.enum(["project", "personal"]),
  updated_at: engramTimestampSchema,
  created_at: engramTimestampSchema,
});

export type ObservationSchema = z.infer<typeof observationSchema>;
