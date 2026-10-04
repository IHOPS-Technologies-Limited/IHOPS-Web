import { Router } from "express";
import { z } from "zod";
import { sendEmail } from "../../services/notificationService";

// Public, unauthenticated routes for the marketing site (Contact page).
// Deliberately its own module: no requireStaffAuth, no tenant scoping, and
// no database writes — this only ever forwards an email. Added on top of the
// existing system; nothing here is reachable from or affects any tenant data.
const router = Router();

const SALES_INBOX = process.env.SALES_INBOX_EMAIL || "hello@ihops.africa";

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  hospitalName: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().min(5),
});

router.post("/contact", async (req, res, next) => {
  try {
    const body = contactSchema.parse(req.body);
    await sendEmail(
      SALES_INBOX,
      `New contact form message from ${body.name}`,
      `New message from the IHOPS contact form.\n\nFrom: ${body.name} <${body.email}>\nHospital: ${body.hospitalName || "—"}\nPhone: ${body.phone || "—"}\n\nMessage:\n${body.message}`,
    );
    // Confirmation to the sender, mirroring what a real inbox auto-reply would do.
    await sendEmail(
      body.email,
      "We received your message — IHOPS",
      `Hi ${body.name},\n\nThanks for reaching out to IHOPS — we've received your message and someone from our team will get back to you shortly, usually within one business day.\n\nFor reference, here's what you sent us:\n\n"${body.message}"\n\nIf anything is urgent, you're welcome to reply directly to this email.\n\nThe IHOPS Team`,
    );
    res.status(201).json({ message: "Message sent" });
  } catch (err) {
    next(err);
  }
});

export default router;
