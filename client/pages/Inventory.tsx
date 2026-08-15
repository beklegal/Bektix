import { useEffect, useMemo, useState } from "react";
import type { Product } from "@shared/bektix";
import AppShell from "@/components/AppShell";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBektix } from "@/lib/bektix/context";
import { formatMoney } from "@/lib/bektix/format";
import { AlertTriangle, Edit2, Package, Plus, Search, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

type ProductDraft = {
  name: string;
  category: string;
  quantity: string;
  costPrice: string;
  sellingPrice: string;
  expiryDate: string;
  size: string;
  color: string;
  warranty: string;
  branchId: string;
};

const emptyDraft: ProductDraft = {
  name: "",
  category: "General",
  quantity: "0",
  costPrice: "0",
  sellingPrice: "0",
  expiryDate: "",
  size: "",
  color: "",
  warranty: "",
  branchId: "",
};

function statusForProduct(product: Product, lowStockThreshold: number) {
  if (product.quantity <= 0) return "out";
  if (product.quantity <= lowStockThreshold) return "low";
  return "in";
}

function productToDraft(product: Product): ProductDraft {
  return {
    name: product.name,
    category: product.category,
    quantity: String(product.quantity),
    costPrice: String(product.costPrice),
    sellingPrice: String(product.sellingPrice),
    expiryDate: product.expiryDate ?? "",
    size: product.size ?? "",
    color: product.color ?? "",
    warranty: product.warranty ?? "",
    branchId: product.branchId ?? "",
  };
}

function productVariantText(product: Product) {
  const details = [product.size && `Size: ${product.size}`, product.color && `Color: ${product.color}`].filter(Boolean);
  return details.join(" • ");
}

export default function Inventory() {
  const { shop, user, branches, products, actions } = useBektix();
  const currency = shop?.preferences.currency || "GH₵";
  const lowStockThreshold = shop?.preferences.lowStockThreshold ?? 10;
  const enableExpiryTracking = shop?.preferences.enableExpiryTracking ?? true;
  const enableProductVariants = shop?.preferences.enableProductVariants ?? true;

  const [searchTerm, setSearchTerm] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setEditingId(null);
    setDraft(emptyDraft);
    setDialogOpen(true);

    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedSearch) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(normalizedSearch) ||
        p.category.toLowerCase().includes(normalizedSearch) ||
        (p.size ?? "").toLowerCase().includes(normalizedSearch) ||
        (p.color ?? "").toLowerCase().includes(normalizedSearch),
    );
  }, [normalizedSearch, products]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const stats = useMemo(() => {
    const outOfStock = products.filter((p) => p.quantity <= 0).length;
    const lowStock = products.filter((p) => p.quantity > 0 && p.quantity <= lowStockThreshold).length;
    return { total: products.length, outOfStock, lowStock };
  }, [lowStockThreshold, products]);

  const openAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setDraft(productToDraft(product));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const saveProduct = async () => {
    if (!shop) return;

    const name = draft.name.trim();
    const category = draft.category.trim();
    const quantity = Number.parseInt(draft.quantity, 10);
    const costPrice = Number.parseFloat(draft.costPrice);
    const sellingPrice = Number.parseFloat(draft.sellingPrice);

    if (!name) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }
    if (!category) {
      toast({ title: "Category is required", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast({ title: "Quantity must be 0 or more", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      toast({ title: "Cost price must be 0 or more", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      toast({ title: "Selling price must be 0 or more", variant: "destructive" });
      return;
    }

    try {
      if (editingId) {
        await actions.updateProduct(editingId, {
          name,
          category,
          quantity,
          costPrice,
          sellingPrice,
          expiryDate: enableExpiryTracking ? draft.expiryDate || undefined : undefined,
          size: enableProductVariants ? draft.size || undefined : undefined,
          color: enableProductVariants ? draft.color || undefined : undefined,
          warranty: draft.warranty || undefined,
          branchId: draft.branchId || undefined,
        });
        toast({ title: "Product updated" });
      } else {
        await actions.addProduct({
          shopId: shop.id,
          branchId: draft.branchId || undefined,
          name,
          category,
          quantity,
          costPrice,
          sellingPrice,
          expiryDate: enableExpiryTracking ? draft.expiryDate || undefined : undefined,
          size: enableProductVariants ? draft.size || undefined : undefined,
          color: enableProductVariants ? draft.color || undefined : undefined,
          warranty: draft.warranty || undefined,
        });
        toast({ title: "Product added" });
      }
      closeDialog();
    } catch (err) {
      toast({
        title: "Could not save product",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeProduct = async (product: Product) => {
    try {
      await actions.deleteProduct(product.id);
      toast({ title: "Product deleted" });
    } catch (err) {
      toast({
        title: "Could not delete product",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AppShell
      title="Inventory"
      description="Manage products, stock levels, and low stock alerts."
      active="inventory"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Total products</p>
          <p className="mt-2 text-2xl font-semibold">{stats.total}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Low stock</p>
          <p className="mt-2 text-2xl font-semibold">{stats.lowStock}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Out of stock</p>
          <p className="mt-2 text-2xl font-semibold">{stats.outOfStock}</p>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products by name or category..."
            className="h-11 pl-10"
          />
        </div>
        <Button
          onClick={openAdd}
          className="h-11 w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold sm:w-auto"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Mobile cards */}
      <div className="mt-6 grid gap-3 md:hidden">
        {sorted.map((product) => {
          const status = statusForProduct(product, lowStockThreshold);
          const variantText = productVariantText(product);
          return (
            <Card key={product.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{product.category}</p>
                  {variantText && <p className="mt-1 text-sm text-muted-foreground">{variantText}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(product)} className="h-10 w-10">
                    <Edit2 className="h-4 w-4 text-accent" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeProduct(product)} className="h-10 w-10">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Qty</p>
                  <p className="font-semibold">{product.quantity}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cost</p>
                  <p className="font-semibold">{formatMoney(product.costPrice, currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Price</p>
                  <p className="font-semibold">{formatMoney(product.sellingPrice, currency)}</p>
                </div>
              </div>

              <div className="mt-4">
                {status === "in" && <Badge variant="secondary">In stock</Badge>}
                {status === "low" && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Low stock
                  </Badge>
                )}
                {status === "out" && (
                  <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">
                    Out of stock
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}

        {sorted.length === 0 && (
          <Card className="p-8 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No products found.</p>
            <Button className="mt-4" variant="outline" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first product
            </Button>
          </Card>
        )}
      </div>

      {/* Desktop table */}
      <Card className="mt-6 hidden overflow-hidden md:block">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Size / Color</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((product) => {
              const status = statusForProduct(product, lowStockThreshold);
              const variantText = productVariantText(product);
              return (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.category}</TableCell>
                  <TableCell className="text-muted-foreground">{variantText || "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{product.quantity}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatMoney(product.costPrice, currency)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatMoney(product.sellingPrice, currency)}
                  </TableCell>
                  <TableCell className="text-center">
                    {status === "in" && <Badge variant="secondary">In stock</Badge>}
                    {status === "low" && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Low
                      </Badge>
                    )}
                    {status === "out" && (
                      <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">
                        Out
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(product)} className="h-10 w-10">
                        <Edit2 className="h-4 w-4 text-accent" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeProduct(product)} className="h-10 w-10">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="p-8 text-center">
                    <Package className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">No products found.</p>
                    <Button className="mt-4" variant="outline" onClick={openAdd}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add your first product
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update stock or pricing." : "Add a new product and choose the branch holding this stock."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Product name *</label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Category *</label>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option>General</option>
                <option>Medicine</option>
                <option>Supplements</option>
                <option>First Aid</option>
                <option>Grocery</option>
                <option>Clothing</option>
                <option>Electronics</option>
                <option>Other</option>
              </select>
            </div>
            {!editingId && !user?.branchId && <div className="grid gap-2">
              <label className="text-sm font-medium">Inventory branch *</label>
              <select value={draft.branchId} onChange={(e) => setDraft({ ...draft, branchId: e.target.value })} className="h-11 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Main branch</option>
                {branches.filter((branch) => branch.status === "active").map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.location ? ` — ${branch.location}` : ""}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Branch stock is separate from the main branch and other branches.</p>
            </div>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Quantity *</label>
                <Input
                  inputMode="numeric"
                  value={draft.quantity}
                  onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Cost ({currency}) *</label>
                <Input
                  inputMode="decimal"
                  value={draft.costPrice}
                  onChange={(e) => setDraft({ ...draft, costPrice: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Price ({currency}) *</label>
                <Input
                  inputMode="decimal"
                  value={draft.sellingPrice}
                  onChange={(e) => setDraft({ ...draft, sellingPrice: e.target.value })}
                />
              </div>
            </div>

            {enableExpiryTracking && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Expiry date</label>
                <Input
                  type="date"
                  value={draft.expiryDate}
                  onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })}
                />
              </div>
            )}

            {enableProductVariants && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Size</label>
                  <Input value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Color</label>
                  <Input value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <label className="text-sm font-medium">Warranty</label>
              <Input value={draft.warranty} onChange={(e) => setDraft({ ...draft, warranty: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="h-11">
              Cancel
            </Button>
            <Button onClick={saveProduct} className="h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
              {editingId ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
