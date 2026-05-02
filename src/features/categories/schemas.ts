import { z } from "zod";

export const CATEGORY_TYPES = ["expense", "earning", "investment"] as const;

export const CategorySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  type: z.enum(CATEGORY_TYPES),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Category = z.infer<typeof CategorySchema>;
export type CategoryType = (typeof CATEGORY_TYPES)[number];
