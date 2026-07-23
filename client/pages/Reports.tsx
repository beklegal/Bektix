import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PaymentMethod, Product, Sale } from "@shared/bektix";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBektix } from "@/lib/bektix/context";
import { formatCompact, formatMoney } from "@/lib/bektix/format";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { format, isSameMonth, startOfMonth, subDays, subMonths } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Package,
  Printer,
  Search,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

function saleProfit(sale: { items: Array<{ unitPrice: number; unitCost: number; quantity: number }> }) {
  return sale.items.reduce((sum, li) => sum + (li.unitPrice - li.unitCost) * li.quantity, 0);
}

function paymentMethodLabel(method: PaymentMethod | "all") {
  if (method === "all") return "All payment methods";
  if (method === "cash") return "Cash";
  if (method === "mobileMoney") return "Mobile Money";
  if (method === "cheque") return "Cheque";
  return method;
}

function stockStatus(product: Product, lowStockThreshold: number) {
  if (product.quantity <= 0) return "out";
  if (product.quantity <= lowStockThreshold) return "low";
  return "in";
}

function StockBadge({ product, lowStockThreshold }: { product: Product; lowStockThreshold: number }) {
  const status = stockStatus(product, lowStockThreshold);
  if (status === "out") {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Out</Badge>;
  }
  if (status === "low") {
    return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Low</Badge>;
  }
  return <Badge variant="secondary">In stock</Badge>;
}

export default function Reports() {
  const navigate = useNavigate();
  const { shop, user, sales, products } = useBektix();
  const currency = shop?.preferences.currency || "GHS";
  const lowStockThreshold = shop?.preferences.lowStockThreshold ?? 10;
  const isAdmin = user?.role === "admin";

  const [saleSearch, setSaleSearch] = useState("");
  const [saleDateFrom, setSaleDateFrom] = useState("");
  const [saleDateTo, setSaleDateTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "all">("all");
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

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

  const filteredSales = useMemo(() => {
    const search = saleSearch.trim().toLowerCase();
    return sales.filter((sale) => {
      const saleDate = sale.createdAt.slice(0, 10);
      if (saleDateFrom && saleDate < saleDateFrom) return false;
      if (saleDateTo && saleDate > saleDateTo) return false;
      if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) return false;
      if (!search) return true;
      return (
        sale.receiptNumber.toLowerCase().includes(search) ||
        sale.cashierName.toLowerCase().includes(search) ||
        sale.items.some((item) => item.name.toLowerCase().includes(search))
      );
    });
  }, [paymentFilter, saleDateFrom, saleDateTo, saleSearch, sales]);

  const stockStats = useMemo(() => {
    const units = products.reduce((sum, product) => sum + product.quantity, 0);
    const low = products.filter((product) => stockStatus(product, lowStockThreshold) === "low").length;
    const out = products.filter((product) => stockStatus(product, lowStockThreshold) === "out").length;
    return { total: products.length, units, low, out };
  }, [lowStockThreshold, products]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const printStockReport = () => {
    document.body.classList.add("bektix-stock-print-mode");
    const cleanup = () => {
      document.body.classList.remove("bektix-stock-print-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 500);
  };

  const printReceipt = (sale: Sale) => {
    navigate(`/receipt/${sale.id}?autoprint=1`);
  };

  return (
    <AppShell
      title="Reports"
      description="Analytics for sales, profit, stock, and best-selling products."
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

      {isAdmin && (
        <>
          <Card className="bektix-stock-report mt-6 overflow-hidden">
            <div className="bektix-stock-print-header flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-lg font-semibold">Available stock</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Printable stock report for {shop?.name || "this shop"}.
                </p>
              </div>
              <Button variant="outline" onClick={printStockReport} className="bektix-print-hidden h-11">
                <Printer className="mr-2 h-4 w-4" />
                Print Stock
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 px-6 pb-6 lg:grid-cols-4">
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Products</p>
                <p className="mt-1 text-xl font-semibold">{stockStats.total}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Stock units</p>
                <p className="mt-1 text-xl font-semibold">{stockStats.units}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Low stock</p>
                <p className="mt-1 text-xl font-semibold">{stockStats.low}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">Out of stock</p>
                <p className="mt-1 text-xl font-semibold">{stockStats.out}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground">{product.category}</TableCell>
                      <TableCell className="text-right font-semibold">{product.quantity}</TableCell>
                      <TableCell className="text-right">{formatMoney(product.costPrice, currency)}</TableCell>
                      <TableCell className="text-right">{formatMoney(product.sellingPrice, currency)}</TableCell>
                      <TableCell>
                        <StockBadge product={product} lowStockThreshold={lowStockThreshold} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No products available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="mt-6 overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-lg font-semibold">Previous sales and sold items</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review older receipts, inspect sold items, and reprint receipts.
                  </p>
                </div>
                <Badge variant="secondary">{filteredSales.length} receipts</Badge>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_190px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    value={saleSearch}
                    onChange={(e) => setSaleSearch(e.target.value)}
                    placeholder="Search receipt, cashier, or item..."
                    className="h-11 pl-10"
                  />
                </div>
                <Input
                  type="date"
                  value={saleDateFrom}
                  onChange={(e) => setSaleDateFrom(e.target.value)}
                  className="h-11"
                />
                <Input
                  type="date"
                  value={saleDateTo}
                  onChange={(e) => setSaleDateTo(e.target.value)}
                  className="h-11"
                />
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as PaymentMethod | "all")}
                  className="h-11 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="all">{paymentMethodLabel("all")}</option>
                  <option value="cash">Cash</option>
                  <option value="mobileMoney">Mobile Money</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => {
                    const expanded = expandedSaleId === sale.id;
                    const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0);
                    return (
                      <>
                        <TableRow key={sale.id}>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => setExpandedSaleId(expanded ? null : sale.id)}
                              className="flex items-center gap-2 font-medium text-foreground"
                            >
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {sale.receiptNumber}
                            </button>
                          </TableCell>
                          <TableCell>{new Date(sale.createdAt).toLocaleString()}</TableCell>
                          <TableCell>{sale.cashierName}</TableCell>
                          <TableCell className="text-right font-semibold">{itemCount}</TableCell>
                          <TableCell>{paymentMethodLabel(sale.paymentMethod)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatMoney(sale.total, currency)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => printReceipt(sale)}>
                              <Printer className="mr-2 h-4 w-4" />
                              Print
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow key={`${sale.id}-items`}>
                            <TableCell colSpan={7} className="bg-muted/40 p-0">
                              <div className="p-4">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Sold item</TableHead>
                                      <TableHead className="text-right">Qty</TableHead>
                                      <TableHead className="text-right">Unit price</TableHead>
                                      <TableHead className="text-right">Line total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sale.items.map((item, index) => (
                                      <TableRow key={`${sale.id}-${item.productId}-${index}`}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{formatMoney(item.unitPrice, currency)}</TableCell>
                                        <TableCell className="text-right font-semibold">
                                          {formatMoney(item.unitPrice * item.quantity, currency)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  {filteredSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        No sales match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

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
