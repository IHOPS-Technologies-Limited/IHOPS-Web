import express from "express";
import cors from "cors";
import { errorHandler, notFound } from "./middleware/errorHandler";

import authRoutes from "./modules/auth/routes";
import setupRoutes from "./modules/auth/setup";
import patientsRoutes from "./modules/patients/routes";
import visitsRoutes from "./modules/visits/routes";
import financeRoutes from "./modules/finance/routes";
import workforceRoutes from "./modules/workforce/routes";
import subscriptionRoutes from "./modules/subscription/routes";
import smsWalletRoutes from "./modules/sms-wallet/routes";
import communicationsRoutes from "./modules/communications/routes";
import dashboardRoutes from "./modules/dashboard/routes";
import supportRoutes from "./modules/support/routes";
import superadminRoutes from "./modules/superadmin/routes";
// Added for Module 5 (Clinical Documentation & Medical Record + Restricted
// AI Communication Engine) — see modules/clinical and modules/ai-communication.
import clinicalRoutes from "./modules/clinical/routes";
import aiCommunicationRoutes from "./modules/ai-communication/routes";
// Added for the marketing site's Contact page — public, unauthenticated.
import publicRoutes from "./modules/public/routes";
// New — Family/household management (create, view, add/remove members).
import familiesRoutes from "./modules/families/routes";

export const app = express();

app.use(cors());
// The `verify` callback stashes the raw request bytes on req.rawBody before
// JSON-parsing populates req.body. This is required for the Paystack
// webhook: HMAC signature verification needs to hash the *exact* bytes
// Paystack sent, and JSON.stringify(req.body) is not guaranteed to
// reproduce that byte-for-byte (key order, number formatting, whitespace
// can all differ) — using the parsed-and-reserialized body would make
// every real signature check fail once PAYSTACK_ENABLED=true. Every other
// route just ignores rawBody and uses req.body as before.
app.use(
  express.json({
    limit: "5mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);

app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "ihops-backend" }),
);

// Tenant-facing API
app.use("/api/auth", authRoutes);
app.use("/api/auth", setupRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/families", familiesRoutes);
app.use("/api/visits", visitsRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/workforce", workforceRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/sms-wallet", smsWalletRoutes);
app.use("/api/communications", communicationsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/support-tickets", supportRoutes);

// Module 5 additions. /api/ai-communication is intentionally a sibling of,
// not nested under, /api/clinical — see modules/ai-communication/routes.ts.
app.use("/api/clinical", clinicalRoutes);
app.use("/api/ai-communication", aiCommunicationRoutes);
app.use("/api/public", publicRoutes);

// IHOPS Super Admin Portal — separate path, separate auth (Section 9.6).
app.use("/api/internal", superadminRoutes);

app.use(notFound);
app.use(errorHandler);
