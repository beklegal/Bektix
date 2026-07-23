import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBektix } from "@/lib/bektix/context";
import { formatMoney } from "@/lib/bektix/format";
import {
  Banknote,
  BriefcaseBusiness,
  ChevronRight,
  ClipboardList,
  Landmark,
  ReceiptText,
  TrendingUp,
  UserCog,
  UsersRound,
} from "lucide-react";

export default function AppsServices() {
  const navigate = useNavigate();
  const {
    shop,
    payrollRuns,
    purchaseInvoices,
    purchaseOrders,
    supplierPayments,
    bankDeposits,
    sales,
  } = useBektix();
  const currency = shop?.preferences.currency || "GHS";

  const metrics = useMemo(() => {
    const unpaidSuppliers = purchaseInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);
    const payrollDue = payrollRuns
      .filter((run) => run.status === "draft")
      .reduce((sum, run) => sum + run.netPay, 0);
    const deposited = bankDeposits.reduce((sum, deposit) => sum + deposit.total, 0);
    const cashIn = sales.reduce((sum, sale) => sum + sale.total, 0);
    const cashOut =
      supplierPayments.reduce((sum, payment) => sum + payment.amount, 0) +
      payrollRuns.filter((run) => run.status !== "draft").reduce((sum, run) => sum + run.netPay, 0);
    return { unpaidSuppliers, payrollDue, deposited, cashFlow: cashIn - cashOut };
  }, [bankDeposits, payrollRuns, purchaseInvoices, sales, supplierPayments]);

  const modules = [
    {
      title: "Payroll",
      description: "Employees, pay runs, cash and cheque wage payments.",
      path: "/payroll",
      icon: UsersRound,
      badge: `${payrollRuns.length} pay runs`,
      feature: "payroll",
    },
    {
      title: "Creditors & Purchases",
      description: "Suppliers, purchase orders, invoices, and supplier payments.",
      path: "/creditors",
      icon: BriefcaseBusiness,
      badge: `${purchaseOrders.length} POs`,
      feature: "creditors",
    },
    {
      title: "Bank Deposits",
      description: "Cash and cheque batches sent to the bank.",
      path: "/banking",
      icon: Landmark,
      badge: `${bankDeposits.length} deposits`,
      feature: "banking",
    },
    {
      title: "Debtors",
      description: "Track customer invoices, unpaid balances, and paid debtor records.",
      path: "/debtors",
      icon: ReceiptText,
      badge: "Customer credit",
      feature: "debtors",
    },
    {
      title: "Reports",
      description: "Sales, profit, transactions, and best-selling product analytics.",
      path: "/reports",
      icon: TrendingUp,
      badge: "Analytics",
      feature: "reports",
    },
    {
      title: "Users",
      description: "Manage staff accounts, roles, and active or inactive access.",
      path: "/users",
      icon: UserCog,
      badge: "Admin",
      feature: "users",
    },
  ].filter((module) => shop?.features[module.feature as keyof typeof shop.features]);

  return (
    <AppShell
      title="Apps & Services"
      description="Finance operations inspired by Sage 50: payroll, purchasing, creditors, and banking."
      active="apps-services"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Supplier balances</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(metrics.unpaidSuppliers, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Draft payroll</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(metrics.payrollDue, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Deposited</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(metrics.deposited, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Simple cash flow</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(metrics.cashFlow, currency)}</p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.path} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-lg bg-accent/10 p-3">
                  <Icon className="h-6 w-6 text-accent" />
                </div>
                <Badge variant="secondary">{module.badge}</Badge>
              </div>
              <h2 className="mt-5 text-lg font-semibold">{module.title}</h2>
              <p className="mt-2 min-h-12 text-sm text-muted-foreground">{module.description}</p>
              <Button className="mt-5 h-11 w-full justify-between" onClick={() => navigate(module.path)}>
                Open module
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <ReceiptText className="h-5 w-5 text-accent" />
            <p className="font-semibold">Supplier Aging</p>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Unpaid supplier invoices are grouped inside Creditors.</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Banknote className="h-5 w-5 text-accent" />
            <p className="font-semibold">Cash & Cheque Register</p>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Deposit batches separate cash and cheque totals.</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-accent" />
            <p className="font-semibold">Purchase Status</p>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Purchase orders track draft, ordered, received, and cancelled states.</p>
        </Card>
      </div>
    </AppShell>
  );
}
