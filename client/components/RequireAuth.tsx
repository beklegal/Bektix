import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useBektix } from "@/lib/bektix/context";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { authStatus, session } = useBektix();
  const location = useLocation();

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
