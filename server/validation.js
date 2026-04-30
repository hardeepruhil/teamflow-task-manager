import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120).transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(100),
  role: z.enum(["admin", "member"]).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().default("")
});

export const memberSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "member"]).default("member")
});

export const taskSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1000).optional().default(""),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assignee_id: z.coerce.number().int().positive().nullable().optional(),
  due_date: z.string().date().nullable().optional()
});

export const taskUpdateSchema = taskSchema.partial().extend({
  project_id: z.coerce.number().int().positive()
});

export function validate(schema, source = "body") {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed.",
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }
    req.validated = parsed.data;
    return next();
  };
}
