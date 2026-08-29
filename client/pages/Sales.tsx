import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PayerType, PaymentMethod } from "@shared/bektix";
import AppShell from "@/components/AppShell";
import { useBektix } from "@/lib/bektix/context";
import { clampNumber, formatMoney } from "@/lib/bektix/format";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/bektix/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Banknote, DollarSign, Landmark, Minus, Plus, Search, ShoppingCart, Smartphone, Trash2 } from "lucide-react";

type CartLine = { productId: string; quantity: number };

export default function Sales() {
  const navigate = useNavigate();
  const { shop, products, user, actions } = useBektix();
  const currency = shop?.preferences.currency || "GH₵";

  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [payerType, setPayerType] = useState<PayerType>("walkIn");
  const [amountPaid, setAmountPaid] = useState("");
  const [printReceipt, setPrintReceipt] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [network, setNetwork] = useState<"mtn" | "atl" | "vod">("mtn");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

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
  const total = subtotal;

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
    setPayerType("walkIn");
    setAmountPaid(total.toFixed(2));
    setPrintReceipt(shop?.preferences.autoPrintReceipt ?? false);
    setPaymentId(null); setPaymentStatus(null); setPhoneNumber(""); setCustomerEmail("");
    setPaymentOpen(true);
  };

  const confirmPayment = async () => {
    if (paymentMethod === "mobileMoney") {
      if (!paymentId || paymentStatus !== "verified") { toast({ title: "Wait for verified payment", variant: "destructive" }); return; }
      try { const { saleId } = await api.completePayment(paymentId); setPaymentOpen(false); setCart([]); navigate(printReceipt ? `/receipt/${saleId}?autoprint=1` : `/receipt/${saleId}`); } catch (err) { toast({ title: "Could not complete sale", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" }); }
      return;
    }
    const paid = Number.parseFloat(amountPaid);
    if (!Number.isFinite(paid) || paid < total) {
      toast({ title: "Insufficient payment", variant: "destructive" });
      return;
    }

    try {
      const { saleId } = await actions.createSale({
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        paymentMethod,
        payerType,
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

  const requestMobileMoney = async () => {
    if (!phoneNumber.trim()) { toast({ title: "Customer mobile number is required", variant: "destructive" }); return; }
    setRequesting(true);
    try { const result = await api.requestMobileMoney({ items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })), phoneNumber, email: customerEmail.trim() || undefined, network, idempotencyKey: crypto.randomUUID() }); setPaymentId(result.id); setPaymentStatus(result.status); }
    catch (err) { toast({ title: "Payment request failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" }); } finally { setRequesting(false); }
  };
  useEffect(() => { if (!paymentId || !["pending", "requested"].includes(paymentStatus || "")) return; const timer = window.setInterval(async () => { try { const p = await api.getPayment(paymentId); setPaymentStatus(p.status); } catch { /* retry */ } }, 4000); return () => window.clearInterval(timer); }, [paymentId, paymentStatus]);

  const change = useMemo(() => {
    const paid = Number.parseFloat(amountPaid);
    if (!Number.isFinite(paid)) return null;
    return paid - total;
  }, [amountPaid, total]);

  return (
    <AppShell title="POS" description="Fast checkout optimized for real shop use." active="sales">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        {/* Products */}
        <div className="min-w-0">
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

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product.id)}
                className="min-h-32 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
              >
                <p className="font-semibold text-foreground">{product.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{product.category}</p>
                <div className="mt-4 flex items-end justify-between gap-3">
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
        <div className="min-w-0">
          <Card className="flex flex-col overflow-hidden lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)]">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Cart</h2>
              </div>
              <p className="text-sm text-muted-foreground">{cartDetailed.length} items</p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
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

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                <button
                  onClick={() => setPaymentMethod("cheque")}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${
                    paymentMethod === "cheque"
                      ? "border-accent bg-accent/10"
                      : "border-border bg-background hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Cheque</p>
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Bank cheque</p>
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-medium">Payer type</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { value: "private", label: "Private", detail: "Private client" },
                  { value: "government", label: "Government", detail: "Government payer" },
                  { value: "walkIn", label: "Walk-in", detail: "In-shop customer" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPayerType(option.value as PayerType)}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      payerType === option.value
                        ? "border-accent bg-accent/10"
                        : "border-border bg-background hover:border-accent/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{option.label}</p>
                      {option.value === "government" && <Landmark className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{option.detail}</p>
                  </button>
                ))}
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

            {paymentMethod === "mobileMoney" && (
              <Card className="grid gap-3 border-accent/30 bg-accent/5 p-4">
                <p className="font-semibold">Mobile Money</p>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} inputMode="tel" placeholder="024 XXX XXXX" disabled={!!paymentId} />
                <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} inputMode="email" placeholder="Customer email (optional)" disabled={!!paymentId} />
                <select value={network} onChange={(e) => setNetwork(e.target.value as typeof network)} disabled={!!paymentId} className="h-11 rounded-md border border-border bg-background px-3 text-sm"><option value="mtn">MTN Mobile Money</option><option value="atl">AT Money / AirtelTigo</option><option value="vod">Telecel Cash</option></select>
                {!paymentId ? <Button type="button" onClick={requestMobileMoney} disabled={requesting}>{requesting ? "Requesting payment..." : "Request payment"}</Button> : <div className="rounded-md bg-background p-3 text-sm"><p className="font-medium">{paymentStatus === "verified" ? "Payment successful — complete the sale." : paymentStatus === "expired" ? "Payment request expired." : "Payment prompt sent — waiting for customer approval..."}</p>{["pending", "requested"].includes(paymentStatus || "") && <Button className="mt-3" variant="outline" size="sm" onClick={async () => { await api.cancelPayment(paymentId); setPaymentStatus("cancelled"); }}>Cancel request</Button>}</div>}
              </Card>
            )}

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
              disabled={paymentMethod === "mobileMoney" && paymentStatus !== "verified"}
            >
              {paymentMethod === "mobileMoney" ? "Complete Sale" : "Confirm Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
