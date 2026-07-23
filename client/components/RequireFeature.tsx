import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { TenantFeature } from "@shared/bektix";
import { useBektix } from "@/lib/bektix/context";

export default function RequireFeature({ feature, children }: { feature: TenantFeature; children: ReactNode }) {
  const { authStatus, shop, user } = useBektix();

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user?.role === "super_admin") return <Navigate to="/super-admin" replace />;
  if (!shop?.features[feature]) return <Navigate to="/dashboard" replace />;

  return children;
}
