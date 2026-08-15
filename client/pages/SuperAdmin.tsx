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
import type { PlatformTenant } from "@shared/api";
import { Building2, GitBranch, MapPin, Plus, ShieldCheck, Users, Search, CircleCheck, CreditCard, Trash2 } from "lucide-react";

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
  const [branchTenantId, setBranchTenantId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [branchSaving, setBranchSaving] = useState(false);
  const [draft, setDraft] = useState({
    shopName: "",
    businessType: "other" as BusinessType,
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    features: initialFeatures,
  });
  const [branchDraft, setBranchDraft] = useState({ name: "", location: "" });
  const [search, setSearch] = useState("");
  const [subscriptionTenant, setSubscriptionTenant] = useState<PlatformTenant | null>(null);
  const [subscriptionSaving, setSubscriptionSaving] = useState(false);

  const stats = useMemo(
    () => ({
      active: tenants.filter((tenant) => tenant.shop.status === "active").length,
      users: tenants.reduce((sum, tenant) => sum + tenant.userCount, 0),
      branches: tenants.reduce((sum, tenant) => sum + tenant.branchCount, 0),
    }),
    [tenants],
  );
  const visibleTenants = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter((tenant) => [tenant.shop.name, tenant.admin?.name, tenant.admin?.email].some((value) => value?.toLowerCase().includes(term)));
  }, [search, tenants]);

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

  const createBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!branchTenantId) return;

    setBranchSaving(true);
    try {
      await actions.createBranch(branchTenantId, {
        name: branchDraft.name,
        location: branchDraft.location || undefined,
      });
      setBranchDraft({ name: "", location: "" });
      setBranchTenantId(null);
      toast({ title: "Branch created", description: "The tenant can now use this branch record." });
    } catch (err) {
      toast({
        title: "Could not create branch",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBranchSaving(false);
    }
  };

  const updateFeature = async (shopId: string, feature: TenantFeature, enabled: boolean) => {
    try {
      await actions.updateTenantFeatures(shopId, { [feature]: enabled });
    } catch (err) {
      toast({ title: "Could not update feature", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };
  const saveSubscription = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!subscriptionTenant) return;
    const form = new FormData(event.currentTarget);
    setSubscriptionSaving(true);
    try { await actions.updateTenantSubscription(subscriptionTenant.shop.id, { status: String(form.get("status")) as PlatformTenant["subscription"]["status"], plan: String(form.get("plan")), renewalDate: String(form.get("renewalDate")) || undefined, reminderDays: Number(form.get("reminderDays")) }); setSubscriptionTenant(null); toast({ title: "Subscription updated" }); } catch (err) { toast({ title: "Could not update subscription", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }); } finally { setSubscriptionSaving(false); }
  };
  const deleteTenant = async (tenant: PlatformTenant) => {
    if (window.prompt(`Type ${tenant.shop.name} to permanently delete this business and all of its data.`) !== tenant.shop.name) return;
    try { await actions.deleteTenant(tenant.shop.id); toast({ title: "Business account deleted" }); } catch (err) { toast({ title: "Could not delete account", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }); }
  };
  const resetTenantPassword = async (tenant: PlatformTenant) => {
    if (!tenant.admin) return;
    const password = window.prompt(`Set a new temporary password for ${tenant.admin.name} (at least 8 characters):`);
    if (!password) return;
    if (password.length < 8) return toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
    try { await actions.resetTenantAdminPassword(tenant.shop.id, password); toast({ title: "Tenant admin password reset", description: "Share the new temporary password securely." }); }
    catch (err) { toast({ title: "Could not reset password", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" }); }
  };

  return (
    <AppShell title="Super Admin" description="Manage BEKTIX tenants, branches, tenant admins, and module access." active="super-admin">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-foreground shadow-lg sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-3 flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><ShieldCheck className="h-4 w-4" />Platform control center</div><h2 className="text-2xl font-bold sm:text-3xl">Business accounts, in one place.</h2><p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">Provision businesses, control their access, and keep a clear view of every branch and administrator.</p></div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2 bg-background text-foreground hover:bg-background/90"><Plus className="h-4 w-4" />Create business account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create tenant</DialogTitle></DialogHeader>
              <form onSubmit={createTenant} className="space-y-4">
                <Input placeholder="Tenant business name" value={draft.shopName} onChange={(e) => setDraft({ ...draft, shopName: e.target.value })} required />
                <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={draft.businessType} onChange={(e) => setDraft({ ...draft, businessType: e.target.value as BusinessType })}><option value="other">Other</option><option value="pharmacy">Pharmacy</option><option value="grocery">Grocery</option><option value="clothing">Clothing</option><option value="electronics">Electronics</option></select>
                <Input placeholder="Tenant admin name" value={draft.adminName} onChange={(e) => setDraft({ ...draft, adminName: e.target.value })} required />
                <Input type="email" placeholder="Tenant admin email" value={draft.adminEmail} onChange={(e) => setDraft({ ...draft, adminEmail: e.target.value })} required />
                <Input type="password" placeholder="Temporary password" value={draft.adminPassword} onChange={(e) => setDraft({ ...draft, adminPassword: e.target.value })} required minLength={6} />
                <div className="grid grid-cols-2 gap-3">{featureOptions.map((feature) => <label key={feature.key} className="flex items-center gap-2 text-sm"><Checkbox checked={draft.features[feature.key]} onCheckedChange={(checked) => setDraft({ ...draft, features: { ...draft.features, [feature.key]: checked === true } })} />{feature.label}</label>)}</div>
                <Button type="submit" className="w-full" disabled={saving}>{saving ? "Creating..." : "Create business account"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Business accounts</p><Building2 className="h-5 w-5 text-accent" /></div><p className="mt-2 text-3xl font-semibold">{tenants.length}</p><p className="mt-1 text-xs text-muted-foreground">All provisioned businesses</p>
        </Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Active accounts</p><CircleCheck className="h-5 w-5 text-emerald-600" /></div><p className="mt-2 text-3xl font-semibold">{stats.active}</p><p className="mt-1 text-xs text-muted-foreground">{tenants.length - stats.active} inactive</p>
        </Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Business users</p><Users className="h-5 w-5 text-accent" /></div><p className="mt-2 text-3xl font-semibold">{stats.users}</p><p className="mt-1 text-xs text-muted-foreground">Including tenant admins</p>
        </Card>
        <Card className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Managed branches</p><GitBranch className="h-5 w-5 text-accent" /></div><p className="mt-2 text-3xl font-semibold">{stats.branches}</p><p className="mt-1 text-xs text-muted-foreground">Across all business accounts</p>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Business directory</h2><p className="text-sm text-muted-foreground">Manage account access, branches, and enabled modules.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search businesses or admins" /></div></div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        {visibleTenants.map((tenant) => (
          <Card key={tenant.shop.id} className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-accent" />
                  <h2 className="text-lg font-semibold">{tenant.shop.name}</h2>
                  <Badge variant={tenant.shop.status === "active" ? "secondary" : "destructive"}>{tenant.shop.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tenant.admin ? `Admin: ${tenant.admin.name} (${tenant.admin.email})` : "No admin assigned"} · {tenant.userCount} users · {tenant.branchCount} branches
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" onClick={() => setSubscriptionTenant(tenant)}><CreditCard className="h-4 w-4" />Subscription</Button>
                <Button variant="outline" onClick={() => resetTenantPassword(tenant)} disabled={!tenant.admin}>Reset admin password</Button>
                <Button variant="outline" className="gap-2" onClick={() => setBranchTenantId(tenant.shop.id)}>
                  <GitBranch className="h-4 w-4" />
                  Add branch
                </Button>
                <Button variant="outline" onClick={() => actions.updateTenantStatus(tenant.shop.id, tenant.shop.status === "active" ? "inactive" : "active")}>
                  {tenant.shop.status === "active" ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteTenant(tenant)} title="Delete business account"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className={`mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${tenant.subscription.status === "expired" || tenant.subscription.status === "past_due" ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"}`}><CreditCard className="h-4 w-4" /><span className="font-medium">{tenant.subscription.plan}</span><Badge variant="outline" className="capitalize">{tenant.subscription.status.replace("_", " ")}</Badge><span className="text-muted-foreground">{tenant.subscription.renewalDate ? `Renews ${new Date(tenant.subscription.renewalDate).toLocaleDateString()} · reminder ${tenant.subscription.reminderDays} days before` : "No renewal date set"}</span></div>
            {tenant.branches.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tenant.branches.map((branch) => (
                  <Badge key={branch.id} variant="outline" className="gap-1 py-1">
                    <MapPin className="h-3 w-3" />
                    {branch.name}{branch.location ? ` - ${branch.location}` : ""}
                  </Badge>
                ))}
              </div>
            )}
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
        <Dialog open={Boolean(branchTenantId)} onOpenChange={(nextOpen) => !nextOpen && setBranchTenantId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add branch</DialogTitle></DialogHeader>
            <form onSubmit={createBranch} className="space-y-4">
              <Input placeholder="Branch name" value={branchDraft.name} onChange={(e) => setBranchDraft({ ...branchDraft, name: e.target.value })} required />
              <Input placeholder="Location or address" value={branchDraft.location} onChange={(e) => setBranchDraft({ ...branchDraft, location: e.target.value })} />
              <Button type="submit" className="w-full" disabled={branchSaving}>{branchSaving ? "Creating..." : "Create branch"}</Button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(subscriptionTenant)} onOpenChange={(open) => !open && setSubscriptionTenant(null)}><DialogContent><DialogHeader><DialogTitle>Manage subscription</DialogTitle></DialogHeader>{subscriptionTenant && <form onSubmit={saveSubscription} className="space-y-4"><p className="text-sm text-muted-foreground">{subscriptionTenant.shop.name}</p><Input name="plan" defaultValue={subscriptionTenant.subscription.plan} placeholder="Plan name" required /><select name="status" defaultValue={subscriptionTenant.subscription.status} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="expired">Expired</option></select><div><label className="text-sm font-medium">Renewal date</label><Input className="mt-2" name="renewalDate" type="date" defaultValue={subscriptionTenant.subscription.renewalDate} /></div><div><label className="text-sm font-medium">Send reminder (days before)</label><Input className="mt-2" name="reminderDays" type="number" min="0" max="90" defaultValue={subscriptionTenant.subscription.reminderDays} /></div><Button className="w-full" disabled={subscriptionSaving}>{subscriptionSaving ? "Saving..." : "Save subscription"}</Button></form>}</DialogContent></Dialog>
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
