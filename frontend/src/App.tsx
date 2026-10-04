import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";

import TenantLayout from "./layouts/TenantLayout";
import SuperAdminLayout from "./layouts/SuperAdminLayout";

import Homepage from "./pages/marketing/Homepage";
import AboutPage from "./pages/marketing/AboutPage";
import ServicesPage from "./pages/marketing/ServicesPage";
import PricingPage from "./pages/marketing/PricingPage";
import ContactPage from "./pages/marketing/ContactPage";
import PrivacyPolicyPage from "./pages/marketing/PrivacyPolicyPage";
import Signup from "./pages/onboarding/Signup";
import CheckEmail from "./pages/onboarding/CheckEmail";
import VerifyEmail from "./pages/onboarding/VerifyEmail";
import Login from "./pages/onboarding/Login";
import ChangePin from "./pages/onboarding/ChangePin";
import AccountRestricted from "./pages/onboarding/AccountRestricted";
import SetupWizard from "./pages/onboarding/SetupWizard";

import Dashboard from "./pages/dashboard/Dashboard";
import PatientDirectory from "./pages/patients/PatientDirectory";
import PatientRegistration from "./pages/patients/PatientRegistration";
import PatientProfile from "./pages/patients/PatientProfile";
import ImportWizard from "./pages/patients/ImportWizard";
import FamiliesPage from "./pages/families/FamilyPage";
import VisitQueue from "./pages/visits/VisitQueue";
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import StaffDirectory from "./pages/workforce/StaffDirectory";
import Attendance from "./pages/workforce/Attendance";
import AdminHome from "./pages/admin/AdminHome";
import Subscription from "./pages/admin/Subscription";
import Settings from "./pages/admin/Settings";
import Support from "./pages/admin/Support";
import CommunicationPage from "./pages/communication/CommunicationPage";
import ReportsPage from "./pages/reports/ReportsPage";

import SuperAdminLogin from "./pages/superadmin/SuperAdminLogin";
import ApprovalQueue from "./pages/superadmin/ApprovalQueue";
import TenantMonitoring from "./pages/superadmin/TenantMonitoring";
import Analytics from "./pages/superadmin/Analytics";
import Announcements from "./pages/superadmin/Announcements";
import SupportRequests from "./pages/superadmin/SupportRequests";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/change-pin" element={<ChangePin />} />
          <Route path="/setup" element={<SetupWizard />} />
          <Route path="/account-restricted" element={<AccountRestricted />} />

          <Route path="/app" element={<TenantLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="patients" element={<PatientDirectory />} />
            <Route path="patients/new" element={<PatientRegistration />} />
            <Route path="patients/import" element={<ImportWizard />} />
            <Route path="patients/:id" element={<PatientProfile />} />
            <Route path="families" element={<FamiliesPage />} />
            <Route path="visits" element={<VisitQueue />} />
            <Route path="communication" element={<CommunicationPage />} />
            <Route path="finance" element={<FinanceDashboard />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="workforce" element={<StaffDirectory />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="admin" element={<AdminHome />} />
            <Route path="admin/subscription" element={<Subscription />} />
            <Route path="admin/settings" element={<Settings />} />
            <Route path="admin/support" element={<Support />} />
          </Route>

          <Route path="/internal/login" element={<SuperAdminLogin />} />
          <Route path="/internal" element={<SuperAdminLayout />}>
            <Route index element={<Navigate to="approvals" replace />} />
            <Route path="approvals" element={<ApprovalQueue />} />
            <Route path="tenants" element={<TenantMonitoring />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="support" element={<SupportRequests />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
