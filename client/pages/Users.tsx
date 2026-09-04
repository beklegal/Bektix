import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useBektix } from "@/lib/bektix/context";
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
import type { User, UserRole } from "@shared/bektix";
import { KeyRound, Plus, Shield, Trash2, User as UserIcon } from "lucide-react";

type NewUserDraft = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  branchId: string;
  permissions: User["permissions"];
};

const emptyDraft: NewUserDraft = {
  name: "",
  email: "",
  password: "",
  role: "cashier",
  branchId: "",
  permissions: { manage_inventory: false, collect_payments: false },
};

function roleBadge(role: UserRole) {
  if (role === "admin") return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Admin</Badge>;
  if (role === "cashier") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Cashier</Badge>;
  return <Badge variant="secondary">Staff</Badge>;
}

function statusBadge(status: User["status"]) {
  return status === "active" ? (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Inactive</Badge>
  );
}

export default function Users() {
  const { user, users, branches, actions } = useBektix();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<NewUserDraft>(emptyDraft);
  const [searchParams] = useSearchParams();
  const selectedBranchId = searchParams.get("branch");

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = useMemo(() => {
    const branchFiltered = selectedBranchId ? users.filter((u) => u.branchId === selectedBranchId) : users;
    if (!normalizedSearch) return branchFiltered;
    return branchFiltered.filter(
      (u) => u.name.toLowerCase().includes(normalizedSearch) || u.email.toLowerCase().includes(normalizedSearch),
    );
  }, [normalizedSearch, selectedBranchId, users]);

  const openAdd = () => {
    setDraft(emptyDraft);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDraft(emptyDraft);
  };

  const saveUser = async () => {
    const name = draft.name.trim();
    const email = draft.email.trim();
    const password = draft.password;

    if (!name || !email || !password) {
      toast({ title: "Fill in all fields", variant: "destructive" });
      return;
    }
    if (!email.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }

    try {
      await actions.addUser({ name, email, password, role: draft.role, branchId: draft.branchId || undefined, permissions: draft.permissions });
      toast({ title: "User added" });
      closeDialog();
    } catch (err) {
      toast({
        title: "Could not add user",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleStatus = async (userId: string) => {
    try {
      await actions.toggleUserStatus(userId);
    } catch (err) {
      toast({
        title: "Could not update user",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeUser = async (userId: string) => {
    try {
      await actions.deleteUser(userId);
      toast({ title: "User deleted" });
    } catch (err) {
      toast({
        title: "Could not delete user",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetPassword = async (target: User) => {
    const password = window.prompt(`Set a new temporary password for ${target.name} (at least 8 characters):`);
    if (!password) return;
    if (password.length < 8) return toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
    try { await actions.resetUserPassword(target.id, password); toast({ title: "Password reset", description: `${target.name} must use the new password to sign in.` }); }
    catch (err) { toast({ title: "Could not reset password", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" }); }
  };

  const toggleInventoryAccess = async (target: User) => {
    try { await actions.updateUserAccess(target.id, { permissions: { ...target.permissions, manage_inventory: !target.permissions.manage_inventory } }); toast({ title: target.permissions.manage_inventory ? "Inventory access removed" : "Inventory access granted" }); }
    catch (err) { toast({ title: "Could not update access", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" }); }
  };

  if (user?.role !== "admin") {
    return (
      <AppShell title="Users" description="Manage team members, roles, and access." active="users">
        <Card className="p-6">
          <p className="text-lg font-semibold">Admins only</p>
          <p className="mt-2 text-sm text-muted-foreground">
            User management is only available to the BEKTIX owner account (Admin role).
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Users" description="Invite staff and manage permissions." active="users">
      {selectedBranchId && <Card className="mb-5 border-accent/30 bg-accent/5 p-4 text-sm"><span className="font-semibold">Branch team view:</span> {branches.find((branch) => branch.id === selectedBranchId)?.name || "Selected branch"}. This lists the team granted access for this branch.</Card>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <UserIcon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="h-11 pl-10"
          />
        </div>
        <Button
          onClick={openAdd}
          className="h-11 w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold sm:w-auto"
        >
          <Plus className="h-5 w-5 mr-2" />
          Grant system access
        </Button>
      </div>

      <div className="mt-6 grid gap-3 lg:hidden">
        {filtered.map((u) => (
          <Card key={u.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{u.name}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {roleBadge(u.role)}
                {statusBadge(u.status)}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Joined {new Date(u.createdAt).toLocaleDateString()}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => toggleStatus(u.id)}
                  disabled={u.role === "admin"}
                  title={u.role === "admin" ? "Admin cannot be deactivated" : "Toggle active status"}
                >
                  <Shield className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => removeUser(u.id)}
                  disabled={u.role === "admin"}
                  title={u.role === "admin" ? "Admin cannot be deleted" : "Delete user"}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No users found.
          </Card>
        )}
      </div>

      <Card className="mt-6 hidden overflow-hidden lg:block">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>{roleBadge(u.role)}</TableCell>
                <TableCell>
                  {statusBadge(u.status)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 px-3"
                      onClick={() => toggleStatus(u.id)}
                      disabled={u.role === "admin"}
                      title={u.role === "admin" ? "Admin cannot be deactivated" : "Toggle active status"}
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      {u.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-10 px-3" onClick={() => toggleInventoryAccess(u)} disabled={u.role === "admin"}>
                      {u.permissions.manage_inventory ? "Remove inventory" : "Grant inventory"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-10 px-3" onClick={() => resetPassword(u)} disabled={u.id === user?.id}>
                      <KeyRound className="mr-2 h-4 w-4" />Reset password
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => removeUser(u.id)}
                      disabled={u.role === "admin"}
                      title={u.role === "admin" ? "Admin cannot be deleted" : "Delete user"}
                    >
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
                    No users found.
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="mt-6 p-6 bg-muted/40">
        <p className="text-lg font-semibold">Role permissions</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="font-semibold text-purple-600">Admin</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>✓ Full access</li>
              <li>✓ Manage users</li>
              <li>✓ Reports & settings</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-blue-600">Cashier</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>✓ POS checkout</li>
              <li>✓ View inventory</li>
              <li>✓ Print receipts</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground">Staff</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>✓ View inventory</li>
              <li>✓ Limited POS</li>
              <li>✗ No reports/users</li>
            </ul>
          </div>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant system access</DialogTitle>
            <DialogDescription>Create a sign-in for a branch admin, cashier, or staff member and assign their branch access.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Full name</label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="grid gap-2 rounded-lg border border-border p-3">
              <label className="text-sm font-medium">System permissions</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.permissions.manage_inventory} onChange={(e) => setDraft({ ...draft, permissions: { ...draft.permissions, manage_inventory: e.target.checked } })} />Add and manage products / inventory</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.permissions.collect_payments} onChange={(e) => setDraft({ ...draft, permissions: { ...draft.permissions, collect_payments: e.target.checked } })} />Collect money through POS</label>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Temporary password</label>
              <Input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Role</label>
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="cashier">Cashier</option>
                <option value="staff">Staff</option>
                {!user?.branchId && <option value="admin">Branch admin</option>}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Assigned branch (optional)</label>
              <select value={draft.branchId} onChange={(e) => setDraft({ ...draft, branchId: e.target.value })} className="h-11 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Business-wide / unassigned</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.location ? ` — ${branch.location}` : ""}</option>)}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="h-11">
              Cancel
            </Button>
            <Button onClick={saveUser} className="h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
              Add user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
