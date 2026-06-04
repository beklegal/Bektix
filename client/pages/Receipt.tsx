import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

function BarcodeLikeStrip({ value }: { value: string }) {
  const source = value || "0";
  const bars = Array.from({ length: 74 }, (_, index) => {
    const code = source.charCodeAt(index % source.length) + index * 17;
    const width = code % 11 === 0 ? 5 : code % 5 === 0 ? 4 : code % 3 === 0 ? 3 : code % 2 === 0 ? 2 : 1;
    const height = code % 7 === 0 ? 72 : code % 4 === 0 ? 86 : 100;
    return { width, height };
  });

  return (
    <div className="bektix-receipt-barcode" aria-label={`Receipt barcode ${value}`}>
      {bars.map((bar, index) => (
        <span
          key={`${value}-${index}`}
          className="bektix-receipt-bar"
          style={{ width: `${bar.width}px`, height: `${bar.height}%` }}
        />
      ))}
    </div>
  );
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

  const receiptDate = new Date(sale.createdAt).toLocaleString();
  const cashierName = sale.cashierName || user?.email || "Cashier";
  const shopName = shop?.name || "Jilkem Company Limited";

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
          <article className="bektix-receipt">
            <header className="bektix-receipt-header">
              <section className="bektix-receipt-box bektix-receipt-details">
                <h2>Sale Receipt</h2>
                <dl>
                  <div>
                    <dt>Receipt Number</dt>
                    <dd>{sale.receiptNumber}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{receiptDate}</dd>
                  </div>
                  <div>
                    <dt>Cashier</dt>
                    <dd>{cashierName}</dd>
                  </div>
                  <div>
                    <dt>Payment Method</dt>
                    <dd>{paymentMethodLabel(sale.paymentMethod)}</dd>
                  </div>
                  <div>
                    <dt>Payer Type</dt>
                    <dd>{payerTypeLabel(sale.payerType)}</dd>
                  </div>
                </dl>
              </section>

              <section className="bektix-receipt-box bektix-receipt-brand">
                <img src="/Jilkem%20Logo.jpeg" alt="Jilkem Company Limited logo" />
                <div>
                  <h1>{shopName}</h1>
                  <p>Shop Management System</p>
                </div>
              </section>

              <section className="bektix-receipt-box bektix-receipt-tracking">
                <p className="bektix-receipt-label">Tracking / Receipt Number</p>
                <strong>{sale.receiptNumber}</strong>
                <BarcodeLikeStrip value={sale.receiptNumber} />
                <p className="bektix-receipt-note">Generated receipt reference</p>
              </section>
            </header>

            <main className="bektix-receipt-body">
              <section className="bektix-receipt-box bektix-receipt-items">
                <h2>Item Information</h2>
                <table className="bektix-receipt-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Unit Price</th>
                      <th>Qty</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item) => (
                      <tr key={item.productId}>
                        <td>{item.name}</td>
                        <td>{formatMoney(item.unitPrice, currency)}</td>
                        <td>{item.quantity}</td>
                        <td>{formatMoney(item.unitPrice * item.quantity, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <aside className="bektix-receipt-side">
                <section className="bektix-receipt-box bektix-receipt-summary">
                  <h2>Payment Summary</h2>
                  <dl>
                    <div>
                      <dt>Subtotal</dt>
                      <dd>{formatMoney(sale.subtotal, currency)}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{formatMoney(sale.total, currency)}</dd>
                    </div>
                    <div>
                      <dt>Paid</dt>
                      <dd>{formatMoney(sale.amountPaid, currency)}</dd>
                    </div>
                    <div>
                      <dt>Change</dt>
                      <dd>{formatMoney(sale.change, currency)}</dd>
                    </div>
                  </dl>
                </section>

                <section className="bektix-receipt-box bektix-receipt-signature">
                  <h2>Recipient Information</h2>
                  <div>
                    <span>Name:</span>
                  </div>
                  <div>
                    <span>Telephone:</span>
                  </div>
                  <div>
                    <span>Signature:</span>
                  </div>
                  <div>
                    <span>Date:</span>
                  </div>
                </section>
              </aside>
            </main>

            <footer className="bektix-receipt-footer">
              <p>{footer}</p>
              <span>
                Powered by{" "}
                <Link to="/dashboard" className="underline underline-offset-2">
                  Jilkem
                </Link>
              </span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
