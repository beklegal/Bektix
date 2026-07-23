import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home } from "lucide-react";
import { useBektix } from "@/lib/bektix/context";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  const { session } = useBektix();
  const isLoggedIn = Boolean(session);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <div className="p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card">
              <img
                src="/BEKTIX%20LOGO.png"
                alt="BEKTIX logo"
                className="h-10 w-10 object-contain"
              />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
          <p className="text-muted-foreground mb-4">The page you’re looking for doesn’t exist.</p>

          <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-muted-foreground">
              Check the URL, or use the navigation to return to a working page.
            </p>
          </div>

          <div className="space-y-3">
            {isLoggedIn && (
              <Button
                onClick={() => navigate("/dashboard")}
                className="w-full h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base"
              >
                <Home className="h-5 w-5 mr-2" />
                Back to Dashboard
              </Button>
            )}
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full h-11 font-semibold text-base"
            >
              Back to Login
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            Route: <code className="bg-background px-2 py-1 rounded">{location.pathname}</code>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default NotFound;