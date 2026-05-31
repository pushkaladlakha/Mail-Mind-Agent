import { Search, Settings, LogOut, User } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function AppTopbar() {
  const navigate = useNavigate();
  const { user, logOut, preferences } = useAuth();

  const handleLogout = async () => {
    try {
      await logOut();
      navigate({ to: "/connect" });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const username = user?.email ? user.email.split("@")[0] : "Student";
  const derivedName = username.charAt(0).toUpperCase() + username.slice(1);
  const displayName = preferences.displayName || derivedName;
  const displayEmail = user?.email || "student.24@iit.ac.in";

  // Calculate high-quality avatar initials (e.g. "Pushkal Adlakha" -> "PA")
  const nameParts = displayName.trim().split(/\s+/);
  const avatarInitials = nameParts.length > 1 && nameParts[0][0] && nameParts[1][0]
    ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
    : displayName.slice(0, 2).toUpperCase();

  return (
    <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-10 shrink-0">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search academic records..."
          className="w-full pl-10 pr-4 py-2 bg-muted border-none rounded-full text-sm focus:ring-2 focus:ring-accent/20 outline-none"
        />
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-success/10 text-success text-[10px] font-bold rounded-full uppercase tracking-wider">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          AI Agent Active
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="size-10 rounded-full bg-gradient-to-br from-accent to-academic text-white flex items-center justify-center font-bold text-sm shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {avatarInitials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/settings" })} className="cursor-pointer">
              <Settings className="size-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })} className="cursor-pointer">
              <User className="size-4" />
              <span>Dashboard</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="size-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
