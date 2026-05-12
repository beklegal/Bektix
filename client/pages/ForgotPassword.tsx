import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AuthShell from "@/components/AuthShell";

export default function ForgotPassword() {
  const navigate = useNavigate();

  return (
    <AuthShell title="Forgot password" subtitle="Password reset is managed by the Jilkem owner account.">
      <Button
        type="button"
        variant="ghost"
        className="mb-2 -ml-2 h-10 justify-start px-2 text-accent"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="rounded-2xl border border-border bg-muted p-5 text-left text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Password reset isn’t available from this screen yet.</p>
        <p className="mt-1">
          Please contact Samuel Kissi or an admin user to reset your password or create a replacement account for you.
        </p>
      </div>

      <Button
        asChild
        className="mt-4 h-11 w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
      >
        <Link to="/">Return to Login</Link>
      </Button>
    </AuthShell>
  );
}
