import React from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import Navbar from "../../components/marketing/Navbar";
import Footer from "../../components/marketing/Footer";
import {
  Users,
  Stethoscope,
  ShieldCheck,
  Activity,
  Sparkles,
  MessagesSquare,
  CheckCircle2,
  ArrowRight,
  UserCog,
  CreditCard,
} from "lucide-react";

// --- ANIMATION VARIANTS ---
const fadeInUp: Variants = {
  initial: { y: 30, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};

// --- DATA ---
const SERVICES = [
  {
    icon: Users,
    title: "Patients & Communication",
    desc: "A searchable patient directory, fast registration with duplicate detection, bulk import from spreadsheets, and automated WhatsApp/SMS/Email follow-ups on each patient's preferred channel.",
    features: [
      "Patient directory & registration",
      "Excel/CSV bulk import wizard",
      "WhatsApp, SMS & Email reminders",
      "Full communication log per patient",
    ],
  },
  {
    icon: Stethoscope,
    title: "Clinical Notes & Medical Record",
    desc: "A structured, per-visit Clinical Note — complaint, vitals, diagnosis, allergies, prescriptions, investigations, and treatment plan — that automatically rolls up into a longitudinal Medical Record.",
    features: [
      "One-entry structured clinical documentation",
      "Automatic Medical Record timeline",
      "Versioned corrections — never silent overwrites",
      "Role-gated: doctors and nurses only",
    ],
  },
  {
    icon: Sparkles,
    title: "Restricted AI Communication",
    desc: "Follow-up messages drafted by AI, but only from a staff-approved instruction — the engine never has access to a diagnosis, allergy, or prescription.",
    features: [
      "Automatic or Review-before-sending modes",
      "Warm, plain-language messages",
      "Hard data boundary enforced at the code level",
      "Full AI Communication Log for audit",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Finance & Paystack integration",
    desc: "Real-time revenue, outstanding payments, and insurance receivables — plus PIN-verified expense recording so every Naira is traceable to a person.",
    features: [
      "Live revenue dashboard",
      "Naira billing via Paystack",
      "PIN-gated expense entry",
      "Insurance reconciliation",
    ],
  },
  {
    icon: UserCog,
    title: "Workforce & Attendance",
    desc: "A staff directory with role-based accounts, a PIN-only attendance kiosk, and live on-duty/absence reporting — no extra hardware required.",
    features: [
      "Staff directory & PIN accounts",
      "Attendance kiosk check-in/out",
      "Live on-duty dashboard",
      "Manual correction with audit trail",
    ],
  },
  {
    icon: CreditCard,
    title: "Admin & Subscription",
    desc: "Hospital-wide settings, department and role management, and Naira-first billing with a 7-day free trial and local support.",
    features: [
      "Role & department management",
      "Paystack subscriptions (Naira)",
      "7-day free trial, 5-day grace period",
      "Free tier for approved Public Hospitals",
    ],
  },
];

export default function ServicesPage() {
  return (
    <div className="bg-white overflow-x-hidden">
      {/* ---------------- HERO ---------------- */}
      <section className="relative bg-gradient-to-br from-brand-forest via-brand-forest-light to-brand-sage pt-28 pb-24 overflow-hidden">
        {/* Decorative SVG */}
        <svg
          className="absolute left-[-120px] top-[-50px] opacity-20 pointer-events-none hidden md:block"
          width="450"
          height="450"
          viewBox="0 0 450 450"
          fill="none"
        >
          <circle cx="225" cy="225" r="224" stroke="#89D7B7" strokeWidth={2} />
          <circle cx="225" cy="225" r="180" stroke="#89D7B7" />
        </svg>

        <Navbar />

        <motion.div
          className="max-w-4xl mx-auto px-4 md:px-8 text-center relative z-10"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.span
            className="inline-flex items-center gap-2 bg-brand-mint/15 border border-brand-mint/30 text-brand-mint text-xs font-semibold tracking-wide uppercase rounded-full px-4 py-2"
            variants={fadeInUp}
          >
            Platform Capabilities
          </motion.span>
          <motion.h1
            className="text-3xl md:text-5xl font-display font-extrabold text-white leading-tight mt-5"
            variants={fadeInUp}
          >
            Everything the front desk and back office need
          </motion.h1>
          <motion.p
            className="text-white/70 mt-5 text-lg max-w-2xl mx-auto"
            variants={fadeInUp}
          >
            Deliberately not a heavyweight EMR — just the operational layer
            every Nigerian facility needs to run efficiently.
          </motion.p>
        </motion.div>
      </section>

      {/* ---------------- Services Grid ---------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-24 bg-white relative">
        <motion.div
          className="grid md:grid-cols-2 gap-8"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
        >
          {SERVICES.map((s) => (
            <motion.div
              key={s.title}
              className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 group hover:border-brand-sage/30 hover:-translate-y-1"
              variants={fadeInUp}
            >
              <div className="flex items-center gap-5 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-brand-cream text-brand-sage-dark flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <s.icon size={26} strokeWidth={1.5} />
                </div>
                <h3 className="font-display font-bold text-2xl text-brand-forest">
                  {s.title}
                </h3>
              </div>

              <p className="text-base text-brand-forest/70 mb-6 leading-relaxed text-sm">
                {s.desc}
              </p>

              <div className="border-t border-gray-100 pt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-forest/50 mb-4">
                  Key Features
                </h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {s.features.map((f) => (
                    <li
                      key={f}
                      className="flex gap-2.5 text-sm text-brand-forest/80 items-start"
                    >
                      <CheckCircle2
                        size={18}
                        className="text-brand-sage shrink-0 mt-0.5"
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-24 BG-WHITE">
        <motion.div
          className="rounded-[3rem] bg-gradient-to-br from-brand-forest via-brand-forest-light to-brand-sage p-12 md:p-16 text-center relative overflow-hidden Shadow-xl"
          initial={{ scale: 0.95, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <svg
            className="absolute right-[-80px] bottom-[-80px] opacity-20 pointer-events-none"
            width="320"
            height="320"
            viewBox="0 0 320 320"
            fill="none"
          >
            <circle cx="160" cy="160" r="159" stroke="#89D7B7" />
          </svg>

          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-white mb-4 relative z-10">
            Ready to put this to work on your front desk?
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-xl mx-auto relative z-10">
            Free 7-day trial. Set up your departments and invite staff in under
            10 minutes with local support.
          </p>

          <motion.div
            className="flex flex-wrap justify-center gap-4 relative z-10"
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Link
              to="/pricing"
              className="bg-white text-brand-forest font-semibold rounded-full px-8 py-3.5 transition hover:bg-brand-cream inline-flex items-center gap-2 group shadow-lg"
            >
              View pricing{" "}
              <ArrowRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
            </Link>
            <Link
              to="/signup"
              className="bg-brand-mint hover:bg-brand-mint-dark text-brand-forest font-bold rounded-full px-8 py-3.5 transition hover:scale-105 transform"
            >
              Register your hospital
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
