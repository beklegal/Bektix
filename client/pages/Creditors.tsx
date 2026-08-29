import { useMemo, useState } from "react";
import type { PurchaseInvoice, PurchaseLineItem } from "@shared/bektix";
import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { useBektix } from "@/lib/bektix/context";
import { formatMoney } from "@/lib/bektix/format";
import { ClipboardList, Plus, Search, Trash2, Truck } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

type SupplierDraft = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
};

type PurchaseDraft = {
  supplierId: string;
  date: string;
  expectedDate: string;
  dueDate: string;
  invoiceNumber: string;
  purchaseOrderId: string;
  lines: PurchaseLineDraft[];
};

type PaymentDraft = {
  purchaseInvoiceId: string;
  paymentDate: string;
  amount: string;
  paymentMethod: "cash" | "cheque";
  reference: string;
};

type PurchaseLineDraft = {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
};

function newPurchaseLine(): PurchaseLineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productId: "",
    quantity: "1",
    unitCost: "0",
  };
}

const emptySupplier: SupplierDraft = { name: "", contactName: "", phone: "", email: "" };
function emptyPurchase(): PurchaseDraft {
  return {
    supplierId: "",
    date: today,
    expectedDate: "",
    dueDate: "",
    invoiceNumber: "",
    purchaseOrderId: "",
    lines: [newPurchaseLine()],
  };
}
const emptyPayment: PaymentDraft = {
  purchaseInvoiceId: "",
  paymentDate: today,
  amount: "0",
  paymentMethod: "cash",
  reference: "",
};

function invoiceBadge(status: PurchaseInvoice["status"]) {
  if (status === "paid") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>;
  if (status === "part_paid") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Part paid</Badge>;
  return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Unpaid</Badge>;
}

