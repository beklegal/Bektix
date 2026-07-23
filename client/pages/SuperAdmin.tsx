import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useBektix } from "@/lib/bektix/context";
import type { BusinessType, TenantFeature } from "@shared/bektix";
import { Building2, Plus, ShieldCheck } from "lucide-react";

const featureOptions: Array<{ key: TenantFeature; label: string }> = [
  { key: "payroll", label: "Payroll" },
  { key: "creditors", label: "Creditors" },
  { key: "banking", label: "Banking" },
  { key: "debtors", label: "Debtors" },
  { key: "reports", label: "Reports" },
  { key: "users", label: "Users" },
];

const initialFeatures = Object.fromEntries(featureOptions.map((feature) => [feature.key, true])) as Record<TenantFeature, boolean>;

export default function SuperAdmin() {
  const { tenants, actions } = useBektix();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    shopName: "",
    businessType: "other" as BusinessType,
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    features: initialFeatures,
  });

  const stats = useMemo(
    () => ({
      active: tenants.filter((tenant) => tenant.shop.status === "active").length,
      users: tenants.reduce((sum, tenant) => sum + tenant.userCount, 0),
    }),
    [tenants],
  );

  const createTenant = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await actions.createTenant(draft);
      setDraft({ shopName: "", businessType: "other", adminName: "", adminEmail: "", adminPassword: "", features: initialFeatures });
      setOpen(false);
      toast({ title: "Tenant created", description: "The tenant admin can now sign in." });
    } catch (err) {
      toast({
        title: "Could not create tenant",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = async (shopId: string, feature: TenantFeature, enabled: boolean) => {
    try {
      await actions.updateTenantFeatures(shopId, { [feature]: enabled });
    } catch (err) {
      toast({ title: "Could not update feature", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  return (
    <AppShell title="Super Admin" description="Manage BEKTIX tenants, tenant admins, and module access." active="super-admin">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Tenants</p>
          <p className="mt-2 text-2xl font-semibold">{tenants.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Active tenants</p>
          <p className="mt-2 text-2xl font-semibold">{stats.active}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Tenant users</p>
          <p className="mt-2 text-2xl font-semibold">{stats.users}</p>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Create tenant</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create tenant</DialogTitle></DialogHeader>
            <form onSubmit={createTenant} className="space-y-4">
              <Input placeholder="Tenant business name" value={draft.shopName} onChange={(e) => setDraft({ ...draft, shopName: e.target.value })} required />
              <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={draft.businessType} onChange={(e) => setDraft({ ...draft, businessType: e.target.value as BusinessType })}>
                <option value="other">Other</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="grocery">Grocery</option>
                <option value="clothing">Clothing</option>
                <option value="electronics">Electronics</option>
              </select>
              <Input placeholder="Tenant admin name" value={draft.adminName} onChange={(e) => setDraft({ ...draft, adminName: e.target.value })} required />
              <Input type="email" placeholder="Tenant admin email" value={draft.adminEmail} onChange={(e) => setDraft({ ...draft, adminEmail: e.target.value })} required />
              <Input type="password" placeholder="Temporary password" value={draft.adminPassword} onChange={(e) => setDraft({ ...draft, adminPassword: e.target.value })} required minLength={6} />
              <div className="grid grid-cols-2 gap-3">
                {featureOptions.map((feature) => (
                  <label key={feature.key} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={draft.features[feature.key]} onCheckedChange={(checked) => setDraft({ ...draft, features: { ...draft.features, [feature.key]: checked === true } })} />
                    {feature.label}
                  </label>
                ))}
              </div>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? "Creating..." : "Create tenant"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        {tenants.map((tenant) => (
          <Card key={tenant.shop.id} className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold">{tenant.shop.name}</h2>
                  <Badge variant={tenant.shop.status === "active" ? "secondary" : "destructive"}>{tenant.shop.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Admin: {tenant.admin?.name || "None"} {tenant.admin?.email ? `(${tenant.admin.email})` : ""} · {tenant.userCount} users
                </p>
              </div>
              <Button variant="outline" onClick={() => actions.updateTenantStatus(tenant.shop.id, tenant.shop.status === "active" ? "inactive" : "active")}>
                {tenant.shop.status === "active" ? "Deactivate" : "Activate"}
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {featureOptions.map((feature) => (
                <label key={feature.key} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                  <Checkbox checked={tenant.shop.features[feature.key]} onCheckedChange={(checked) => updateFeature(tenant.shop.id, feature.key, checked === true)} />
                  {feature.label}
                </label>
              ))}
            </div>
          </Card>
        ))}
        {!tenants.length && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-accent" />
            No tenants have been created yet.
          </Card>
        )}
      </div>
    </AppShell>
  );
}
