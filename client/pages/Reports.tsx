import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useBektix } from "@/lib/bektix/context";
import { formatCompact, formatMoney } from "@/lib/bektix/format";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { format, isSameMonth, startOfMonth, subDays, subMonths } from "date-fns";
import { DollarSign, ShoppingCart, TrendingUp } from "lucide-react";

function saleProfit(sale: { items: Array<{ unitPrice: number; unitCost: number; quantity: number }> }) {
  return sale.items.reduce((sum, li) => sum + (li.unitPrice - li.unitCost) * li.quantity, 0);
}

export default function Reports() {
  const { shop, sales } = useBektix();
  const currency = shop?.preferences.currency || "GH₵";

  const thisMonthSales = useMemo(() => {
    const now = new Date();
    return sales.filter((s) => isSameMonth(new Date(s.createdAt), now));
  }, [sales]);

  const totals = useMemo(() => {
    const totalSales = thisMonthSales.reduce((sum, s) => sum + s.total, 0);
    const profit = thisMonthSales.reduce((sum, s) => sum + saleProfit(s), 0);
    const tx = thisMonthSales.length;
    const avg = tx > 0 ? totalSales / tx : 0;
    return { totalSales, profit, tx, avg };
  }, [thisMonthSales]);

  const dailyData = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
    return days.map((day) => {
      const daySales = sales.filter((s) => {
        const d = new Date(s.createdAt);
        return d.toDateString() === day.toDateString();
      });
      const salesTotal = daySales.reduce((sum, s) => sum + s.total, 0);
      const profitTotal = daySales.reduce((sum, s) => sum + saleProfit(s), 0);
      return {
        name: format(day, "EEE"),
        sales: Number(salesTotal.toFixed(2)),
        profit: Number(profitTotal.toFixed(2)),
      };
    });
  }, [sales]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => subMonths(startOfMonth(now), 5 - i));
    return months.map((month) => {
      const monthSales = sales.filter((s) => isSameMonth(new Date(s.createdAt), month));
      const salesTotal = monthSales.reduce((sum, s) => sum + s.total, 0);
      const profitTotal = monthSales.reduce((sum, s) => sum + saleProfit(s), 0);
      return {
        name: format(month, "MMM"),
        sales: Number(salesTotal.toFixed(2)),
        profit: Number(profitTotal.toFixed(2)),
      };
    });
  }, [sales]);

  const bestSelling = useMemo(() => {
    const byProduct = new Map<string, { id: string; name: string; units: number; revenue: number }>();
    for (const sale of thisMonthSales) {
      for (const item of sale.items) {
        const key = item.productId;
        const current = byProduct.get(key) ?? { id: key, name: item.name, units: 0, revenue: 0 };
        current.units += item.quantity;
        current.revenue += item.unitPrice * item.quantity;
        byProduct.set(key, current);
      }
    }
    return Array.from(byProduct.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 7);
  }, [thisMonthSales]);

  return (
    <AppShell
      title="Reports"
      description="Analytics for sales, profit, and best-selling products."
      active="reports"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Sales (this month)</p>
              <p className="mt-2 text-2xl font-semibold">{formatCompact(totals.totalSales, currency)}</p>
            </div>
            <div className="rounded-2xl bg-accent/10 p-3">
              <DollarSign className="h-6 w-6 text-accent" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Profit (this month)</p>
              <p className="mt-2 text-2xl font-semibold">{formatCompact(totals.profit, currency)}</p>
            </div>
            <div className="rounded-2xl bg-accent/10 p-3">
              <TrendingUp className="h-6 w-6 text-accent" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="mt-2 text-2xl font-semibold">{totals.tx}</p>
            </div>
            <div className="rounded-2xl bg-accent/10 p-3">
              <ShoppingCart className="h-6 w-6 text-accent" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Avg. transaction</p>
              <p className="mt-2 text-2xl font-semibold">{formatMoney(totals.avg, currency)}</p>
            </div>
            <div className="rounded-2xl bg-accent/10 p-3">
              <Badge variant="secondary">Month</Badge>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <p className="text-lg font-semibold">Daily sales (last 7 days)</p>
          <p className="mt-1 text-sm text-muted-foreground">Sales total per day.</p>

          <div className="mt-6 h-[260px]">
            <ChartContainer
              config={{
                sales: { label: "Sales", color: "hsl(var(--accent))" },
                profit: { label: "Profit", color: "hsl(var(--primary))" },
              }}
              className="h-full"
            >
              <BarChart data={dailyData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="sales" fill="var(--color-sales)" radius={6} />
              </BarChart>
            </ChartContainer>
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-lg font-semibold">Monthly sales (last 6 months)</p>
          <p className="mt-1 text-sm text-muted-foreground">Total sales per month.</p>

          <div className="mt-6 h-[260px]">
            <ChartContainer
              config={{
                sales: { label: "Sales", color: "hsl(var(--accent))" },
              }}
              className="h-full"
            >
              <BarChart data={monthlyData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="sales" fill="var(--color-sales)" radius={6} />
              </BarChart>
            </ChartContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="p-6">
          <p className="text-lg font-semibold">Best-selling products (this month)</p>
          <p className="mt-1 text-sm text-muted-foreground">Top products by units sold.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="border-b border-border">
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-6 py-4 text-right font-medium text-muted-foreground">Units</th>
                <th className="px-6 py-4 text-right font-medium text-muted-foreground">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {bestSelling.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="px-6 py-4 font-medium">{p.name}</td>
                  <td className="px-6 py-4 text-right font-semibold">{p.units}</td>
                  <td className="px-6 py-4 text-right font-semibold text-accent">
                    {formatMoney(p.revenue, currency)}
                  </td>
                </tr>
              ))}

              {bestSelling.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-muted-foreground">
                    No sales yet this month. Complete a sale in POS to see analytics.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
