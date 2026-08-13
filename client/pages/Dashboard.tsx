import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AppShell from "@/components/AppShell";
import {
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Plus,
  TrendingUp,
  Settings,
  GitBranch,
  MapPin,
} from "lucide-react";
import { useBektix } from "@/lib/bektix/context";
import { formatCompact, formatMoney } from "@/lib/bektix/format";
import { isSameDay, subDays } from "date-fns";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, shop, sales, products, branches } = useBektix();
  const isAdmin = user?.role === "admin";
  const currency = shop?.preferences.currency || "GH₵";

  const today = new Date();
  const yesterday = subDays(today, 1);

  const salesToday = sales.filter((s) => isSameDay(new Date(s.createdAt), today));
  const salesYesterday = sales.filter((s) => isSameDay(new Date(s.createdAt), yesterday));

  const totalSalesToday = salesToday.reduce((sum, s) => sum + s.total, 0);
  const totalSalesYesterday = salesYesterday.reduce((sum, s) => sum + s.total, 0);
  const salesDeltaPct =
    totalSalesYesterday > 0
      ? ((totalSalesToday - totalSalesYesterday) / totalSalesYesterday) * 100
      : totalSalesToday > 0
        ? 100
        : 0;

  const profitToday = salesToday.reduce((sum, s) => {
    const saleProfit = s.items.reduce(
      (pSum, li) => pSum + (li.unitPrice - li.unitCost) * li.quantity,
      0,
    );
    return sum + saleProfit;
  }, 0);

  const itemsSoldToday = salesToday.reduce(
    (sum, s) => sum + s.items.reduce((n, li) => n + li.quantity, 0),
    0,
  );

  const lowStockThreshold = shop?.preferences.lowStockThreshold ?? 10;
  const lowStockItems = products
    .filter((p) => p.quantity > 0 && p.quantity <= lowStockThreshold)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 5);
  const lowStockCount = products.filter(
    (p) => p.quantity > 0 && p.quantity <= lowStockThreshold,
  ).length;

  return (
    <AppShell
      title="Dashboard"
      description="Overview of your sales, stock, and quick actions."
      active="dashboard"
    >
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-1 sm:text-3xl">
            Welcome back{shop?.name ? `, ${shop.name}` : ""}!
          </h2>
          <p className="text-muted-foreground">Here's what's happening at BEKTIX today</p>
        </div>

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Sales Card */}
          <Card className="p-5 border border-border hover:shadow-lg transition-shadow sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground font-medium">Total Sales Today</p>
                <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
                  {formatCompact(totalSalesToday, currency)}
                </p>
                <p className="text-xs text-accent font-semibold mt-2">
                  {salesDeltaPct >= 0 ? "↑" : "↓"} {Math.abs(salesDeltaPct).toFixed(0)}% from yesterday
                </p>
              </div>
              <div className="shrink-0 bg-accent/10 p-3 rounded-lg">
                <DollarSign className="h-6 w-6 text-accent sm:h-8 sm:w-8" />
              </div>
            </div>
          </Card>

          {/* Total Profit Card */}
          {isAdmin && (
            <Card className="p-5 border border-border hover:shadow-lg transition-shadow sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground font-medium">Total Profit</p>
                  <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
                    {formatMoney(profitToday, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground font-semibold mt-2">Today</p>
                </div>
                <div className="shrink-0 bg-accent/10 p-3 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-accent sm:h-8 sm:w-8" />
                </div>
              </div>
            </Card>
          )}

          {/* Items Sold Card */}
          <Card className="p-5 border border-border hover:shadow-lg transition-shadow sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground font-medium">Items Sold</p>
                <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{itemsSoldToday}</p>
                <p className="text-xs text-muted-foreground font-semibold mt-2">
                  {salesToday.length} transactions
                </p>
              </div>
              <div className="shrink-0 bg-accent/10 p-3 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-accent sm:h-8 sm:w-8" />
              </div>
            </div>
          </Card>

          {/* Low Stock Items Card */}
          <Card className="p-5 border border-border hover:shadow-lg transition-shadow bg-orange-50 dark:bg-orange-950/10 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground font-medium">Low Stock Alerts</p>
                <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{lowStockCount}</p>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mt-2">Needs attention</p>
              </div>
              <div className="shrink-0 bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 sm:h-8 sm:w-8" />
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              onClick={() => navigate("/sales")}
              className="h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              New Sale
            </Button>
            <Button
              onClick={() => navigate("/inventory?new=1")}
              className="h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Product
            </Button>
            {isAdmin && (
              <>
                <Button
                  onClick={() => navigate("/reports")}
                  variant="outline"
                  className="h-12 font-semibold text-base"
                >
                  <TrendingUp className="h-5 w-5 mr-2" />
                  View Reports
                </Button>
                <Button
                  onClick={() => navigate("/settings")}
                  variant="outline"
                  className="h-12 font-semibold text-base"
                >
                  <Settings className="h-5 w-5 mr-2" />
                  Settings
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Sales */}
          <Card className="lg:col-span-2 border border-border">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Recent Sales</h3>
              <div className="space-y-4">
                {sales.slice(0, 6).map((sale) => (
                  <div
                    key={sale.id}
                    className="flex flex-col gap-3 p-4 rounded-lg bg-background border border-border hover:bg-muted transition-colors sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-accent/10 flex items-center justify-center">
                        <ShoppingCart className="h-5 w-5 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {sale.items.reduce((n, li) => n + li.quantity, 0)} items
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-foreground sm:text-right">
                      {formatMoney(sale.total, currency)}
                    </p>
                  </div>
                ))}
                {sales.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No sales yet. Start your first checkout in POS.
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Low Stock Items */}
          <Card className="border border-border">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Low Stock Items</h3>
              <div className="space-y-3">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg bg-background border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-foreground text-sm">{item.name}</p>
                      <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                        {item.quantity} left
                      </span>
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (item.quantity / lowStockThreshold) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Threshold: {lowStockThreshold} units
                    </p>
                  </div>
                ))}
                {lowStockItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No low-stock alerts right now.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {isAdmin && (
          <Card className="mt-6 border border-border">
            <div className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold"><GitBranch className="h-5 w-5 text-accent" />Business branches</h3>
                <p className="mt-1 text-sm text-muted-foreground">Branches created by BEKTIX are available here for your operational oversight.</p>
              </div>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">{branches.length} {branches.length === 1 ? "branch" : "branches"}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {branches.map((branch) => (
                <div key={branch.id} className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3"><p className="font-semibold">{branch.name}</p><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium capitalize text-emerald-700">{branch.status}</span></div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{branch.location || "Location not set"}</p>
                  <p className="mt-3 text-xs text-muted-foreground">Added {new Date(branch.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
              {branches.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No branches have been assigned to this business yet.</div>}
            </div>
          </Card>
        )}
      </AppShell>
  );
}
