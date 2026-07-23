import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useBektix } from "@/lib/bektix/context";

export default function RequireTenant({ children }: { children: ReactNode }) {
  const { authStatus, user } = useBektix();

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user?.role === "super_admin") {
    return <Navigate to="/super-admin" replace />;
  }

  return children;
}
