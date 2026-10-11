import { z } from "zod";

export const oddTaskStatusSchema = z.enum(["pending", "in_progress", "blocked", "done", "cancelled"]);
export const oddTaskSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  title: z.string().min(1),
  status: oddTaskStatusSchema,
});
export const oddProvenanceSchema = z.object({
  observationId: z.number().int().positive(),
  topicKey: z.string(),
  project: z.string().min(1),
  // Preserve the source spelling (including SQLite timestamps).
  updatedAt: z.string(),
});
export const oddFeatureSchema = z.object({
  version: z.literal(1),
  featureId: z.string().min(1),
  title: z.string().min(1),
  tasks: z.array(oddTaskSchema).min(1),
  progress: z.object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    in_progress: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    done: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  }),
  provenance: oddProvenanceSchema,
});
export const oddDiagnosticSchema = z.object({
  code: z.enum(["invalid_topic", "invalid_timestamp", "invalid_heading", "invalid_tasks_section", "empty_tasks", "invalid_task", "checkbox_status_mismatch", "duplicate_task_id", "unclosed_fence"]),
  message: z.string(),
  line: z.number().int().positive().optional(),
  provenance: oddProvenanceSchema,
});
export const oddStateSchema = z.object({
  bounded: z.literal(true),
  features: z.array(oddFeatureSchema),
  diagnostics: z.array(oddDiagnosticSchema),
});

export type ODDTaskStatus = z.infer<typeof oddTaskStatusSchema>;
export type ODDTask = z.infer<typeof oddTaskSchema>;
export type ODDProvenance = z.infer<typeof oddProvenanceSchema>;
export type ODDFeature = z.infer<typeof oddFeatureSchema>;
export type ODDDiagnostic = z.infer<typeof oddDiagnosticSchema>;
export type ODDState = z.infer<typeof oddStateSchema>;
