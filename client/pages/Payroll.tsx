import { useMemo, useState } from "react";
import type { Employee, PayrollRun } from "@shared/bektix";
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
import { CheckCircle2, Plus, Search, UsersRound } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

type EmployeeDraft = {
  name: string;
  title: string;
  payType: Employee["payType"];
  basePay: string;
};

type RunDraft = {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  grossPay: string;
  allowances: string;
  deductions: string;
  paymentMethod: PayrollRun["paymentMethod"];
};

const emptyEmployee: EmployeeDraft = {
  name: "",
  title: "",
  payType: "salary",
  basePay: "0",
};

const emptyRun: RunDraft = {
  employeeId: "",
  periodStart: today,
  periodEnd: today,
  payDate: today,
  grossPay: "0",
  allowances: "0",
  deductions: "0",
  paymentMethod: "cash",
};

function statusBadge(status: PayrollRun["status"]) {
  if (status === "paid") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>;
  if (status === "closed") return <Badge variant="secondary">Closed</Badge>;
  return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Draft</Badge>;
}

export default function Payroll() {
  const { shop, employees, payrollRuns, actions } = useBektix();
  const currency = shop?.preferences.currency || "GHS";
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft>(emptyEmployee);
  const [runDraft, setRunDraft] = useState<RunDraft>(emptyRun);

  const filteredRuns = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return payrollRuns;
    return payrollRuns.filter((run) => run.employeeName.toLowerCase().includes(search));
  }, [payrollRuns, searchTerm]);

  const totals = useMemo(() => {
    const draft = payrollRuns.filter((run) => run.status === "draft");
    const paid = payrollRuns.filter((run) => run.status !== "draft");
    return {
      employees: employees.filter((employee) => employee.status === "active").length,
      draftTotal: draft.reduce((sum, run) => sum + run.netPay, 0),
      paidTotal: paid.reduce((sum, run) => sum + run.netPay, 0),
    };
  }, [employees, payrollRuns]);

  const saveEmployee = async () => {
    const basePay = Number.parseFloat(employeeDraft.basePay);
    if (!employeeDraft.name.trim() || !employeeDraft.title.trim() || !Number.isFinite(basePay) || basePay < 0) {
      toast({ title: "Complete employee details", variant: "destructive" });
      return;
    }
    try {
      await actions.addEmployee({
        name: employeeDraft.name.trim(),
        title: employeeDraft.title.trim(),
        payType: employeeDraft.payType,
        basePay,
      });
      setEmployeeDraft(emptyEmployee);
      setEmployeeOpen(false);
      toast({ title: "Employee added" });
    } catch (err) {
      toast({
        title: "Could not add employee",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const saveRun = async () => {
    const grossPay = Number.parseFloat(runDraft.grossPay);
    const allowances = Number.parseFloat(runDraft.allowances);
    const deductions = Number.parseFloat(runDraft.deductions);
    if (!runDraft.employeeId || !Number.isFinite(grossPay) || !Number.isFinite(allowances) || !Number.isFinite(deductions)) {
      toast({ title: "Complete pay run details", variant: "destructive" });
      return;
    }
    try {
      await actions.addPayrollRun({
        employeeId: runDraft.employeeId,
        periodStart: runDraft.periodStart,
        periodEnd: runDraft.periodEnd,
        payDate: runDraft.payDate,
        grossPay,
        allowances,
        deductions,
        paymentMethod: runDraft.paymentMethod,
      });
      setRunDraft(emptyRun);
      setRunOpen(false);
      toast({ title: "Pay run created" });
    } catch (err) {
      toast({
        title: "Could not create pay run",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const markPaid = async (run: PayrollRun) => {
    try {
      await actions.updatePayrollRun(run.id, { status: "paid" });
      toast({ title: "Payroll marked as paid" });
    } catch (err) {
      toast({
        title: "Could not update payroll",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AppShell title="Payroll" description="Employees, pay runs, and cash or cheque wage payments." active="apps-services">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Active employees</p>
          <p className="mt-2 text-2xl font-semibold">{totals.employees}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Draft payroll</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(totals.draftTotal, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Paid payroll</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(totals.paidTotal, currency)}</p>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search payroll by employee..."
            className="h-11 pl-10"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Button variant="outline" className="h-11" onClick={() => setEmployeeOpen(true)}>
            <UsersRound className="mr-2 h-4 w-4" />
            Employee
          </Button>
          <Button className="h-11 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setRunOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Pay Run
          </Button>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Pay date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Net pay</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRuns.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">{run.employeeName}</TableCell>
                <TableCell>{new Date(run.payDate).toLocaleDateString()}</TableCell>
                <TableCell className="capitalize">{run.paymentMethod}</TableCell>
                <TableCell className="text-right font-semibold">{formatMoney(run.netPay, currency)}</TableCell>
                <TableCell>{statusBadge(run.status)}</TableCell>
                <TableCell className="text-center">
                  {run.status === "draft" && (
                    <Button variant="outline" size="sm" onClick={() => markPaid(run)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark paid
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredRuns.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No payroll runs yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={employeeOpen} onOpenChange={setEmployeeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Input placeholder="Employee name" value={employeeDraft.name} onChange={(e) => setEmployeeDraft({ ...employeeDraft, name: e.target.value })} />
            <Input placeholder="Role / title" value={employeeDraft.title} onChange={(e) => setEmployeeDraft({ ...employeeDraft, title: e.target.value })} />
            <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={employeeDraft.payType} onChange={(e) => setEmployeeDraft({ ...employeeDraft, payType: e.target.value as Employee["payType"] })}>
              <option value="salary">Salary</option>
              <option value="hourly">Hourly</option>
            </select>
            <Input inputMode="decimal" placeholder={`Base pay (${currency})`} value={employeeDraft.basePay} onChange={(e) => setEmployeeDraft({ ...employeeDraft, basePay: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeOpen(false)}>Cancel</Button>
            <Button onClick={saveEmployee}>Save employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create pay run</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={runDraft.employeeId} onChange={(e) => setRunDraft({ ...runDraft, employeeId: e.target.value })}>
              <option value="">Select employee</option>
              {employees.filter((employee) => employee.status === "active").map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input type="date" value={runDraft.periodStart} onChange={(e) => setRunDraft({ ...runDraft, periodStart: e.target.value })} />
              <Input type="date" value={runDraft.periodEnd} onChange={(e) => setRunDraft({ ...runDraft, periodEnd: e.target.value })} />
              <Input type="date" value={runDraft.payDate} onChange={(e) => setRunDraft({ ...runDraft, payDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input inputMode="decimal" placeholder="Gross pay" value={runDraft.grossPay} onChange={(e) => setRunDraft({ ...runDraft, grossPay: e.target.value })} />
              <Input inputMode="decimal" placeholder="Allowances" value={runDraft.allowances} onChange={(e) => setRunDraft({ ...runDraft, allowances: e.target.value })} />
              <Input inputMode="decimal" placeholder="Deductions" value={runDraft.deductions} onChange={(e) => setRunDraft({ ...runDraft, deductions: e.target.value })} />
            </div>
            <select className="h-11 rounded-md border border-border bg-background px-3 text-sm" value={runDraft.paymentMethod} onChange={(e) => setRunDraft({ ...runDraft, paymentMethod: e.target.value as PayrollRun["paymentMethod"] })}>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>Cancel</Button>
            <Button onClick={saveRun}>Create pay run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
