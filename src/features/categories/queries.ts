import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";

import { CategorySchema, type Category } from "./schemas";

export function useCategories() {
  const { user } = useAuth();
  return useQuery<Category[]>({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return CategorySchema.array().parse(data);
    },
  });
}
