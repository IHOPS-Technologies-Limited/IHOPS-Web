// IHOPS Internal console — Super Admin account management.
// Replaces "run the seed / edit the DB by hand" for adding a teammate,
// resetting a forgotten console password, or removing someone who has left.

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { hashSecret, compareSecret } from "../../lib/hash";
import { writeAuditLog } from "../../middleware/audit";

const router = Router();

const h =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const password = z.string().min(10, "Use at least 10 characters").max(72, "72 characters or fewer");

router.get(
  "/me",
  h(async (req, res) => {
    const me = await prisma.superAdmin.findUnique({
      where: { id: req.superAdmin!.id },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    res.json({ superAdmin: me });
  }),
);

router.get(
  "/admins",
  h(async (req, res) => {
    const admins = await prisma.superAdmin.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    res.json({ admins: admins.map((a) => ({ ...a, isYou: a.id === req.superAdmin!.id })) });
  }),
);

router.post(
  "/admins",
  h(async (req, res) => {
    const body = z
      .object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email(), password })
      .parse(req.body);
    const dupe = await prisma.superAdmin.findFirst({
      where: { email: { equals: body.email, mode: "insensitive" } },
    });
    if (dupe) return res.status(409).json({ error: "A Super Admin with that email already exists" });
    const admin = await prisma.superAdmin.create({
      data: { name: body.name, email: body.email, passwordHash: await hashSecret(body.password) },
    });
    await writeAuditLog({
      superAdminId: req.superAdmin!.id,
      actionType: "superadmin.admin_create",
      entityType: "SuperAdmin",
      entityId: admin.id,
      metadata: { email: admin.email },
    });
    res.status(201).json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
  }),
);

// Change MY password (requires the current one).
router.post(
  "/me/password",
  h(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: password })
      .parse(req.body);
    const me = await prisma.superAdmin.findUnique({ where: { id: req.superAdmin!.id } });
    if (!me || !(await compareSecret(currentPassword, me.passwordHash)))
      return res.status(400).json({ error: "Your current password is incorrect" });
    await prisma.superAdmin.update({
      where: { id: me.id },
      data: { passwordHash: await hashSecret(newPassword) },
    });
    await writeAuditLog({
      superAdminId: me.id,
      actionType: "superadmin.password_changed",
      entityType: "SuperAdmin",
      entityId: me.id,
    });
    res.json({ message: "Password updated" });
  }),
);

// Set ANOTHER Super Admin's password (e.g. a teammate who forgot theirs).
router.post(
  "/admins/:id/password",
  h(async (req, res) => {
    const { newPassword } = z.object({ newPassword: password }).parse(req.body);
    const target = await prisma.superAdmin.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: "Super Admin not found" });
    await prisma.superAdmin.update({
      where: { id: target.id },
      data: { passwordHash: await hashSecret(newPassword) },
    });
    await writeAuditLog({
      superAdminId: req.superAdmin!.id,
      actionType: "superadmin.admin_password_reset",
      entityType: "SuperAdmin",
      entityId: target.id,
      metadata: { email: target.email },
    });
    res.json({ message: `Password updated for ${target.name}` });
  }),
);

router.delete(
  "/admins/:id",
  h(async (req, res) => {
    if (req.params.id === req.superAdmin!.id)
      return res.status(400).json({ error: "You can't delete your own account" });
    const target = await prisma.superAdmin.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: "Super Admin not found" });
    if ((await prisma.superAdmin.count()) <= 1)
      return res.status(400).json({ error: "At least one Super Admin must remain" });
    await prisma.superAdmin.delete({ where: { id: target.id } });
    await writeAuditLog({
      superAdminId: req.superAdmin!.id,
      actionType: "superadmin.admin_deleted",
      entityType: "SuperAdmin",
      entityId: target.id,
      metadata: { email: target.email, name: target.name },
    });
    res.json({ message: `${target.name} was removed` });
  }),
);

export default router;