export default function Creditors() {
  const {
    shop,
    products,
    suppliers,
    purchaseOrders,
    purchaseInvoices,
    supplierPayments,
    actions,
  } = useBektix();
  const currency = shop?.preferences.currency || "GHS";
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>(emptySupplier);
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft>(() => emptyPurchase());
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPayment);

  const filteredInvoices = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return purchaseInvoices;
    return purchaseInvoices.filter(
      (invoice) =>
        invoice.supplierName.toLowerCase().includes(search) ||
        invoice.invoiceNumber.toLowerCase().includes(search),
    );
  }, [purchaseInvoices, searchTerm]);

  const metrics = useMemo(() => {
    const unpaid = purchaseInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);
    const paid = supplierPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const ordered = purchaseOrders.filter((order) => order.status === "ordered").length;
    return { unpaid, paid, ordered };
  }, [purchaseInvoices, purchaseOrders, supplierPayments]);

  const buildLines = (): PurchaseLineItem[] | null => {
    const lines = purchaseDraft.lines.map((line) => {
      const product = products.find((item) => item.id === line.productId);
      const quantity = Number.parseInt(line.quantity, 10);
      const unitCost = Number.parseFloat(line.unitCost);
      if (!product || !Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(unitCost) || unitCost < 0) {
        return null;
      }
      return { productId: product.id, productName: product.name, quantity, unitCost };
    });

    if (lines.length === 0 || lines.some((line) => line === null)) return null;
    return lines as PurchaseLineItem[];
  };

  const purchaseDraftTotal = useMemo(() => {
    return purchaseDraft.lines.reduce((sum, line) => {
      const quantity = Number.parseInt(line.quantity, 10);
      const unitCost = Number.parseFloat(line.unitCost);
      if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) return sum;
      return sum + quantity * unitCost;
    }, 0);
  }, [purchaseDraft.lines]);

  const updatePurchaseLine = (lineId: string, patch: Partial<PurchaseLineDraft>) => {
    setPurchaseDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    }));
  };

  const addPurchaseLine = () => {
    setPurchaseDraft((current) => ({ ...current, lines: [...current.lines, newPurchaseLine()] }));
  };

  const removePurchaseLine = (lineId: string) => {
    setPurchaseDraft((current) => {
      if (current.lines.length <= 1) {
        return { ...current, lines: [newPurchaseLine()] };
      }
      return { ...current, lines: current.lines.filter((line) => line.id !== lineId) };
    });
  };

  const saveSupplier = async () => {
    if (!supplierDraft.name.trim()) {
      toast({ title: "Supplier name is required", variant: "destructive" });
      return;
    }
    try {
      await actions.addSupplier({
        name: supplierDraft.name.trim(),
        contactName: supplierDraft.contactName.trim() || undefined,
        phone: supplierDraft.phone.trim() || undefined,
        email: supplierDraft.email.trim() || undefined,
      });
      setSupplierDraft(emptySupplier);
      setSupplierOpen(false);
      toast({ title: "Supplier added" });
    } catch (err) {
      toast({ title: "Could not add supplier", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  const savePurchaseOrder = async () => {
    const lines = buildLines();
    if (!purchaseDraft.supplierId || !purchaseDraft.date || !lines) {
      toast({ title: "Complete purchase order details", variant: "destructive" });
      return;
    }
    try {
      await actions.addPurchaseOrder({
        supplierId: purchaseDraft.supplierId,
        orderDate: purchaseDraft.date,
        expectedDate: purchaseDraft.expectedDate || undefined,
        items: lines,
      });
      setPurchaseDraft(emptyPurchase());
      setPoOpen(false);
      toast({ title: "Purchase order created" });
    } catch (err) {
      toast({ title: "Could not create purchase order", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  const saveInvoice = async () => {
    const lines = buildLines();
    if (!purchaseDraft.supplierId || !purchaseDraft.invoiceNumber.trim() || !purchaseDraft.date || !lines) {
      toast({ title: "Complete invoice details", variant: "destructive" });
      return;
    }
    try {
      await actions.addPurchaseInvoice({
        supplierId: purchaseDraft.supplierId,
        purchaseOrderId: purchaseDraft.purchaseOrderId || undefined,
        invoiceNumber: purchaseDraft.invoiceNumber.trim(),
        invoiceDate: purchaseDraft.date,
        dueDate: purchaseDraft.dueDate || undefined,
        items: lines,
      });
      setPurchaseDraft(emptyPurchase());
      setInvoiceOpen(false);
      toast({ title: "Invoice posted and stock updated" });
    } catch (err) {
      toast({ title: "Could not post invoice", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  const savePayment = async () => {
    const amount = Number.parseFloat(paymentDraft.amount);
    if (!paymentDraft.purchaseInvoiceId || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Complete payment details", variant: "destructive" });
      return;
    }
    try {
      await actions.addSupplierPayment({
        purchaseInvoiceId: paymentDraft.purchaseInvoiceId,
        paymentDate: paymentDraft.paymentDate,
        amount,
        paymentMethod: paymentDraft.paymentMethod,
        reference: paymentDraft.reference.trim() || undefined,
      });
      setPaymentDraft(emptyPayment);
      setPaymentOpen(false);
      toast({ title: "Supplier payment recorded" });
    } catch (err) {
      toast({ title: "Could not record payment", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  return (
    <AppShell title="Creditors & Purchases" description="Suppliers, purchase orders, invoices, payments, and aging." active="apps-services">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Supplier balance</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(metrics.unpaid, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Supplier payments</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(metrics.paid, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Open POs</p>
          <p className="mt-2 text-2xl font-semibold">{metrics.ordered}</p>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search supplier or invoice..." className="h-11 pl-10" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <Button variant="outline" onClick={() => setSupplierOpen(true)}><Truck className="mr-2 h-4 w-4" />Supplier</Button>
          <Button variant="outline" onClick={() => setPoOpen(true)}><ClipboardList className="mr-2 h-4 w-4" />PO</Button>
          <Button onClick={() => setInvoiceOpen(true)}><Plus className="mr-2 h-4 w-4" />Invoice</Button>
          <Button variant="secondary" onClick={() => setPaymentOpen(true)}>Payment</Button>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.supplierName}</TableCell>
                <TableCell>{invoice.invoiceNumber}</TableCell>
                <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{formatMoney(invoice.subtotal, currency)}</TableCell>
                <TableCell className="text-right font-semibold">{formatMoney(invoice.balance, currency)}</TableCell>
                <TableCell>{invoiceBadge(invoice.status)}</TableCell>
              </TableRow>
            ))}
            {filteredInvoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No supplier invoices yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="font-semibold">Purchase order status</p>
          <div className="mt-4 space-y-3">
            {purchaseOrders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                <span>{order.orderNumber} - {order.supplierName}</span>
                <Badge variant="secondary" className="capitalize">{order.status}</Badge>
              </div>
            ))}
            {purchaseOrders.length === 0 && <p className="text-sm text-muted-foreground">No purchase orders yet.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <p className="font-semibold">Supplier aging</p>
          <div className="mt-4 space-y-3">
            {purchaseInvoices.filter((invoice) => invoice.balance > 0).slice(0, 5).map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                <span>{invoice.supplierName}</span>
                <span className="font-semibold">{formatMoney(invoice.balance, currency)}</span>
              </div>
            ))}
            {purchaseInvoices.filter((invoice) => invoice.balance > 0).length === 0 && <p className="text-sm text-muted-foreground">No outstanding supplier balances.</p>}
          </div>
        </Card>
      </div>

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add supplier</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Input placeholder="Supplier name" value={supplierDraft.name} onChange={(e) => setSupplierDraft({ ...supplierDraft, name: e.target.value })} />
            <Input placeholder="Contact name" value={supplierDraft.contactName} onChange={(e) => setSupplierDraft({ ...supplierDraft, contactName: e.target.value })} />
            <Input placeholder="Phone" value={supplierDraft.phone} onChange={(e) => setSupplierDraft({ ...supplierDraft, phone: e.target.value })} />
            <Input placeholder="Email" value={supplierDraft.email} onChange={(e) => setSupplierDraft({ ...supplierDraft, email: e.target.value })} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSupplierOpen(false)}>Cancel</Button><Button onClick={saveSupplier}>Save supplier</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={poOpen || invoiceOpen} onOpenChange={(open) => { if (!open) { setPoOpen(false); setInvoiceOpen(false); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{poOpen ? "Create purchase order" : "Post purchase invoice"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={purchaseDraft.supplierId} onChange={(e) => setPurchaseDraft({ ...purchaseDraft, supplierId: e.target.value })}>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            {!poOpen && (
              <Input placeholder="Invoice number" value={purchaseDraft.invoiceNumber} onChange={(e) => setPurchaseDraft({ ...purchaseDraft, invoiceNumber: e.target.value })} />
            )}
            {!poOpen && (
              <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={purchaseDraft.purchaseOrderId} onChange={(e) => setPurchaseDraft({ ...purchaseDraft, purchaseOrderId: e.target.value })}>
                <option value="">No linked PO</option>
                {purchaseOrders.filter((order) => order.supplierId === purchaseDraft.supplierId).map((order) => <option key={order.id} value={order.id}>{order.orderNumber}</option>)}
              </select>
            )}
            <div className="space-y-3">
              {purchaseDraft.lines.map((line) => <div key={line.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_120px_auto]">
                <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={line.productId} onChange={(e) => updatePurchaseLine(line.id, { productId: e.target.value })}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
                <Input inputMode="numeric" placeholder="Qty" value={line.quantity} onChange={(e) => updatePurchaseLine(line.id, { quantity: e.target.value })} />
                <Input inputMode="decimal" placeholder={`Cost (${currency})`} value={line.unitCost} onChange={(e) => updatePurchaseLine(line.id, { unitCost: e.target.value })} />
                <Button type="button" variant="outline" onClick={() => removePurchaseLine(line.id)}>Remove</Button>
              </div>)}
              <Button type="button" variant="outline" onClick={addPurchaseLine}>Add item</Button>
            </div>
            <Input type="date" value={purchaseDraft.date} onChange={(e) => setPurchaseDraft({ ...purchaseDraft, date: e.target.value })} />
            {poOpen ? (
              <Input type="date" value={purchaseDraft.expectedDate} onChange={(e) => setPurchaseDraft({ ...purchaseDraft, expectedDate: e.target.value })} />
            ) : (
              <Input type="date" value={purchaseDraft.dueDate} onChange={(e) => setPurchaseDraft({ ...purchaseDraft, dueDate: e.target.value })} />
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setPoOpen(false); setInvoiceOpen(false); }}>Cancel</Button><Button onClick={poOpen ? savePurchaseOrder : saveInvoice}>{poOpen ? "Create PO" : "Post invoice"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record supplier payment</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={paymentDraft.purchaseInvoiceId} onChange={(e) => setPaymentDraft({ ...paymentDraft, purchaseInvoiceId: e.target.value })}>
              <option value="">Select unpaid invoice</option>
              {purchaseInvoices.filter((invoice) => invoice.balance > 0).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} - {invoice.supplierName} ({formatMoney(invoice.balance, currency)})</option>)}
            </select>
            <Input type="date" value={paymentDraft.paymentDate} onChange={(e) => setPaymentDraft({ ...paymentDraft, paymentDate: e.target.value })} />
            <Input inputMode="decimal" placeholder="Amount" value={paymentDraft.amount} onChange={(e) => setPaymentDraft({ ...paymentDraft, amount: e.target.value })} />
            <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={paymentDraft.paymentMethod} onChange={(e) => setPaymentDraft({ ...paymentDraft, paymentMethod: e.target.value as PaymentDraft["paymentMethod"] })}>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
            <Input placeholder="Reference" value={paymentDraft.reference} onChange={(e) => setPaymentDraft({ ...paymentDraft, reference: e.target.value })} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button><Button onClick={savePayment}>Record payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
