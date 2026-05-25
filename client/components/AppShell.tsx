import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Home,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  Menu,
  X,
  Grid3X3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBektix } from "@/lib/bektix/context";

type AppShellSection =
  | "dashboard"
  | "inventory"
  | "sales"
  | "reports"
  | "debtors"
  | "apps-services"
  | "users"
  | "settings";

interface AppShellProps {
  title: string;
  description?: string;
  active: AppShellSection;
  children: ReactNode;
}

const navigation = [
  { label: "Dashboard", path: "/dashboard", key: "dashboard", icon: Home },
  { label: "Inventory", path: "/inventory", key: "inventory", icon: Package },
  { label: "POS", path: "/sales", key: "sales", icon: ShoppingCart },
  { label: "Apps & Services", path: "/apps-services", key: "apps-services", icon: Grid3X3 },
  { label: "Settings", path: "/settings", key: "settings", icon: Settings },
];

export default function AppShell({ title, description, active, children }: AppShellProps) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, shop, actions } = useBektix();

  const roleLabel =
    user?.role === "admin"
      ? "Owner • Admin"
      : user?.role === "cashier"
        ? "Staff • Cashier"
        : "Staff";

  const allowedNav = navigation.filter((item) => {
    if (user?.role === "admin") return true;
    if (
      item.key === "users" ||
      item.key === "settings" ||
      item.key === "reports" ||
      item.key === "apps-services"
    ) return false;
    return true;
  });

  const logout = async () => {
    await actions.logout();
    setMobileOpen(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen min-w-0 bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between gap-2 py-2 sm:gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 sm:h-11 sm:w-11">
                <img
                  src="/Jilkem%20Logo.jpeg"
                  alt="Jilkem Company Limited logo"
                  className="h-8 w-8 object-contain sm:h-9 sm:w-9"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold sm:text-lg">Jilkem</p>
                <p className="text-xs text-primary-foreground/70 truncate max-w-[220px]">
                  {shop?.name ? `${shop.name} - Shop Management` : "Shop Management"}
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {allowedNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.key}
                    variant={item.key === active ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "gap-2 px-4",
                      item.key === active && "shadow-lg",
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right text-sm">
                <p className="font-medium truncate max-w-[180px]">{user?.name || user?.email || "User"}</p>
                <p className="text-xs text-primary-foreground/70">{roleLabel}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary/90"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <button
                className="md:hidden p-2"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div className="md:hidden pb-4 pt-4 space-y-2">
              {allowedNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.key}
                    variant={item.key === active ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate(item.path);
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {description && <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Button
              variant="secondary"
              className="h-11 px-3 sm:px-5"
              onClick={() => navigate("/sales")}
            >
              <ShoppingCart className="h-4 w-4" />
              New Sale
            </Button>
            <Button
              variant="outline"
              className="h-11 px-3 sm:px-5"
              onClick={() => navigate("/inventory?new=1")}
            >
              <Package className="h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
