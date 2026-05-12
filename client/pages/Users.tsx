import { useMemo, useState } from "react";
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
import type { UserRole } from "@shared/bektix";
import { Plus, Shield, Trash2, User as UserIcon } from "lucide-react";

type NewUserDraft = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

const emptyDraft: NewUserDraft = {
  name: "",
  email: "",
  password: "",
  role: "cashier",
};

function roleBadge(role: UserRole) {
  if (role === "admin") return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Admin</Badge>;
  if (role === "cashier") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Cashier</Badge>;
  return <Badge variant="secondary">Staff</Badge>;
}

export default function Users() {
  const { user, users, actions } = useBektix();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<NewUserDraft>(emptyDraft);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedSearch) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(normalizedSearch) || u.email.toLowerCase().includes(normalizedSearch),
    );
  }, [normalizedSearch, users]);

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
      await actions.addUser({ name, email, password, role: draft.role });
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

  if (user?.role !== "admin") {
    return (
      <AppShell title="Users" description="Manage team members, roles, and access." active="users">
        <Card className="p-6">
          <p className="text-lg font-semibold">Admins only</p>
          <p className="mt-2 text-sm text-muted-foreground">
            User management is only available to the Jilkem owner account (Admin role).
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Users" description="Invite staff and manage permissions." active="users">
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
          className="h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add User
        </Button>
      </div>

      <Card className="mt-6 overflow-hidden">
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
                  {u.status === "active" ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Inactive</Badge>
                  )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Invite a staff member to Jilkem.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Full name</label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
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
