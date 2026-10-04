import { Router } from "express";
import * as XLSX from "xlsx";
import { prisma } from "../../lib/prisma";
import { requireStaffAuth, requirePermission } from "../../middleware/auth";
import { writeAuditLog } from "../../middleware/audit";
import { compareSecret } from "../../lib/hash";

const router = Router();
router.use(requireStaffAuth);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 9.3.1 Finance Dashboard — all figures are read-only aggregations from Payments/Expenses.
router.get("/summary", requirePermission("finance.read"), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const [paidToday, paidMonth, outstanding, insuranceReceivables, expensesMonth] = await Promise.all([
      prisma.payment.aggregate({ where: { tenantId, status: { in: ["paid", "partially_paid"] }, createdAt: { gte: startOfToday() } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { tenantId, status: { in: ["paid", "partially_paid"] }, createdAt: { gte: startOfMonth() } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { tenantId, status: "partially_paid" }, _sum: { balance: true } }),
      prisma.payment.aggregate({ where: { tenantId, status: "covered_by_insurance", insuranceReconciled: false }, _sum: { expectedInsuranceAmount: true } }),
      prisma.expense.aggregate({ where: { tenantId, date: { gte: startOfMonth() } }, _sum: { amount: true } }),
    ]);

    const revenueToday = paidToday._sum.amount || 0;
    const revenueMonth = paidMonth._sum.amount || 0;
    const expenses = expensesMonth._sum.amount || 0;

    // 30-day trend
    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - 30);
    const recentPayments = await prisma.payment.findMany({
      where: { tenantId, status: { in: ["paid", "partially_paid"] }, createdAt: { gte: trendStart } },
      select: { amount: true, createdAt: true },
    });
    const trendMap = new Map<string, number>();
    for (const p of recentPayments) {
      const key = p.createdAt.toISOString().slice(0, 10);
      trendMap.set(key, (trendMap.get(key) || 0) + (p.amount || 0));
    }

    res.json({
      revenueToday,
      revenueThisMonth: revenueMonth,
      outstandingPayments: outstanding._sum.balance || 0,
      insuranceReceivables: insuranceReceivables._sum.expectedInsuranceAmount || 0,
      expenses,
      netCashPosition: revenueMonth - expenses,
      trend: Array.from(trendMap.entries()).map(([date, amount]) => ({ date, amount })),
    });
  } catch (err) {
    next(err);
  }
});

// 9.3.2 Record Expense — PIN re-authorisation independent of session token (Section 14).
router.post("/expenses", requirePermission("finance.record_expense"), async (req, res, next) => {
  try {
    const { category, description, amount, date, pin } = req.body;
    if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ error: "Amount must be a positive number" });
    const expenseDate = new Date(date);
    if (expenseDate > new Date()) return res.status(400).json({ error: "Expense date cannot be in the future" });

    const staff = await prisma.staff.findUnique({ where: { id: req.staff!.id } });
    const pinOk = staff && (await compareSecret(pin || "", staff.pinHash));
    if (!pinOk) return res.status(401).json({ error: "Incorrect PIN. Expense was not saved." });

    const expense = await prisma.expense.create({
      data: { tenantId: req.tenantId!, category, description, amount, date: expenseDate, recordedByStaffId: req.staff!.id },
    });
    await writeAuditLog({ tenantId: req.tenantId, staffId: req.staff!.id, actionType: "expense.create", entityType: "Expense", entityId: expense.id });
    res.status(201).json({ expense });
  } catch (err) {
    next(err);
  }
});

router.get("/expenses", requirePermission("finance.read"), async (req, res, next) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { tenantId: req.tenantId! },
      include: { recordedBy: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 200,
    });
    res.json({ expenses });
  } catch (err) {
    next(err);
  }
});

// Insurance reconciliation (Section 17.2 edge case): partial reconciliation leaves a residual receivable.
router.post("/payments/:id/reconcile-insurance", requirePermission("finance.record_expense"), async (req, res, next) => {
  try {
    const { reconciledAmount } = req.body;
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: { insuranceReconciledAmount: reconciledAmount, insuranceReconciled: true },
    });
    await writeAuditLog({ tenantId: req.tenantId, staffId: req.staff!.id, actionType: "payment.reconcile_insurance", entityType: "Payment", entityId: payment.id });
    res.json({ payment });
  } catch (err) {
    next(err);
  }
});

// 9.3.3 Export Reports — Excel export with date-range filter.
router.get("/export", requirePermission("finance.export"), async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : startOfMonth();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({ where: { tenantId: req.tenantId!, createdAt: { gte: from, lte: to } }, include: { visit: { include: { patient: true } } } }),
      prisma.expense.findMany({ where: { tenantId: req.tenantId!, date: { gte: from, lte: to } }, include: { recordedBy: true } }),
    ]);

    const wb = XLSX.utils.book_new();
    const revenueSheet = XLSX.utils.json_to_sheet(
      payments.map((p) => ({
        Patient: p.visit.patient.name, Status: p.status, Amount: p.amount, Balance: p.balance,
        Method: p.method, InsuranceProvider: p.insuranceProvider, ExpectedInsurance: p.expectedInsuranceAmount, Date: p.createdAt,
      }))
    );
    const expenseSheet = XLSX.utils.json_to_sheet(
      expenses.map((e) => ({ Category: e.category, Description: e.description, Amount: e.amount, Date: e.date, RecordedBy: e.recordedBy.name }))
    );
    XLSX.utils.book_append_sheet(wb, revenueSheet, "Revenue & Payments");
    XLSX.utils.book_append_sheet(wb, expenseSheet, "Expenses");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=ihops-finance-export.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
