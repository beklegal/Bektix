import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useBektix } from "@/lib/bektix/context";
import { formatMoney } from "@/lib/bektix/format";
import { api } from "@/lib/bektix/api";
import { Printer, ArrowLeft } from "lucide-react";

function paymentMethodLabel(method: string) {
  if (method === "cash") return "Cash";
  if (method === "mobileMoney") return "Mobile Money";
  if (method === "cheque") return "Cheque";
  return method;
}

function payerTypeLabel(type: string) {
  if (type === "private") return "Private";
  if (type === "government") return "Government";
  if (type === "walkIn") return "Walk-in";
  return type;
}

export default function Receipt() {
  const navigate = useNavigate();
  const { saleId } = useParams();
  const [searchParams] = useSearchParams();
  const { shop, user } = useBektix();

  const saleQuery = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => api.getSale(saleId!),
    enabled: Boolean(saleId),
    retry: false,
  });

  const sale = saleQuery.data ?? null;
  const currency = shop?.preferences.currency || "GH₵";
  const footer = shop?.preferences.receiptFooterMessage || "Thank you for shopping!";

  useEffect(() => {
    if (!sale) return;
    document.title = `Receipt ${sale.receiptNumber} - Jilkem`;
  }, [sale]);

  useEffect(() => {
    if (!sale) return;
    const shouldAutoPrint = searchParams.get("autoprint") === "1";
    if (!shouldAutoPrint) return;

    const t = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(t);
  }, [sale, searchParams]);

  if (saleQuery.isPending) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-xl">
          <Card className="p-6">
            <p className="text-lg font-semibold">Loading receipt…</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-xl">
          <Card className="p-6">
            <p className="text-lg font-semibold">Receipt not found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This receipt may have been deleted or is no longer available.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => navigate("/sales")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to POS
              </Button>
              <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bektix-receipt-page min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[1180px]">
        <div className="bektix-print-hidden mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={() => navigate("/sales")} className="h-11">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to POS
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.print()} className="h-11">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button
              onClick={() => navigate("/sales")}
              className="h-11 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              New Sale
            </Button>
          </div>
        </div>

        <div className="bektix-receipt-shell flex justify-center">
          <Card className="bektix-receipt flex w-full flex-col p-8">
            <div className="text-center space-y-2">
              <img src="/Jilkem%20Logo.jpeg" alt="Jilkem Company Limited logo" className="mx-auto h-14 w-auto object-contain" />
              <div>
                <p className="text-2xl font-bold">{shop?.name || "Jilkem Company Limited"}</p>
                <p className="text-sm text-muted-foreground">Shop Management System</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid gap-4 text-sm md:grid-cols-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receipt</span>
                <span className="font-semibold">{sale.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-semibold">{new Date(sale.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cashier</span>
                <span className="font-semibold">{sale.cashierName || user?.email || "Cashier"}</span>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="bektix-receipt-items flex-1 text-sm">
              <div className="flex justify-between border-b border-border pb-2 font-semibold">
                <span className="w-[55%]">Item</span>
                <span className="w-[15%] text-right">Qty</span>
                <span className="w-[30%] text-right">Total</span>
              </div>
              <div className="mt-2 space-y-2">
                {sale.items.map((item) => (
                  <div key={item.productId} className="flex justify-between">
                    <div className="w-[55%] pr-2">
                      <p className="font-medium leading-4">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatMoney(item.unitPrice, currency)} each</p>
                    </div>
                    <div className="w-[15%] text-right font-semibold">{item.quantity}</div>
                    <div className="w-[30%] text-right font-semibold">
                      {formatMoney(item.unitPrice * item.quantity, currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="my-4" />

            <div className="bektix-receipt-summary grid gap-6 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">{formatMoney(sale.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between pt-2 text-xl font-bold">
                  <span>Total</span>
                  <span>{formatMoney(sale.total, currency)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-semibold">{formatMoney(sale.amountPaid, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Change</span>
                  <span className="font-semibold">{formatMoney(sale.change, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-semibold">{paymentMethodLabel(sale.paymentMethod)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payer</span>
                  <span className="font-semibold">{payerTypeLabel(sale.payerType)}</span>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <p className="text-center text-xs text-muted-foreground">{footer}</p>
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              Powered by{" "}
              <Link to="/dashboard" className="underline underline-offset-2">
                Jilkem
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
