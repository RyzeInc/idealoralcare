/**
 * Icon lookup for the navigation model.
 *
 * src/lib/admin-nav.ts names its icons as strings so it stays plain,
 * import-free data — checkable by tests and readable by the doc generator
 * under bare Node. This module is where those names become components.
 *
 * An unknown name falls back to Circle rather than crashing the whole shell:
 * a typo should cost you an icon, not the sidebar.
 */

import {
  BarChart3,
  Building,
  Building2,
  BookOpen,
  BookUser,
  Calculator,
  Circle,
  ClipboardList,
  Contact,
  DollarSign,
  FileCheck2,
  FileOutput,
  FileText,
  Filter,
  FolderOpen,
  Headphones,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Library,
  LineChart,
  Mail,
  Network,
  Receipt,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Terminal,
  Upload,
  User,
  UserPlus,
  UserSearch,
  Users,
  Zap,
} from "lucide-react";

export type NavIcon = typeof LayoutDashboard;

const ICONS: Record<string, NavIcon> = {
  BarChart3,
  Building,
  Building2,
  BookOpen,
  BookUser,
  Calculator,
  ClipboardList,
  Contact,
  DollarSign,
  FileCheck2,
  FileOutput,
  FileText,
  Filter,
  FolderOpen,
  Headphones,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Library,
  LineChart,
  Mail,
  Network,
  Receipt,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Terminal,
  Upload,
  User,
  UserPlus,
  UserSearch,
  Users,
  Zap,
};

export function navIcon(name: string): NavIcon {
  return ICONS[name] ?? Circle;
}

/** Names the model is allowed to use — asserted by the nav test. */
export const KNOWN_ICON_NAMES = Object.keys(ICONS);
