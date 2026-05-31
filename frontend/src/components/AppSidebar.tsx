import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Star,
  Inbox,
  CalendarDays,
  Archive,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, dot: "bg-accent" },
  { to: "/important", label: "Important", icon: Star, dot: "bg-success" },
  { to: "/low-priority", label: "Low Priority", icon: Inbox, dot: "bg-low" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, dot: "border border-low bg-transparent" },
  { to: "/archive", label: "Archive", icon: Archive, dot: "bg-warning" },
  { to: "/settings", label: "Settings", icon: Settings, dot: "bg-muted-foreground" },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const displayEmail = user?.email || "student.24@iit.ac.in";

  return (
    <aside className="w-64 border-r border-border bg-surface flex-col hidden md:flex shrink-0">
      <div className="p-6">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="size-8 bg-accent rounded-lg flex items-center justify-center text-accent-foreground font-bold">
            M
          </div>
          <h1 className="font-bold text-lg tracking-tight">Mail Mind</h1>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-low hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <span className={cn("size-2 rounded-full shrink-0", item.dot)} />
              <item.icon className="size-4 shrink-0 opacity-70" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="bg-academic rounded-xl p-4 text-white">
          <p className="text-xs text-white/60 mb-1">Account sync</p>
          <p className="text-sm font-medium truncate">{displayEmail}</p>
        </div>
      </div>
    </aside>
  );
}
