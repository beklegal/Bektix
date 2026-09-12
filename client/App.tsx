import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import Debtors from "./pages/Debtors";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Receipt from "./pages/Receipt";
import AppsServices from "./pages/AppsServices";
import Payroll from "./pages/Payroll";
import Creditors from "./pages/Creditors";
import Banking from "./pages/Banking";
import SuperAdmin from "./pages/SuperAdmin";
import Customers from "./pages/Customers";
import Storefront from "./pages/Storefront";
import BusinessHub from "./pages/BusinessHub";
import { BektixProvider } from "@/lib/bektix/context";
import RequireAuth from "@/components/RequireAuth";
import RequireAdmin from "@/components/RequireAdmin";
import RequireTenant from "@/components/RequireTenant";
import RequireFeature from "@/components/RequireFeature";
import RequireSuperAdmin from "@/components/RequireSuperAdmin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BektixProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/store/:slug" element={<Storefront />} />
            <Route
              path="/super-admin"
              element={
                <RequireAuth>
                  <RequireSuperAdmin>
                    <SuperAdmin />
                  </RequireSuperAdmin>
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <RequireTenant>
                    <Dashboard />
                  </RequireTenant>
                </RequireAuth>
              }
            />
            <Route
              path="/inventory"
              element={
                <RequireAuth>
                  <RequireTenant>
                    <Inventory />
                  </RequireTenant>
                </RequireAuth>
              }
            />
            <Route
              path="/sales"
              element={
                <RequireAuth>
                  <RequireTenant>
                    <Sales />
                  </RequireTenant>
                </RequireAuth>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireAuth>
                  <RequireFeature feature="reports">
                    <Reports />
                  </RequireFeature>
                </RequireAuth>
              }
            />
            <Route
              path="/debtors"
              element={
                <RequireAuth>
                  <RequireFeature feature="debtors">
                    <Debtors />
                  </RequireFeature>
                </RequireAuth>
              }
            />
            <Route
              path="/users"
              element={
                <RequireAuth>
                  <RequireFeature feature="users">
                    <Users />
                  </RequireFeature>
                </RequireAuth>
              }
            />
            <Route
              path="/business-hub"
              element={<RequireAuth><RequireAdmin><RequireTenant><BusinessHub /></RequireTenant></RequireAdmin></RequireAuth>}
            />
            <Route
              path="/apps-services"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <RequireTenant>
                      <AppsServices />
                    </RequireTenant>
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route
              path="/payroll"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <RequireFeature feature="payroll">
                      <Payroll />
                    </RequireFeature>
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route
              path="/creditors"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <RequireFeature feature="creditors">
                      <Creditors />
                    </RequireFeature>
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route
              path="/banking"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <RequireFeature feature="banking">
                      <Banking />
                    </RequireFeature>
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route
              path="/customers"
              element={<RequireAuth><RequireTenant><Customers /></RequireTenant></RequireAuth>}
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <RequireTenant>
                    <Settings />
                  </RequireTenant>
                </RequireAuth>
              }
            />
            <Route
              path="/receipt/:saleId"
              element={
                <RequireAuth>
                  <RequireTenant>
                    <Receipt />
                  </RequireTenant>
                </RequireAuth>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </BektixProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
