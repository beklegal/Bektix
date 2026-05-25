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
import { BektixProvider } from "@/lib/bektix/context";
import RequireAuth from "@/components/RequireAuth";
import RequireAdmin from "@/components/RequireAdmin";

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
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/inventory"
              element={
                <RequireAuth>
                  <Inventory />
                </RequireAuth>
              }
            />
            <Route
              path="/sales"
              element={
                <RequireAuth>
                  <Sales />
                </RequireAuth>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireAuth>
                  <Reports />
                </RequireAuth>
              }
            />
            <Route
              path="/debtors"
              element={
                <RequireAuth>
                  <Debtors />
                </RequireAuth>
              }
            />
            <Route
              path="/users"
              element={
                <RequireAuth>
                  <Users />
                </RequireAuth>
              }
            />
            <Route
              path="/apps-services"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <AppsServices />
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route
              path="/payroll"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <Payroll />
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route
              path="/creditors"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <Creditors />
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route
              path="/banking"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <Banking />
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <Settings />
                </RequireAuth>
              }
            />
            <Route
              path="/receipt/:saleId"
              element={
                <RequireAuth>
                  <Receipt />
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
