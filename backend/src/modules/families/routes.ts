import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireStaffAuth, requirePermission } from "../../middleware/auth";
import { writeAuditLog } from "../../middleware/audit";
import { generateFamilyId } from "../../lib/ids";

// Family/household management — the Family model and Patient.familyId field
// have existed since the original schema, but nothing ever let staff
// actually create a family, see its members, or add/remove a patient from
// one. This module closes that gap. Reuses the existing patients.read /
// patients.write permissions rather than inventing new ones, since managing
// a family is really just a different view of managing patients.
const router = Router();
router.use(requireStaffAuth);

router.get("/", requirePermission("patients.read"), async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const families = await prisma.family.findMany({
      where: {
        tenantId: req.tenantId!,
        ...(q
          ? {
              OR: [
                { familyIdDisplay: { contains: q } },
                { patients: { some: { name: { contains: q } } } },
              ],
            }
          : {}),
      },
      include: {
        patients: {
          select: {
            id: true,
            name: true,
            platformPatientId: true,
            phone: true,
          },
        },
      },
      orderBy: { familyIdDisplay: "asc" },
    });
    res.json({
      families: families.map((f) => ({
        id: f.id,
        familyIdDisplay: f.familyIdDisplay,
        primaryContactPatientId: f.primaryContactPatientId,
        memberCount: f.patients.length,
        members: f.patients,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/:id",
  requirePermission("patients.read"),
  async (req, res, next) => {
    try {
      const family = await prisma.family.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
        include: {
          patients: {
            include: {
              visits: {
                orderBy: { startedAt: "desc" },
                take: 1,
                select: { startedAt: true },
              },
            },
          },
        },
      });
      if (!family) return res.status(404).json({ error: "Family not found" });
      res.json({
        family: {
          id: family.id,
          familyIdDisplay: family.familyIdDisplay,
          primaryContactPatientId: family.primaryContactPatientId,
          members: family.patients.map((p) => ({
            id: p.id,
            name: p.name,
            platformPatientId: p.platformPatientId,
            phone: p.phone,
            gender: p.gender,
            dob: p.dob,
            status: p.status,
            lastVisit: p.visits[0]?.startedAt || null,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

const createFamilySchema = z.object({
  patientIds: z
    .array(z.string())
    .min(1, "At least one patient is required to start a family"),
  primaryContactPatientId: z.string().optional(),
});

router.post(
  "/",
  requirePermission("patients.write"),
  async (req, res, next) => {
    try {
      const body = createFamilySchema.parse(req.body);
      const patients = await prisma.patient.findMany({
        where: { id: { in: body.patientIds }, tenantId: req.tenantId! },
      });
      if (patients.length !== body.patientIds.length)
        return res
          .status(400)
          .json({ error: "One or more patients were not found" });

      const count = await prisma.family.count({
        where: { tenantId: req.tenantId! },
      });
      const family = await prisma.$transaction(async (tx) => {
        const created = await tx.family.create({
          data: {
            tenantId: req.tenantId!,
            familyIdDisplay: generateFamilyId(count + 1),
            primaryContactPatientId:
              body.primaryContactPatientId || body.patientIds[0],
          },
        });
        await tx.patient.updateMany({
          where: { id: { in: body.patientIds }, tenantId: req.tenantId! },
          data: { familyId: created.id },
        });
        return created;
      });

      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "family.create",
        entityType: "Family",
        entityId: family.id,
        metadata: { memberCount: patients.length },
      });
      res.status(201).json({ family });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id",
  requirePermission("patients.write"),
  async (req, res, next) => {
    try {
      const family = await prisma.family.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!family) return res.status(404).json({ error: "Family not found" });
      const { primaryContactPatientId } = req.body;
      if (primaryContactPatientId) {
        const belongs = await prisma.patient.findFirst({
          where: {
            id: primaryContactPatientId,
            familyId: family.id,
            tenantId: req.tenantId!,
          },
        });
        if (!belongs)
          return res
            .status(400)
            .json({ error: "Primary contact must be a member of this family" });
      }
      const updated = await prisma.family.update({
        where: { id: family.id },
        data: { primaryContactPatientId },
      });
      res.json({ family: updated });
    } catch (err) {
      next(err);
    }
  },
);

// Add an existing patient to a family.
router.post(
  "/:id/members",
  requirePermission("patients.write"),
  async (req, res, next) => {
    try {
      const { patientId } = req.body;
      const family = await prisma.family.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!family) return res.status(404).json({ error: "Family not found" });
      const patient = await prisma.patient.findFirst({
        where: { id: patientId, tenantId: req.tenantId! },
      });
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      await prisma.patient.update({
        where: { id: patientId },
        data: { familyId: family.id },
      });
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "family.add_member",
        entityType: "Family",
        entityId: family.id,
        metadata: { patientId },
      });
      res.status(201).json({ message: "Added to family" });
    } catch (err) {
      next(err);
    }
  },
);

// Remove a patient from a family — the family record itself stays even if
// this empties it, so staff can keep adding members back later without
// losing the family ID. Delete the family explicitly if it's no longer needed.
router.delete(
  "/:id/members/:patientId",
  requirePermission("patients.write"),
  async (req, res, next) => {
    try {
      const family = await prisma.family.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!family) return res.status(404).json({ error: "Family not found" });
      const patient = await prisma.patient.findFirst({
        where: {
          id: req.params.patientId,
          familyId: family.id,
          tenantId: req.tenantId!,
        },
      });
      if (!patient)
        return res
          .status(404)
          .json({ error: "This patient is not a member of this family" });

      await prisma.patient.update({
        where: { id: patient.id },
        data: { familyId: null },
      });
      if (family.primaryContactPatientId === patient.id) {
        const remaining = await prisma.patient.findFirst({
          where: { familyId: family.id },
        });
        await prisma.family.update({
          where: { id: family.id },
          data: { primaryContactPatientId: remaining?.id || null },
        });
      }
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "family.remove_member",
        entityType: "Family",
        entityId: family.id,
        metadata: { patientId: patient.id },
      });
      res.json({ message: "Removed from family" });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id",
  requirePermission("patients.write"),
  async (req, res, next) => {
    try {
      const family = await prisma.family.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!family) return res.status(404).json({ error: "Family not found" });
      await prisma.$transaction([
        prisma.patient.updateMany({
          where: { familyId: family.id },
          data: { familyId: null },
        }),
        prisma.family.delete({ where: { id: family.id } }),
      ]);
      await writeAuditLog({
        tenantId: req.tenantId,
        staffId: req.staff!.id,
        actionType: "family.delete",
        entityType: "Family",
        entityId: family.id,
      });
      res.json({ message: "Family deleted" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
