import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().min(1),
  observationCount: z.number().int().nonnegative(),
  lastActiveAt: z.string().datetime(),
  scopes: z.array(z.enum(["project", "personal"])),
});

export type ProjectSchema = z.infer<typeof projectSchema>;
