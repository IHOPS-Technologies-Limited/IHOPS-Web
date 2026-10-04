import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import * as XLSX from "xlsx";
import { prisma } from "../../lib/prisma";
import { requireStaffAuth, requirePermission } from "../../middleware/auth";
import { writeAuditLog } from "../../middleware/audit";
import { generatePlatformPatientId } from "../../lib/ids";
import { createPatientSchema, updatePatientSchema } from "./schemas";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(requireStaffAuth);

// Fuzzy-ish duplicate check on name + phone + dob (Section 17.1: warn, never block).
async function findPossibleDuplicates(
  tenantId: string,
  name: string,
  phone: string | undefined,
  dob: Date,
) {
  return prisma.patient.findMany({
    where: {
      tenantId,
      dob,
      OR: [
        { name: { equals: name } },
        phone ? { phone: { equals: phone } } : undefined,
      ].filter(Boolean) as any,
    },
    take: 5,
  });
}

// 9.2.2 Patient Directory — searchable/filterable list
//
// `status` (active/inactive/deceased) is a real, staff-editable field as of
// this update — filtered directly in the DB query below. Everything else
// (age, lastVisit, visitCount, hasOutstanding) is still computed in-memory
// after a single scoped query, since SQLite can't cheaply express "age
// bucket" or "visit count > 1" in a WHERE clause. Fine at hospital scale
// (hundreds-to-low-thousands of patients); if a tenant grows well beyond
// that, this is the first place to move to raw SQL aggregation.
router.get("/", requirePermission("patients.read"), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const q = String(req.query.q || "").trim();
    const genderFilter = String(req.query.gender || "all");
    const statusFilter = String(req.query.status || "all"); // all|active|inactive|deceased
    const ageGroup = String(req.query.ageGroup || "all"); // all|0-17|18-35|36-60|60+
    const patientType = String(req.query.patientType || "all"); // all|new|returning
    const hasOutstanding = req.query.hasOutstanding === "true";
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(req.query.pageSize) || 10),
    );

    const where: any = { tenantId };
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { hospitalCardNumber: { contains: q } },
        { platformPatientId: { contains: q } },
      ];
    }
    if (genderFilter !== "all") where.gender = genderFilter;
    if (statusFilter !== "all") where.status = statusFilter;

    const all = await prisma.patient.findMany({
      where,
      include: {
        visits: {
          orderBy: { startedAt: "desc" },
          select: {
            startedAt: true,
            payment: { select: { status: true, balance: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let enriched = all.map((p) => {
      const lastVisit = p.visits[0]?.startedAt || null;
      const visitCount = p.visits.length;
      const age = ageFromDob(p.dob);
      const latestPayment = p.visits[0]?.payment;
      const outstanding =
        !!latestPayment &&
        (latestPayment.status === "not_paid" ||
          (latestPayment.status === "partially_paid" &&
            (latestPayment.balance || 0) > 0));
      return { ...p, lastVisit, visitCount, age, hasOutstanding: outstanding };
    });

    if (patientType === "new")
      enriched = enriched.filter((p) => p.createdAt >= startOfMonth);
    if (patientType === "returning")
      enriched = enriched.filter((p) => p.visitCount > 1);
    if (ageGroup !== "all")
      enriched = enriched.filter((p) => ageGroupOf(p.age) === ageGroup);
    if (hasOutstanding) enriched = enriched.filter((p) => p.hasOutstanding);

    const total = enriched.length;
    const startIdx = (page - 1) * pageSize;
    const pageItems = enriched.slice(startIdx, startIdx + pageSize);

    res.json({
      patients: pageItems.map((p) => ({
        id: p.id,
        name: p.name,
        hospitalCardNumber: p.hospitalCardNumber,
        phone: p.phone,
        platformPatientId: p.platformPatientId,
        gender: p.gender,
        age: p.age,
        lastVisit: p.lastVisit,
        paymentStatus: p.visits[0]?.payment?.status || null,
        status: p.status,
        bloodGroup: p.bloodGroup,
        hasOutstanding: p.hasOutstanding,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (err) {
    next(err);
  }
});

function ageFromDob(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
function ageGroupOf(age: number): string {
  if (age <= 17) return "0-17";
  if (age <= 35) return "18-35";
  if (age <= 60) return "36-60";
  return "60+";
}

// Patient Directory summary — stat cards, gender ratio, age-group breakdown,
// and quick-filter counts.
//   - "Active" / "Inactive" / "Deceased" now come directly from the real
//     Patient.status field (staff-editable via PATCH /:id) — this used to be
//     a recency guess ("visited in the last 12 months") before that field
//     existed.
//   - "Not Visited" moved out of the status donut (it would double-count
//     against status) and into quickFilters instead, where it means "zero
//     visits ever," independent of administrative status.
//   - "Outstanding Payments" comes from Payment.status/balance, not a
//     fabricated "priority" flag.
router.get(
  "/summary",
  requirePermission("patients.read"),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId!;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

      const [
        totalPatients,
        newThisMonth,
        families,
        statusCounts,
        patientsForStats,
        todaysVisits,
        thisWeeksVisits,
        outstandingPaymentsRaw,
      ] = await Promise.all([
        prisma.patient.count({ where: { tenantId } }),
        prisma.patient.count({
          where: { tenantId, createdAt: { gte: startOfMonth } },
        }),
        prisma.family.count({ where: { tenantId } }),
        prisma.patient.groupBy({
          by: ["status"],
          where: { tenantId },
          _count: { status: true },
        }),
        prisma.patient.findMany({
          where: { tenantId },
          select: {
            gender: true,
            dob: true,
            visits: {
              select: { startedAt: true },
              orderBy: { startedAt: "desc" },
            },
          },
        }),
        prisma.visit.count({
          where: { tenantId, startedAt: { gte: startOfToday } },
        }),
        prisma.visit.count({
          where: { tenantId, startedAt: { gte: startOfWeek } },
        }),
        prisma.payment.findMany({
          where: { tenantId, status: { in: ["not_paid", "partially_paid"] } },
          select: { visit: { select: { patientId: true } } },
        }),
      ]);

      let returningPatients = 0;
      let notVisited = 0;
      let male = 0;
      let female = 0;
      const ageBuckets: Record<string, number> = {
        "0-17": 0,
        "18-35": 0,
        "36-60": 0,
        "60+": 0,
      };

      for (const p of patientsForStats) {
        if (p.visits.length > 1) returningPatients++;
        if (p.visits.length === 0) notVisited++;
        if (p.gender === "Male") male++;
        if (p.gender === "Female") female++;
        ageBuckets[ageGroupOf(ageFromDob(p.dob))]++;
      }

      const genderTotal = male + female;
      const outstandingPatientIds = new Set(
        outstandingPaymentsRaw.map((p) => p.visit.patientId),
      );
      const statusMap: Record<string, number> = {
        active: 0,
        inactive: 0,
        deceased: 0,
      };
      for (const row of statusCounts) statusMap[row.status] = row._count.status;

      res.json({
        totalPatients,
        newThisMonth,
        activePatients: statusMap.active,
        returningPatients,
        families,
        genderRatio: {
          male,
          female,
          malePct: genderTotal ? Math.round((male / genderTotal) * 100) : 0,
          femalePct: genderTotal ? Math.round((female / genderTotal) * 100) : 0,
        },
        ageGroups: Object.entries(ageBuckets).map(([label, count]) => ({
          label,
          count,
          pct: totalPatients ? Math.round((count / totalPatients) * 100) : 0,
        })),
        patientSummary: {
          active: statusMap.active,
          inactive: statusMap.inactive,
          deceased: statusMap.deceased,
        },
        quickFilters: {
          todaysVisits,
          thisWeeksVisits,
          newThisMonth,
          outstandingPayments: outstandingPatientIds.size,
          notVisited,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// Served only through this authenticated, permission-checked route — never a
// static/public directory, same pattern as clinical documents. Registered
// BEFORE the GET /:id route below on purpose: Express matches routes in
// registration order, and /:id would otherwise swallow "/photos" as if it
// were a patient id.
// Patient list export — used by the Reports page. Registered BEFORE GET
// /:id on purpose (same reasoning as the old /photos route once was):
// Express matches in registration order, and /:id would otherwise swallow
// "/export" as if it were a patient id.
router.get(
  "/export",
  requirePermission("patients.export"),
  async (req, res, next) => {
    try {
      const patients = await prisma.patient.findMany({
        where: { tenantId: req.tenantId! },
        include: {
          visits: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { startedAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      const rows = patients.map((p) => ({
        "Patient ID": p.platformPatientId,
        Name: p.name,
        "Hospital Card Number": p.hospitalCardNumber || "",
        Phone: p.phone || "",
        Email: p.email || "",
        Gender: p.gender,
        DOB: p.dob.toISOString().slice(0, 10),
        Age: ageFromDob(p.dob),
        Address: p.address || "",
        "Emergency Contact": p.emergencyContact || "",
        "Guardian Name": p.guardianName || "",
        "Guardian Phone": p.guardianPhone || "",
        "Preferred Channel": p.preferredChannel,
        "Blood Group": p.bloodGroup || "",
        Species: p.species || "",
        "Administrative Notes": p.administrativeNotes || "",
        Status: p.status,
        "Last Visit": p.visits[0]?.startedAt
          ? p.visits[0].startedAt.toISOString().slice(0, 10)
          : "",
        Registered: p.createdAt.toISOString().slice(0, 10),
      }));
      const wb = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, sheet, "Patients");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=ihops-patients-export.xlsx",
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/:id",
  requirePermission("patients.read"),
  async (req, res, next) => {
    try {
      const patient = await prisma.patient.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
        include: {
          family: true,
          visits: {
            orderBy: { startedAt: "desc" },
            include: { payment: true, doctor: true },
          },
          communications: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      });
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      res.json({ patient });
    } catch (err) {
      next(err);
    }
  },
);

// --- NDPA/NDPR support (Nigeria Data Protection Act / Regulation) ---
// Two data-subject-rights primitives: an access export (Article/Section
// "right of access" — everything IHOPS holds on a patient, in one file) and
// an anonymization action (right to erasure) that scrubs identifying fields
// while keeping the record shell intact, since a treated patient's clinical
// and financial records typically can't be deleted outright during a legal
// retention period — anonymizing is the practical middle ground most
// healthcare data protection regimes expect. Both are audited, and neither
// is a substitute for your own DPO/legal process — see the NDPR compliance
// notes shipped alongside this change for what these do and don't cover.

// Full data-subject access export — everything held about this patient,
// across every module, as one JSON document.
router.get(
  "/:id/data-export",
  requirePermission("patients.write"),
  async (req, res, next) => {
    try {
      const patient = await prisma.patient.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
        include: {
          family: true,
          visits: {
            include: {
              payment: true,
              doctor: { select: { name: true } },
              department: { select: { name: true } },
            },
          },
          communications: true,
        },
      });
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      const clinicalNotes = await prisma.clinicalNote.findMany({
        where: { tenantId: req.tenantId!, patientId: patient.id },
        include: { documents: true },
      });
      const communicationPayloads = await prisma.communicationPayload.findMany({
        where: { tenantId: req.tenantId!, patientId: patient.id },
      });
      const auditEntries = await prisma.auditLog.findMany({
        where: {
          tenantId: req.tenantId!,
          entityType: "Patient",
          entityId: patient.id,
        },
        orderBy: { createdAt: "desc" },
      });

      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "patient.data_export",
        entityType: "Patient",
        entityId: patient.id,
      });

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=ihops-patient-data-export-${patient.platformPatientId}.json`,
      );
      res.setHeader("Content-Type", "application/json");
      res.json({
        exportedAt: new Date().toISOString(),
        exportReason: "Data subject access request",
        patient,
        clinicalNotes,
        communicationPayloads,
        auditTrail: auditEntries,
      });
    } catch (err) {
      next(err);
    }
  },
);

const anonymizeSchema = z.object({ reason: z.string().min(3) });

// Right-to-erasure — irreversibly scrubs directly-identifying fields.
// Deliberately does NOT delete the row or its visit/payment/clinical-note
// history: those often need to be retained for a legal minimum period even
// after an erasure request, per typical healthcare record-retention rules —
// but nothing about them needs to stay attributable to a name once that
// period's purpose (ongoing care) has ended and the patient has asked to be
// forgotten. Requires a reason for the audit trail; irreversible.
router.post(
  "/:id/anonymize",
  requirePermission("patients.write"),
  async (req, res, next) => {
    try {
      const body = anonymizeSchema.parse(req.body);
      const patient = await prisma.patient.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      const anonymized = await prisma.patient.update({
        where: { id: patient.id },
        data: {
          name: `Redacted Patient ${patient.platformPatientId}`,
          phone: null,
          email: null,
          address: "Redacted",
          emergencyContact: "Redacted",
          guardianName: null,
          guardianPhone: null,
          administrativeNotes: null,
          status: "inactive",
        },
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "patient.anonymize",
        entityType: "Patient",
        entityId: patient.id,
        metadata: { reason: body.reason },
      });
      res.json({ patient: anonymized, message: "Patient data anonymized" });
    } catch (err) {
      next(err);
    }
  },
);

// 9.2.3 Patient Registration
router.post(
  "/",
  requirePermission("patients.write"),
  async (req, res, next) => {
    try {
      const body = createPatientSchema.parse(req.body);
      const dob = new Date(body.dob);
      if (dob > new Date())
        return res
          .status(400)
          .json({ error: "Date of birth cannot be a future date" });

      // Validation rule: preferred channel must have a matching contact detail.
      if (body.preferredChannel !== "email" && !body.phone) {
        return res
          .status(400)
          .json({
            error:
              "A phone number is required for WhatsApp/SMS as the preferred channel",
          });
      }
      if (body.preferredChannel === "email" && !body.email) {
        return res
          .status(400)
          .json({
            error:
              "An email address is required when Email is the preferred channel",
          });
      }

      const duplicates = await findPossibleDuplicates(
        req.tenantId!,
        body.name,
        body.phone,
        dob,
      );
      if (duplicates.length && !body.overrideDuplicateWarning) {
        return res.status(409).json({
          error: "POSSIBLE_DUPLICATE",
          message:
            "A patient with a similar name, phone, and date of birth already exists.",
          candidates: duplicates.map((d) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            platformPatientId: d.platformPatientId,
          })),
        });
      }

      const count = await prisma.patient.count({
        where: { tenantId: req.tenantId! },
      });
      const patient = await prisma.patient.create({
        data: {
          tenantId: req.tenantId!,
          platformPatientId: generatePlatformPatientId(count + 1),
          hospitalCardNumber: body.hospitalCardNumber,
          familyId: body.familyId,
          name: body.name,
          phone: body.phone,
          email: body.email || null,
          gender: body.gender,
          dob,
          address: body.address,
          emergencyContact: body.emergencyContact,
          guardianName: body.guardianName,
          guardianPhone: body.guardianPhone,
          preferredChannel: body.preferredChannel,
          administrativeNotes: body.administrativeNotes,
          species: body.species,
          bloodGroup: body.bloodGroup,
        },
      });

      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "patient.create",
        entityType: "Patient",
        entityId: patient.id,
      });
      res.status(201).json({ patient });
    } catch (err) {
      next(err);
    }
  },
);

// Edit an existing patient — administrative fields (contact info, blood
// group, status) and clinical registration fields (address, guardian, etc).
// Distinct from the Clinical Note / Medical Record: this is registration
// data, not clinical documentation, so it's gated on patients.write like
// registration itself rather than a clinical permission.
router.patch(
  "/:id",
  requirePermission("patients.write"),
  async (req, res, next) => {
    try {
      const existing = await prisma.patient.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!existing)
        return res.status(404).json({ error: "Patient not found" });

      const body = updatePatientSchema.parse(req.body);
      const data: any = { ...body };
      if (body.dob) {
        const dob = new Date(body.dob);
        if (dob > new Date())
          return res
            .status(400)
            .json({ error: "Date of birth cannot be a future date" });
        data.dob = dob;
      }
      if (body.email === "") data.email = null;

      const patient = await prisma.patient.update({
        where: { id: existing.id },
        data,
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "patient.update",
        entityType: "Patient",
        entityId: patient.id,
        metadata: { fields: Object.keys(body) },
      });
      res.json({ patient });
    } catch (err) {
      next(err);
    }
  },
);

// 9.2.4 Patient Import Wizard — Step 1: Upload + auto-suggested field mapping
router.post(
  "/import/preview",
  requirePermission("patients.import"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ error: "File is required (.xlsx or .csv)" });
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const headers = rows.length ? Object.keys(rows[0]) : [];

      const targetFields = [
        "name",
        "phone",
        "email",
        "gender",
        "dob",
        "address",
        "emergencyContact",
        "hospitalCardNumber",
        "preferredChannel",
        "guardianName",
        "guardianPhone",
        "bloodGroup",
        "species",
        "administrativeNotes",
        "status",
      ];
      const suggestedMapping: Record<string, string | null> = {};
      for (const field of targetFields) {
        const match = headers.find(
          (h) => h.toLowerCase().replace(/[^a-z]/g, "") === field.toLowerCase(),
        );
        suggestedMapping[field] = match || null;
      }

      const preview = rows.slice(0, 50);
      const errors: { row: number; issue: string }[] = [];
      preview.forEach((row, idx) => {
        const nameField = suggestedMapping.name;
        if (nameField && !row[nameField])
          errors.push({ row: idx + 1, issue: "Missing name" });
      });

      res.json({
        headers,
        suggestedMapping,
        totalRows: rows.length,
        preview,
        errors,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Step 2: Commit — transactional per batch (Section 9.2.4)
router.post(
  "/import/commit",
  requirePermission("patients.import"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "File is required" });
      const mapping = JSON.parse(req.body.mapping || "{}");
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      let imported = 0,
        skipped = 0,
        flagged = 0;
      const errorReport: { row: number; issue: string }[] = [];
      const startCount = await prisma.patient.count({
        where: { tenantId: req.tenantId! },
      });

      await prisma.$transaction(async (tx) => {
        let seq = startCount;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = mapping.name ? row[mapping.name] : null;
          const dobRaw = mapping.dob ? row[mapping.dob] : null;
          if (!name || !dobRaw) {
            skipped++;
            errorReport.push({
              row: i + 1,
              issue: "Missing required field (name or dob)",
            });
            continue;
          }
          const dob = new Date(dobRaw);
          if (isNaN(dob.getTime()) || dob > new Date()) {
            skipped++;
            errorReport.push({ row: i + 1, issue: "Invalid date of birth" });
            continue;
          }
          const phone = mapping.phone
            ? String(row[mapping.phone] || "")
            : undefined;
          const existing = phone
            ? await tx.patient.findFirst({
                where: { tenantId: req.tenantId!, name, phone },
              })
            : null;
          if (existing) flagged++;

          seq++;
          const preferredChannelRaw = String(
            mapping.preferredChannel ? row[mapping.preferredChannel] : "sms",
          )
            .toLowerCase()
            .trim();
          const preferredChannel = ["whatsapp", "sms", "email"].includes(
            preferredChannelRaw,
          )
            ? preferredChannelRaw
            : "sms";
          const statusRaw = String(
            mapping.status ? row[mapping.status] : "active",
          )
            .toLowerCase()
            .trim();
          const status = ["active", "inactive", "deceased"].includes(statusRaw)
            ? statusRaw
            : "active";
          const bloodGroupRaw = mapping.bloodGroup
            ? String(row[mapping.bloodGroup] || "")
                .trim()
                .toUpperCase()
            : "";
          const validBloodGroups = [
            "A+",
            "A-",
            "B+",
            "B-",
            "AB+",
            "AB-",
            "O+",
            "O-",
            "UNKNOWN",
          ];
          const bloodGroup = validBloodGroups.includes(bloodGroupRaw)
            ? bloodGroupRaw === "UNKNOWN"
              ? "Unknown"
              : bloodGroupRaw
            : undefined;

          await tx.patient.create({
            data: {
              tenantId: req.tenantId!,
              platformPatientId: generatePlatformPatientId(seq),
              hospitalCardNumber: mapping.hospitalCardNumber
                ? String(row[mapping.hospitalCardNumber] || "")
                : undefined,
              name,
              phone,
              email: mapping.email
                ? String(row[mapping.email] || "") || null
                : null,
              gender: mapping.gender
                ? String(row[mapping.gender] || "unspecified")
                : "unspecified",
              dob,
              address: mapping.address
                ? String(row[mapping.address] || "")
                : "",
              // Previously hardcoded to "" regardless of what the user mapped
              // this column to — the mapping UI offered it, but the value was
              // silently discarded. Now actually read from the mapped column.
              emergencyContact: mapping.emergencyContact
                ? String(row[mapping.emergencyContact] || "")
                : "",
              guardianName: mapping.guardianName
                ? String(row[mapping.guardianName] || "") || undefined
                : undefined,
              guardianPhone: mapping.guardianPhone
                ? String(row[mapping.guardianPhone] || "") || undefined
                : undefined,
              species: mapping.species
                ? String(row[mapping.species] || "") || undefined
                : undefined,
              administrativeNotes: mapping.administrativeNotes
                ? String(row[mapping.administrativeNotes] || "") || undefined
                : undefined,
              bloodGroup,
              status,
              preferredChannel,
            },
          });
          imported++;
        }
      });

      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "patient.bulk_import",
        entityType: "Patient",
        metadata: { imported, skipped, flagged },
      });
      res.json({ imported, skipped, flagged, errorReport });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
