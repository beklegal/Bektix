import { useEffect, useMemo, useState } from "react";
import type { BusinessType } from "@shared/bektix";
import AppShell from "@/components/AppShell";
import { useBektix } from "@/lib/bektix/context";
import { toast } from "@/components/ui/use-toast";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Save, Trash2 } from "lucide-react";

type SettingsForm = {
  shopName: string;
  businessType: BusinessType;
  currency: string;
  enableExpiryTracking: boolean;
  enableProductVariants: boolean;
  enableLowStockAlerts: boolean;
  autoPrintReceipt: boolean;
  lowStockThreshold: string;
  taxRatePercent: string;
  receiptFooterMessage: string;
};

export default function Settings() {
  const { shop, user, actions } = useBektix();
  const [isSaving, setIsSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const initial = useMemo<SettingsForm>(() => {
    return {
      shopName: shop?.name || "",
      businessType: shop?.businessType || "other",
      currency: shop?.preferences.currency || "GH₵",
      enableExpiryTracking: shop?.preferences.enableExpiryTracking ?? true,
      enableProductVariants: shop?.preferences.enableProductVariants ?? true,
      enableLowStockAlerts: shop?.preferences.enableLowStockAlerts ?? true,
      autoPrintReceipt: shop?.preferences.autoPrintReceipt ?? false,
      lowStockThreshold: String(shop?.preferences.lowStockThreshold ?? 10),
      taxRatePercent: String(shop?.preferences.taxRatePercent ?? 5),
      receiptFooterMessage: shop?.preferences.receiptFooterMessage || "Thank you for shopping with us!",
    };
  }, [shop]);

  const [form, setForm] = useState<SettingsForm>(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  if (user?.role !== "admin") {
    return (
      <AppShell title="Settings" description="Shop configuration and preferences." active="settings">
        <Card className="p-6">
          <p className="text-lg font-semibold">Admins only</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Settings can only be changed by the Jilkem owner account (Admin role).
          </p>
        </Card>
      </AppShell>
    );
  }

  const save = async () => {
    const shopName = form.shopName.trim();
    if (!shopName) {
      toast({ title: "Shop name is required", variant: "destructive" });
      return;
    }

    const lowStockThreshold = Number.parseInt(form.lowStockThreshold, 10);
    const taxRatePercent = Number.parseFloat(form.taxRatePercent);

    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 1) {
      toast({ title: "Low stock threshold must be at least 1", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0) {
      toast({ title: "Tax rate must be 0 or more", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await actions.updateShopDetails({ name: shopName, businessType: form.businessType });
      await actions.updateShopPreferences({
        currency: form.currency,
        enableExpiryTracking: form.enableExpiryTracking,
        enableProductVariants: form.enableProductVariants,
        enableLowStockAlerts: form.enableLowStockAlerts,
        lowStockThreshold,
        taxRatePercent,
        autoPrintReceipt: form.autoPrintReceipt,
        receiptFooterMessage: form.receiptFooterMessage.trim() || "Thank you for shopping with us!",
      });
      toast({ title: "Settings saved" });
    } catch (err) {
      toast({
        title: "Could not save settings",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetSystemData = async () => {
    if (resetConfirm.trim().toUpperCase() !== "CLEAR") {
      toast({ title: "Type CLEAR to confirm", variant: "destructive" });
      return;
    }

    setIsResetting(true);
    try {
      await actions.resetSystemData();
      toast({ title: "System data cleared" });
      setResetOpen(false);
      setResetConfirm("");
    } catch (err) {
      toast({
        title: "Could not clear system data",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AppShell title="Settings" description="Shop configuration and preferences." active="settings">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <p className="text-lg font-semibold">Shop details</p>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Shop name</label>
              <Input
                value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Business type</label>
              <select
                value={form.businessType}
                onChange={(e) => setForm({ ...form, businessType: e.target.value as BusinessType })}
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="pharmacy">Pharmacy</option>
                <option value="grocery">Grocery store</option>
                <option value="clothing">Clothing shop</option>
                <option value="electronics">Electronics shop</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="GH₵">GH₵ (Ghana Cedi)</option>
                <option value="$">$ (US Dollar)</option>
                <option value="€">€ (Euro)</option>
                <option value="£">£ (British Pound)</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Tax rate (%)</label>
              <Input
                inputMode="decimal"
                value={form.taxRatePercent}
                onChange={(e) => setForm({ ...form, taxRatePercent: e.target.value })}
                className="h-11"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-lg font-semibold">Actions</p>
          <p className="mt-1 text-sm text-muted-foreground">Apply changes to Jilkem.</p>
          <Button
            onClick={save}
            disabled={isSaving}
            className="mt-5 h-11 w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save settings"}
          </Button>
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm font-semibold text-destructive">Reset system</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clear sales, products, and staff users while keeping the admin account.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setResetOpen(true)}
              className="mt-4 h-11 w-full font-semibold"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear all system data
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <p className="text-lg font-semibold">Features</p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">Expiry tracking</p>
              <p className="text-sm text-muted-foreground">Track product expiry dates</p>
            </div>
            <Switch
              checked={form.enableExpiryTracking}
              onCheckedChange={(checked) => setForm({ ...form, enableExpiryTracking: checked })}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">Product variants</p>
              <p className="text-sm text-muted-foreground">Sizes, colors, and variations</p>
            </div>
            <Switch
              checked={form.enableProductVariants}
              onCheckedChange={(checked) => setForm({ ...form, enableProductVariants: checked })}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">Auto-print receipt</p>
              <p className="text-sm text-muted-foreground">Prompt to print after each sale</p>
            </div>
            <Switch
              checked={form.autoPrintReceipt}
              onCheckedChange={(checked) => setForm({ ...form, autoPrintReceipt: checked })}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
            <div className="min-w-0">
              <p className="font-medium">Low stock alerts</p>
              <p className="text-sm text-muted-foreground">Warn when stock falls below a threshold</p>
            </div>
            <Switch
              checked={form.enableLowStockAlerts}
              onCheckedChange={(checked) => setForm({ ...form, enableLowStockAlerts: checked })}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Low stock threshold</label>
            <Input
              inputMode="numeric"
              value={form.lowStockThreshold}
              onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
              className="h-11"
              disabled={!form.enableLowStockAlerts}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Receipt footer message</label>
            <Textarea
              value={form.receiptFooterMessage}
              onChange={(e) => setForm({ ...form, receiptFooterMessage: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all system data?</DialogTitle>
            <DialogDescription>
              This removes all products, sales, and non-admin users for this shop. The admin account and shop settings stay in place.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Type CLEAR to confirm</label>
            <Input
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              className="h-11"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResetOpen(false);
                setResetConfirm("");
              }}
              className="h-11"
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={resetSystemData}
              className="h-11 font-semibold"
              disabled={isResetting || resetConfirm.trim().toUpperCase() !== "CLEAR"}
            >
              {isResetting ? "Clearing..." : "Clear data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
