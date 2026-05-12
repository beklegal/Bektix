import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PaymentMethod } from "@shared/bektix";
import AppShell from "@/components/AppShell";
import { useBektix } from "@/lib/bektix/context";
import { clampNumber, formatMoney } from "@/lib/bektix/format";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DollarSign, Minus, Plus, Search, ShoppingCart, Smartphone, Trash2 } from "lucide-react";

type CartLine = { productId: string; quantity: number };

export default function Sales() {
  const navigate = useNavigate();
  const { shop, products, user, actions } = useBektix();
  const currency = shop?.preferences.currency || "GH₵";
  const taxRate = shop?.preferences.taxRatePercent ?? 0;

  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [printReceipt, setPrintReceipt] = useState(false);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    const inStock = products.filter((p) => p.quantity > 0);
    if (!normalizedSearch) return inStock;
    return inStock.filter(
      (p) =>
        p.name.toLowerCase().includes(normalizedSearch) ||
        p.category.toLowerCase().includes(normalizedSearch),
    );
  }, [normalizedSearch, products]);

  const cartDetailed = useMemo(() => {
    return cart
      .map((line) => {
        const product = productById.get(line.productId);
        if (!product) return null;
        return { product, quantity: line.quantity, lineTotal: product.sellingPrice * line.quantity };
      })
      .filter(Boolean) as Array<{
      product: NonNullable<ReturnType<typeof productById.get>>;
      quantity: number;
      lineTotal: number;
    }>;
  }, [cart, productById]);

  const subtotal = useMemo(
    () => cartDetailed.reduce((sum, line) => sum + line.lineTotal, 0),
    [cartDetailed],
  );
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const addToCart = (productId: string) => {
    const product = productById.get(productId);
    if (!product) return;

    setCart((current) => {
      const existing = current.find((l) => l.productId === productId);
      const currentQty = existing?.quantity ?? 0;
      if (currentQty >= product.quantity) {
        toast({
          title: "Stock limit reached",
          description: `${product.name} has only ${product.quantity} in stock.`,
          variant: "destructive",
        });
        return current;
      }
      if (existing) {
        return current.map((l) =>
          l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((current) => current.filter((l) => l.productId !== productId));
  };

  const updateQuantity = (productId: string, nextQty: number) => {
    const product = productById.get(productId);
    if (!product) return;
    const clamped = clampNumber(nextQty, 0, product.quantity);
    if (clamped <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((current) => current.map((l) => (l.productId === productId ? { ...l, quantity: clamped } : l)));
  };

  const openPayment = () => {
    if (cart.length === 0) return;
    setPaymentMethod("cash");
    setAmountPaid(total.toFixed(2));
    setPrintReceipt(shop?.preferences.autoPrintReceipt ?? false);
    setPaymentOpen(true);
  };

  const confirmPayment = async () => {
    const paid = Number.parseFloat(amountPaid);
    if (!Number.isFinite(paid) || paid < total) {
      toast({ title: "Insufficient payment", variant: "destructive" });
      return;
    }

    try {
      const { saleId } = await actions.createSale({
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        paymentMethod,
        amountPaid: paid,
      });
      setPaymentOpen(false);
      setCart([]);
      setAmountPaid("");
      navigate(printReceipt ? `/receipt/${saleId}?autoprint=1` : `/receipt/${saleId}`);
    } catch (err) {
      toast({
        title: "Sale failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const change = useMemo(() => {
    const paid = Number.parseFloat(amountPaid);
    if (!Number.isFinite(paid)) return null;
    return paid - total;
  }, [amountPaid, total]);

  return (
    <AppShell title="POS" description="Fast checkout optimized for real shop use." active="sales">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Products */}
        <div className="lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Products</h2>
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="h-11 pl-10"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product.id)}
                className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
              >
                <p className="font-semibold text-foreground">{product.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{product.category}</p>
                <div className="mt-4 flex items-end justify-between">
                  <p className="text-lg font-bold text-accent">{formatMoney(product.sellingPrice, currency)}</p>
                  <p className="text-xs text-muted-foreground">{product.quantity} left</p>
                </div>
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <Card className="mt-6 p-8 text-center">
              <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No in-stock products match your search.</p>
              <Button className="mt-4" variant="outline" onClick={() => navigate("/inventory?new=1")}>
                Add products in Inventory
              </Button>
            </Card>
          )}
        </div>

        {/* Cart */}
        <div className="lg:col-span-1">
          <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Cart</h2>
              </div>
              <p className="text-sm text-muted-foreground">{cartDetailed.length} items</p>
            </div>

            <div className="flex-1 space-y-3 p-4">
              {cartDetailed.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Tap products to add to cart.</p>
                </div>
              ) : (
                cartDetailed.map(({ product, quantity, lineTotal }) => (
                  <div key={product.id} className="rounded-xl border border-border bg-muted p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(product.sellingPrice, currency)} each
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => removeFromCart(product.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm font-semibold text-accent">{formatMoney(lineTotal, currency)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartDetailed.length > 0 && (
              <div className="border-t border-border p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">{formatMoney(subtotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                    <span className="font-semibold">{formatMoney(tax, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="text-base font-bold">Total</span>
                    <span className="text-2xl font-bold text-accent">{formatMoney(total, currency)}</span>
                  </div>
                </div>

                <Button
                  onClick={openPayment}
                  className="mt-4 h-12 w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base"
                >
                  <DollarSign className="mr-2 h-5 w-5" />
                  Pay & Complete Sale
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment</DialogTitle>
            <DialogDescription>
              Cashier: {user?.name || user?.email || "User"} • Amount due: {formatMoney(total, currency)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total due</p>
              <p className="mt-2 text-3xl font-bold">{formatMoney(total, currency)}</p>
            </Card>

            <div className="grid gap-2">
              <p className="text-sm font-medium">Payment method</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${
                    paymentMethod === "cash"
                      ? "border-accent bg-accent/10"
                      : "border-border bg-background hover:border-accent/40"
                  }`}
                >
                  <p className="font-semibold">Cash</p>
                  <p className="text-xs text-muted-foreground">Notes & coins</p>
                </button>
                <button
                  onClick={() => setPaymentMethod("mobileMoney")}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${
                    paymentMethod === "mobileMoney"
                      ? "border-accent bg-accent/10"
                      : "border-border bg-background hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Mobile Money</p>
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">MOMO / transfer</p>
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Amount paid</label>
              <Input
                inputMode="decimal"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="h-11"
              />
              {change !== null && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Change</span>
                  <span className={change >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                    {formatMoney(change, currency)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
              <div>
                <p className="text-sm font-medium">Print receipt</p>
                <p className="text-xs text-muted-foreground">Open print dialog after checkout</p>
              </div>
              <Switch checked={printReceipt} onCheckedChange={setPrintReceipt} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)} className="h-11">
              Cancel
            </Button>
            <Button
              onClick={confirmPayment}
              className="h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
            >
              Confirm Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
