import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary text-primary-foreground flex-col justify-between p-12">
        <div className="relative z-10 flex flex-col gap-10">
          <div>
            <div className="flex items-center gap-4 mb-8">
              <img
                src="/Jilkem%20Logo.jpeg"
                alt="Jilkem Company Limited logo"
                className="h-12 w-auto rounded-2xl border border-white/10 bg-white/10 p-1"
              />
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-accent-foreground/80">JILKEM</p>
                <p className="text-xl font-semibold">Jilkem Company Limited</p>
              </div>
            </div>

            <p className="max-w-sm text-sm leading-7 text-primary-foreground/80">
              Focused shop management for inventory, sales, staff, and daily reporting.
            </p>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/5">
              <h3 className="text-xl font-semibold mb-2">Inventory Control</h3>
              <p className="text-sm opacity-80">Inventory, sales, and reports in one place.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/5">
              <h3 className="text-xl font-semibold mb-2">Built for Jilkem</h3>
              <p className="text-sm opacity-80">A single workspace for Samuel Kissi and the shop team.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/5">
              <h3 className="text-xl font-semibold mb-2">Fast POS</h3>
              <p className="text-sm opacity-80">Optimize for quick, efficient transactions.</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-sm opacity-80">
          Jilkem Company Limited - reliable records for everyday shop operations.
        </p>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <div className="p-8">
            <div className="lg:hidden mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card">
                <img
                  src="/Jilkem%20Logo.jpeg"
                  alt="Jilkem Company Limited logo"
                  className="h-9 w-9 object-contain"
                />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">Jilkem</p>
                <p className="text-sm text-muted-foreground">Company Limited</p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">{title}</h2>
              {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
            </div>

            {children}
          </div>
        </Card>
      </div>
    </div>
  );
}
