import { useMemo, useState } from "react";
import type { BankDeposit } from "@shared/bektix";
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
import { CheckCircle2, Landmark, Plus, Search, Send } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

type DepositDraft = {
  depositDate: string;
  bankName: string;
  reference: string;
  status: BankDeposit["status"];
  sourceType: BankDeposit["lines"][number]["sourceType"];
  sourceReference: string;
  description: string;
  paymentMethod: BankDeposit["lines"][number]["paymentMethod"];
  amount: string;
};

const emptyDraft: DepositDraft = {
  depositDate: today,
  bankName: "",
  reference: "",
  status: "draft",
  sourceType: "manual",
  sourceReference: "",
  description: "",
  paymentMethod: "cash",
  amount: "0",
};

function statusBadge(status: BankDeposit["status"]) {
  if (status === "confirmed") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Confirmed</Badge>;
  if (status === "sent") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Sent</Badge>;
  return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Draft</Badge>;
}

export default function Banking() {
  const { shop, bankDeposits, sales, supplierPayments, payrollRuns, actions } = useBektix();
  const currency = shop?.preferences.currency || "GHS";
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DepositDraft>(emptyDraft);

  const filtered = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return bankDeposits;
    return bankDeposits.filter(
      (deposit) =>
        deposit.bankName.toLowerCase().includes(search) ||
        deposit.reference?.toLowerCase().includes(search),
    );
  }, [bankDeposits, searchTerm]);

  const metrics = useMemo(() => {
    const totalCash = bankDeposits.reduce((sum, deposit) => sum + deposit.totalCash, 0);
    const totalCheque = bankDeposits.reduce((sum, deposit) => sum + deposit.totalCheque, 0);
    const cashIn = sales.reduce((sum, sale) => sum + sale.total, 0);
    const cashOut =
      supplierPayments.reduce((sum, payment) => sum + payment.amount, 0) +
      payrollRuns.filter((run) => run.status !== "draft").reduce((sum, run) => sum + run.netPay, 0);
    return { totalCash, totalCheque, total: totalCash + totalCheque, cashFlow: cashIn - cashOut };
  }, [bankDeposits, payrollRuns, sales, supplierPayments]);

  const saveDeposit = async () => {
    const amount = Number.parseFloat(draft.amount);
    if (!draft.bankName.trim() || !draft.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Complete deposit details", variant: "destructive" });
      return;
    }
    try {
      await actions.addBankDeposit({
        depositDate: draft.depositDate,
        bankName: draft.bankName.trim(),
        reference: draft.reference.trim() || undefined,
        status: draft.status,
        lines: [
          {
            sourceType: draft.sourceType,
            sourceReference: draft.sourceReference.trim() || undefined,
            description: draft.description.trim(),
            paymentMethod: draft.paymentMethod,
            amount,
          },
        ],
      });
      setDraft(emptyDraft);
      setDialogOpen(false);
      toast({ title: "Bank deposit recorded" });
    } catch (err) {
      toast({
        title: "Could not record deposit",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateStatus = async (deposit: BankDeposit, status: BankDeposit["status"]) => {
    try {
      await actions.updateBankDepositStatus(deposit.id, status);
      toast({ title: "Deposit status updated" });
    } catch (err) {
      toast({
        title: "Could not update deposit",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AppShell title="Bank Deposits" description="Track cash and cheque batches sent to the bank." active="apps-services">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Cash deposits</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(metrics.totalCash, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Cheque deposits</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(metrics.totalCheque, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Total deposited</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(metrics.total, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Simple cash flow</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(metrics.cashFlow, currency)}</p>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search bank or reference..." className="h-11 pl-10" />
        </div>
        <Button className="h-11 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Deposit
        </Button>
      </div>

      <Card className="mt-6 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Bank</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Cash</TableHead>
              <TableHead className="text-right">Cheque</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((deposit) => (
              <TableRow key={deposit.id}>
                <TableCell className="font-medium">{deposit.bankName}</TableCell>
                <TableCell>{new Date(deposit.depositDate).toLocaleDateString()}</TableCell>
                <TableCell>{deposit.reference || "-"}</TableCell>
                <TableCell className="text-right">{formatMoney(deposit.totalCash, currency)}</TableCell>
                <TableCell className="text-right">{formatMoney(deposit.totalCheque, currency)}</TableCell>
                <TableCell className="text-right font-semibold">{formatMoney(deposit.total, currency)}</TableCell>
                <TableCell>{statusBadge(deposit.status)}</TableCell>
                <TableCell className="text-center">
                  {deposit.status === "draft" && (
                    <Button variant="outline" size="sm" onClick={() => updateStatus(deposit, "sent")}>
                      <Send className="mr-2 h-4 w-4" />
                      Sent
                    </Button>
                  )}
                  {deposit.status === "sent" && (
                    <Button variant="outline" size="sm" onClick={() => updateStatus(deposit, "confirmed")}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirm
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No bank deposits yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-3">
          <Landmark className="h-5 w-5 text-accent" />
          <p className="font-semibold">Deposit register</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {bankDeposits.slice(0, 6).map((deposit) => (
            <div key={deposit.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{deposit.bankName}</span>
                <span>{formatMoney(deposit.total, currency)}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{deposit.lines.map((line) => line.description).join(", ")}</p>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>New bank deposit</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input type="date" value={draft.depositDate} onChange={(e) => setDraft({ ...draft, depositDate: e.target.value })} />
              <Input placeholder="Bank name" value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} />
            </div>
            <Input placeholder="Deposit reference" value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={draft.sourceType} onChange={(e) => setDraft({ ...draft, sourceType: e.target.value as DepositDraft["sourceType"] })}>
                <option value="manual">Manual</option>
                <option value="sale">Sale</option>
                <option value="debtor_payment">Debtor payment</option>
                <option value="supplier_refund">Supplier refund</option>
              </select>
              <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={draft.paymentMethod} onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value as DepositDraft["paymentMethod"] })}>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
              <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as BankDeposit["status"] })}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
            <Input placeholder="Source reference" value={draft.sourceReference} onChange={(e) => setDraft({ ...draft, sourceReference: e.target.value })} />
            <Input placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <Input inputMode="decimal" placeholder={`Amount (${currency})`} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveDeposit}>Record deposit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
