import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

import { CategorySchema, type Category, type CategoryType } from "./schemas";

export interface NewCategoryInput {
  name: string;
  type: CategoryType;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateCategoryInput {
  id: string;
  patch: Partial<NewCategoryInput>;
}

const CATS_KEY = (userId: string | undefined) => ["categories", userId];

export function useCreateCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (input: NewCategoryInput) => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("categories")
        .insert({
          user_id: userId,
          name: input.name,
          type: input.type,
          color: input.color ?? null,
          icon: input.icon ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return CategorySchema.parse(data);
    },
    onSuccess: (cat) => {
      toast.success(`Added "${cat.name}"`);
    },
    onError: (err) => {
      toast.error("Couldn't create category", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: CATS_KEY(userId) });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async ({ id, patch }: UpdateCategoryInput) => {
      const { data, error } = await supabase
        .from("categories")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return CategorySchema.parse(data);
    },
    onMutate: async ({ id, patch }) => {
      const key = CATS_KEY(userId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Category[]>(key);
      qc.setQueryData<Category[]>(key, (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("Category updated");
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(CATS_KEY(userId), ctx.prev);
      }
      toast.error("Couldn't update category", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: CATS_KEY(userId) });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      const key = CATS_KEY(userId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Category[]>(key);
      qc.setQueryData<Category[]>(key, (old) =>
        (old ?? []).filter((c) => c.id !== id),
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("Category deleted");
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(CATS_KEY(userId), ctx.prev);
      }
      toast.error("Couldn't delete category", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: CATS_KEY(userId) });
    },
  });
}
