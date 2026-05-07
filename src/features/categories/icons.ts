import {
  BookOpen,
  Bolt,
  Briefcase,
  Car,
  Coffee,
  CreditCard,
  Dog,
  DollarSign,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  Heart,
  Home,
  Music,
  Phone,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated subset of Lucide icons for categories. The DB stores the icon as a
 * string (the key here); UI looks it up via `iconFromName`. Pre-2024 seed
 * names like "Bolt"/"TrendingUp" are already present.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Tag,
  ShoppingBag,
  ShoppingCart,
  Coffee,
  Utensils,
  Home,
  Car,
  Plane,
  Bolt,
  Wifi,
  Phone,
  TrendingUp,
  PiggyBank,
  DollarSign,
  Briefcase,
  Sparkles,
  Wallet,
  CreditCard,
  Receipt,
  Heart,
  Dumbbell,
  Pill,
  BookOpen,
  Film,
  Music,
  Gamepad2,
  Gift,
  Dog,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export const DEFAULT_ICON = "Tag";

export function iconFromName(name: string | null | undefined): LucideIcon {
  if (!name) return CATEGORY_ICONS[DEFAULT_ICON]!;
  return CATEGORY_ICONS[name] ?? CATEGORY_ICONS[DEFAULT_ICON]!;
}
