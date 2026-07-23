import { useMemo, useState } from "react";
import type { Debtor } from "@shared/bektix";
import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { CheckCircle2, Edit2, FileText, Plus, Search, Trash2 } from "lucide-react";

type DebtorDraft = {
  name: string;
  date: string;
  invoiceNumber: string;
  amount: string;
};

const today = new Date().toISOString().slice(0, 10);

const emptyDraft: DebtorDraft = {
  name: "",
  date: today,
  invoiceNumber: "",
  amount: "0",
};

function debtorToDraft(debtor: Debtor): DebtorDraft {
  return {
    name: debtor.name,
    date: debtor.date,
    invoiceNumber: debtor.invoiceNumber,
    amount: String(debtor.amount),
  };
}

function statusBadge(status: Debtor["status"]) {
  return status === "paid" ? (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>
  ) : (
    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Unpaid</Badge>
  );
}

export default function Debtors() {
  const { shop, debtors, actions } = useBektix();
  const currency = shop?.preferences.currency || "GHS";
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DebtorDraft>(emptyDraft);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedSearch) return debtors;
    return debtors.filter(
      (debtor) =>
        debtor.name.toLowerCase().includes(normalizedSearch) ||
        debtor.invoiceNumber.toLowerCase().includes(normalizedSearch),
    );
  }, [debtors, normalizedSearch]);

  const totals = useMemo(() => {
    const unpaid = debtors.filter((debtor) => debtor.status === "unpaid");
    return {
      unpaidCount: unpaid.length,
      unpaidAmount: unpaid.reduce((sum, debtor) => sum + debtor.amount, 0),
      paidCount: debtors.length - unpaid.length,
    };
  }, [debtors]);

  const openAdd = () => {
    setEditingId(null);
    setDraft({ ...emptyDraft, date: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };

  const openEdit = (debtor: Debtor) => {
    setEditingId(debtor.id);
    setDraft(debtorToDraft(debtor));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const saveDebtor = async () => {
    const name = draft.name.trim();
    const invoiceNumber = draft.invoiceNumber.trim();
    const amount = Number.parseFloat(draft.amount);

    if (!name) {
      toast({ title: "Name / Company is required", variant: "destructive" });
      return;
    }
    if (!draft.date) {
      toast({ title: "Date is required", variant: "destructive" });
      return;
    }
    if (!invoiceNumber) {
      toast({ title: "Invoice number is required", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: "Amount must be 0 or more", variant: "destructive" });
      return;
    }

    try {
      if (editingId) {
        await actions.updateDebtor(editingId, { name, date: draft.date, invoiceNumber, amount });
        toast({ title: "Debtor updated" });
      } else {
        await actions.addDebtor({ name, date: draft.date, invoiceNumber, amount });
        toast({ title: "Debtor added" });
      }
      closeDialog();
    } catch (err) {
      toast({
        title: "Could not save debtor",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const markPaid = async (debtor: Debtor) => {
    try {
      await actions.updateDebtor(debtor.id, { status: "paid" });
      toast({ title: "Debtor marked as paid" });
    } catch (err) {
      toast({
        title: "Could not update status",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeDebtor = async (debtor: Debtor) => {
    try {
      await actions.deleteDebtor(debtor.id);
      toast({ title: "Debtor deleted" });
    } catch (err) {
      toast({
        title: "Could not delete debtor",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AppShell title="Debtors" description="Track unpaid invoices and mark them paid." active="debtors">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Unpaid debtors</p>
          <p className="mt-2 text-2xl font-semibold">{totals.unpaidCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Unpaid amount</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(totals.unpaidAmount, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Paid records</p>
          <p className="mt-2 text-2xl font-semibold">{totals.paidCount}</p>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, company, or invoice..."
            className="h-11 pl-10"
          />
        </div>
        <Button
          onClick={openAdd}
          className="h-11 w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold sm:w-auto"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Debtor
        </Button>
      </div>

      <div className="mt-6 grid gap-3 md:hidden">
        {filtered.map((debtor) => (
          <Card key={debtor.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{debtor.name}</p>
                <p className="text-sm text-muted-foreground">Invoice {debtor.invoiceNumber}</p>
              </div>
              {statusBadge(debtor.status)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-semibold">{new Date(debtor.date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-semibold">{formatMoney(debtor.amount, currency)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
              {debtor.status === "unpaid" && (
                <Button variant="outline" size="sm" className="h-10" onClick={() => markPaid(debtor)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark paid
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => openEdit(debtor)}>
                <Edit2 className="h-4 w-4 text-accent" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => removeDebtor(debtor)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </Card>
        ))}

        {filtered.length === 0 && (
          <Card className="p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No debtor records found.</p>
            <Button className="mt-4" variant="outline" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add debtor
            </Button>
          </Card>
        )}
      </div>

      <Card className="mt-6 hidden overflow-hidden md:block">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Name / Company</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Invoice Number</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((debtor) => (
              <TableRow key={debtor.id}>
                <TableCell className="font-medium">{debtor.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(debtor.date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-muted-foreground">{debtor.invoiceNumber}</TableCell>
                <TableCell className="text-right font-semibold">{formatMoney(debtor.amount, currency)}</TableCell>
                <TableCell>{statusBadge(debtor.status)}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {debtor.status === "unpaid" && (
                      <Button variant="outline" size="sm" className="h-10 px-3" onClick={() => markPaid(debtor)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark paid
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => openEdit(debtor)}>
                      <Edit2 className="h-4 w-4 text-accent" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => removeDebtor(debtor)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    No debtor records found.
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit debtor" : "Add debtor"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update invoice details." : "Record a debtor invoice for follow-up."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Name / Company *</label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Date *</label>
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Invoice number *</label>
              <Input
                value={draft.invoiceNumber}
                onChange={(e) => setDraft({ ...draft, invoiceNumber: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Amount ({currency}) *</label>
              <Input
                inputMode="decimal"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="h-11">
              Cancel
            </Button>
            <Button onClick={saveDebtor} className="h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
              {editingId ? "Save changes" : "Add debtor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
