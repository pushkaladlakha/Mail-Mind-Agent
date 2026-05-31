import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopbar } from "@/components/AppTopbar";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/connect" });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground relative overflow-hidden">
        {/* Background Ambient Blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-40 -left-40 w-[35rem] h-[35rem] rounded-full bg-academic/5 blur-[120px] animate-blob-1" />
          <div className="absolute top-[20%] -right-40 w-[40rem] h-[40rem] rounded-full bg-accent/5 blur-[130px] animate-blob-2" />
        </div>
        <div className="flex flex-col items-center gap-4 z-10 text-center px-4">
          <div className="size-14 bg-academic text-white rounded-2xl flex items-center justify-center font-bold shadow-lg shadow-academic/10 mb-2 animate-pulse">
            M
          </div>
          <Loader2 className="size-6 animate-spin text-accent" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold tracking-tight text-foreground">Synchronizing Workspace</h4>
            <p className="text-[10px] font-semibold text-muted-foreground">Securing webmail TLS sockets…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AppTopbar />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
