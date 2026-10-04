import React from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import Navbar from "../../components/marketing/Navbar";
import Footer from "../../components/marketing/Footer";
import {
  Stethoscope,
  Clock,
  CheckCircle2,
  HeartPulse,
  Eye,
  PawPrint,
  Activity,
  Syringe,
  Users,
  Search,
  Calendar,
  ChevronDown,
  ShieldCheck,
  MessagesSquare,
  ArrowRight,
  Star,
  TrendingUp,
  Shield,
  Zap,
  Quote,
  Building2,
  Database,
  Server,
  PlayCircle,
  User,
  ClipboardList,
  MessageSquare,
  CreditCard,
  BarChart3,
  Plus,
  Heart,
  Crown,
} from "lucide-react";

import DoctorImage from "../../../doctor.jpg";
// --- ANIMATION VARIANTS ---

const fadeInUp: Variants = {
  initial: { y: 40, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const ScaleIn: Variants = {
  initial: { scale: 0.9, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

// --- DATA ARRAYS ---

const SPECIALTIES = [
  { icon: HeartPulse, label: "General Hospital" },
  { icon: Syringe, label: "Dental Clinic" },
  { icon: PawPrint, label: "Veterinary" },
  { icon: Activity, label: "Physiotherapy" },
  { icon: Eye, label: "Eye Clinic" },
  { icon: Stethoscope, label: "Diagnostic Centre" },
];

const TRUSTED_BY = [
  { icon: Plus, name: "CityCare", sub: "Hospital", color: "text-blue-500" },
  { icon: Heart, name: "GreenLife", sub: "Clinic", color: "text-emerald-500" },
  {
    icon: Activity,
    name: "El-Shaddai",
    sub: "Specialist Hospital",
    color: "text-purple-500",
  },
  { icon: Plus, name: "LifeGate", sub: "Hospital", color: "text-blue-400" },
  { icon: Crown, name: "RoyalCare", sub: "Clinic", color: "text-yellow-500" },
];

const MODULES = [
  {
    title: "Patient Management",
    desc: "Register walk-ins, manage appointments, visits and complete patient history.",
    icon: User,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100",
  },
  {
    title: "Clinical Documentation",
    desc: "Capture structured clinical notes and automatically build medical records.",
    icon: ClipboardList,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-100",
  },
  {
    title: "Automated Communication",
    desc: "AI-powered reminders for follow-ups, appointments, birthdays and more.",
    icon: MessageSquare,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-100",
  },
  {
    title: "Finance & Payments",
    desc: "Track payments, expenses, outstanding balances and generate reports.",
    icon: CreditCard,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-100",
  },
  {
    title: "Workforce Management",
    desc: "Manage staff, attendance, roles, schedules and performance.",
    icon: Users,
    iconColor: "text-slate-500",
    iconBg: "bg-slate-100",
  },
  {
    title: "Real-time Insights",
    desc: "Live dashboards and reports to help you make smarter decisions.",
    icon: BarChart3,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-100",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Patient walks in",
    desc: "No appointment needed. Reception registers or finds them in seconds and starts a visit.",
  },
  {
    step: "2",
    title: "Doctor documents",
    desc: "A structured Clinical Note captures complaint, diagnosis, and follow-up — just once.",
  },
  {
    step: "3",
    title: "IHOPS follows up",
    desc: "A restricted AI engine sends a warm reminder — never touching diagnosis or prescription data.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "IHOPS completely transformed our front desk. The walk-in flow is incredibly fast, and we no longer lose track of patient histories.",
    author: "Dr. Funmi O.",
    role: "Medical Director, Apex Clinics",
    image:
      "https://images.unsplash.com/photo-1631857455684-a54a2f03665f?q=80&w=200&auto=format&fit=facearea&facepad=2&ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9",
  },
  {
    quote:
      "The automated financial reporting has saved us hours every week. We actually know what insurance companies owe us in real-time.",
    author: "Samuel T.",
    role: "Hospital Administrator",
    image:
      "https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?q=80&w=200&auto=format&fit=facearea&facepad=2&ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9",
  },
];

const STATS = [
  {
    value: "50+",
    label: "Hospitals Onboarded",
    icon: Building2,
    color: "text-brand-mint",
  },
  {
    value: "30k+",
    label: "Patient Records",
    icon: Database,
    color: "text-brand-sage",
  },
  {
    value: "99.9%",
    label: "Uptime SLA",
    icon: Server,
    color: "text-brand-sage-dark",
  },
  {
    value: "24/7",
    label: "Local Support",
    icon: Clock,
    color: "text-brand-forest",
  },
];

export default function Homepage() {
  return (
    <div className="bg-white overflow-x-hidden">
      {/* ---------------- HERO (UPDATED TEXTS/BUTTONS, ORIGINAL COLORS) ---------------- */}
      <section className="relative bg-gradient-to-br from-brand-forest via-brand-forest-light to-brand-sage pt-28 pb-32 md:pb-44 overflow-hidden">
        {/* Background Decorative SVG */}
        <svg
          className="absolute right-[-120px] top-10 opacity-25 pointer-events-none hidden md:block"
          width="560"
          height="560"
          viewBox="0 0 560 560"
          fill="none"
        >
          <circle cx="280" cy="280" r="279" stroke="#89D7B7" />
          <circle cx="280" cy="280" r="210" stroke="#89D7B7" />
          <circle cx="280" cy="280" r="140" stroke="#89D7B7" />
        </svg>

        <Navbar />

        <motion.div
          className="max-w-6xl mx-auto px-4 md:px-8 grid md:grid-cols-2 gap-12 items-center relative z-10"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp}>
            <span className="inline-flex items-center gap-2 bg-brand-mint/15 border border-brand-mint/30 text-brand-mint text-xs font-semibold tracking-wide uppercase rounded-full px-4 py-2">
              <CheckCircle2 size={14} className="text-brand-mint" />
              Built for Nigerian Healthcare
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-white leading-tight mt-5">
              The intelligent way to <br />
              run <span className="text-brand-mint">your hospital.</span>
            </h1>
            <p className="text-white/80 mt-5 text-lg max-w-md">
              IHOPS is an all-in-one hospital operation system that simplifies
              patient management, clinical documentation, finance, workforce and
              communication — so you can focus on what matters most: better
              care.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-8">
              <Link
                to="/signup"
                className="bg-brand-mint hover:bg-brand-mint-dark text-brand-forest font-semibold rounded-full px-7 py-3.5 transition shadow-lg shadow-black/10 hover:scale-105 transform"
              >
                Start Your Free Trial
              </Link>
              <button className="flex items-center gap-2 text-white font-medium border border-white/25 hover:bg-white/10 rounded-full px-7 py-3.5 transition">
                <PlayCircle size={20} /> Watch Video
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-10 text-sm text-white/80 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-brand-mint" />
                No Credit Card Required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-brand-mint" />
                Setup in under 30 minutes
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-brand-mint" />
                Cancel Anytime
              </div>
            </div>
          </motion.div>

          {/* Hero Visuals */}
          <motion.div className="relative hidden md:block" variants={ScaleIn}>
            <img
              src={DoctorImage}
              alt="IHOPS Dashboard Web and Mobile Mockup"
              className="w-[115%] lg:w-[135%] max-w-none h-auto object-contain rounded-[1.5rem] shadow-2xl border-4 border-white/10 transform md:translate-x-4 lg:translate-x-8"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ---------------- TRUSTED BY SECTION (NEW STRIP) ---------------- */}
      <section className="py-12 border-b border-gray-100 bg-brand-cream/40">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <p className="text-center text-sm font-medium text-brand-forest/50 mb-8">
            Trusted by hospitals and clinics across Nigeria
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {TRUSTED_BY.map((clinic, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <clinic.icon
                  size={28}
                  className={clinic.color}
                  strokeWidth={2.5}
                />
                <div className="leading-none text-left">
                  <div className="font-bold text-brand-forest text-lg">
                    {clinic.name}
                  </div>
                  <div className="text-xs text-brand-forest/60 font-medium">
                    {clinic.sub}
                  </div>
                </div>
              </div>
            ))}
            <div className="text-sm font-medium text-brand-forest/40 italic">
              and many more...
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- before STATS SECTION (ORIGINAL) ---------------- */}
      <section className="bg-white pt-24 pb-12">
        <section className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 md:px-8">
            <motion.div
              className="text-center max-w-3xl mx-auto mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-brand-forest">
                Everything you need to run your hospital, in one platform
              </h2>
            </motion.div>

            <motion.div
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12"
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, amount: 0.1 }}
              variants={staggerContainer}
            >
              {MODULES.map((m) => (
                <motion.div
                  key={m.title}
                  className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                  variants={fadeInUp}
                >
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${m.iconBg} ${m.iconColor}`}
                  >
                    <m.icon size={28} strokeWidth={2} />
                  </div>
                  <h3 className="text-xl font-bold text-brand-forest mb-3">
                    {m.title}
                  </h3>
                  <p className="text-brand-forest/70 leading-relaxed">
                    {m.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      </section>

      {/* ---------------- SPECIALTY STRIP (ORIGINAL) ---------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-16 pb-12 overflow-hidden">
        <motion.p
          className="text-center text-xs font-semibold uppercase tracking-widest text-brand-forest/40 mb-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Built for every specialty
        </motion.p>

        <motion.div
          className="flex flex-wrap justify-center gap-3"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.5 }}
          variants={staggerContainer}
        >
          {SPECIALTIES.map((s) => (
            <motion.div
              key={s.label}
              className="flex items-center gap-2 border border-brand-forest/10 rounded-full px-5 py-2.5 text-sm font-medium text-brand-forest/70 bg-brand-cream/60 hover:bg-brand-cream transition cursor-default hover:border-brand-sage"
              variants={ScaleIn}
            >
              <s.icon size={16} className="text-brand-sage" />
              {s.label}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ---------------- ABOUT TEASER (ORIGINAL) ---------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-20 grid md:grid-cols-2 gap-16 items-center">
        <motion.div
          className="relative"
          initial={{ x: -50, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
        >
          <img
            src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=800&auto=format&fit=crop"
            alt="Nigerian healthcare providers consulting"
            className="rounded-[2rem] aspect-[4/5] object-cover shadow-xl"
          />
          <div
            className="absolute -bottom-6 -right-6 bg-white rounded-2xl shadow-xl px-6 py-5 flex items-center gap-4 border border-gray-50 animate-bounce-slow"
            style={{ animationDuration: "5s" }}
          >
            <span className="w-12 h-12 rounded-full bg-brand-cream flex items-center justify-center">
              <ShieldCheck size={24} className="text-brand-sage" />
            </span>
            <div className="text-sm">
              <div className="font-bold text-brand-forest text-base">
                Role-based access
              </div>
              <div className="text-brand-forest/60">
                Clinical data stays clinical
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
        >
          <motion.span
            className="inline-block bg-brand-cream text-brand-sage-dark px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6"
            variants={fadeInUp}
          >
            About IHOPS
          </motion.span>
          <motion.h2
            className="text-3xl md:text-4xl font-display font-extrabold text-brand-forest leading-tight mb-6"
            variants={fadeInUp}
          >
            We make hospital operations feel effortless
          </motion.h2>
          <motion.p
            className="text-brand-forest/70 text-lg mb-8 leading-relaxed"
            variants={fadeInUp}
          >
            Built around how Nigerian hospitals actually run — walk-ins over
            bookings, front-desk staff who need things simple, and doctors who
            shouldn't have to type the same patient history twice. Billing is
            Naira-first via Paystack.
          </motion.p>
          <motion.ul className="space-y-4 mb-8" variants={staggerContainer}>
            {[
              "One structured Clinical Note per visit — the Medical Record builds itself",
              "AI reminders that only ever see a staff-approved instruction, never a diagnosis",
              "Naira-first billing with Paystack, built for how hospitals here actually get paid",
            ].map((item) => (
              <motion.li
                key={item}
                className="flex gap-4 text-base text-brand-forest/80"
                variants={fadeInUp}
              >
                <CheckCircle2
                  size={24}
                  className="text-brand-sage shrink-0 mt-0.5"
                />
                <span>{item}</span>
              </motion.li>
            ))}
          </motion.ul>
          <motion.div variants={fadeInUp}>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 text-brand-sage-dark font-bold hover:gap-3 transition-all bg-brand-cream/50 px-5 py-3 rounded-xl hover:bg-brand-cream"
            >
              Read our full story <ArrowRight size={18} />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-16 md:px-8">
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
        >
          {STATS.map((stat, idx) => (
            <motion.div
              key={idx}
              className="bg-white border border-gray-100 rounded-3xl p-7 shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-1"
              variants={fadeInUp}
            >
              <div className="flex items-center gap-4 mb-5">
                <div
                  className={`w-12 h-12 rounded-xl bg-brand-cream flex items-center justify-center group-hover:scale-110 transition-transform`}
                >
                  <stat.icon
                    className={`w-6 h-6 ${stat.color}`}
                    strokeWidth={1.5}
                  />
                </div>
                <div className="text-4xl font-display font-bold text-brand-forest">
                  {stat.value}
                </div>
              </div>
              <div className="text-sm font-medium text-gray-600 tracking-wide uppercase">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ---------------- HOW IT WORKS (ORIGINAL) ---------------- */}
      <section className="bg-brand-cream/40 py-24">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block bg-white text-brand-sage-dark px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
              Workflow
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-extrabold text-brand-forest mb-4">
              Visit-centric, not appointment-centric
            </h2>
            <p className="text-brand-forest/60 text-lg">
              Most patients walk in without booking. IHOPS is built around that
              reality to keep your lobby moving.
            </p>
          </motion.div>
          <motion.div
            className="grid md:grid-cols-3 gap-8"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {STEPS.map((s) => (
              <motion.div
                key={s.step}
                className="bg-white rounded-3xl p-8 shadow-sm border border-brand-forest/5 hover:shadow-xl transition duration-300 group"
                variants={fadeInUp}
              >
                <div className="w-14 h-14 rounded-2xl bg-brand-forest text-white flex items-center justify-center font-display text-xl font-bold mb-6 group-hover:-translate-y-1 transition-transform">
                  {s.step}
                </div>
                <h3 className="text-xl font-display font-bold text-brand-forest mb-3">
                  {s.title}
                </h3>
                <p className="text-brand-forest/70 leading-relaxed text-sm">
                  {s.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- FEATURES GRID (REVAMPED - LEFT AS IS) ---------------- */}

      {/* ---------------- TESTIMONIALS (ORIGINAL) ---------------- */}
      <section className="bg-brand-forest text-white py-24 relative overflow-hidden">
        <svg
          className="absolute left-[-100px] bottom-[-100px] opacity-10 pointer-events-none"
          width="400"
          height="400"
          viewBox="0 0 400 400"
          fill="none"
        >
          <circle cx="200" cy="200" r="199" stroke="white" />
        </svg>

        <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10">
          <div className="flex flex-col md:flex-row gap-12 items-center mb-16">
            <motion.div
              className="md:w-1/3 text-center md:text-left"
              initial={{ x: -30, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-display font-extrabold mb-4">
                Loved by clinics across Nigeria
              </h2>
              <p className="text-white/70 text-lg">
                See why medical directors and administrators are making the
                switch to IHOPS.
              </p>
            </motion.div>
            <motion.div
              className="md:w-2/3 grid md:grid-cols-2 gap-6"
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, amount: 0.3 }}
              variants={staggerContainer}
            >
              {TESTIMONIALS.map((t, idx) => (
                <motion.div
                  key={idx}
                  className="bg-white/10 border border-white/10 backdrop-blur-sm rounded-3xl p-8 relative hover:bg-white/15 transition"
                  variants={fadeInUp}
                >
                  <Quote
                    className="absolute top-8 right-8 text-brand-mint/20"
                    size={48}
                  />
                  <div className="flex gap-1 text-brand-mint mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={16} fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-white/90 text-base leading-relaxed mb-8 relative z-10">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-4">
                    <img
                      src={t.image}
                      alt={t.author}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                    />
                    <div>
                      <div className="font-bold">{t.author}</div>
                      <div className="text-sm text-white/60">{t.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---------------- PRICING CTA (ORIGINAL) ---------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-24 BG-WHITE">
        <motion.div
          className="rounded-[3rem] bg-gradient-to-br from-brand-forest via-brand-forest-light to-brand-sage p-12 md:p-20 text-center relative overflow-hidden shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Decorative Circles */}
          <svg
            className="absolute right-[-80px] bottom-[-80px] opacity-20"
            width="320"
            height="320"
            viewBox="0 0 320 320"
            fill="none"
          >
            <circle cx="160" cy="160" r="159" stroke="#89D7B7" />
          </svg>
          <svg
            className="absolute left-[-40px] top-[-40px] opacity-20"
            width="200"
            height="200"
            viewBox="0 0 200 200"
            fill="none"
          >
            <circle cx="100" cy="100" r="99" stroke="#89D7B7" />
          </svg>

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-display font-extrabold text-white mb-6">
              Simple, Naira-first pricing. <br className="hidden md:block" />{" "}
              Start free today.
            </h2>
            <p className="text-white/80 text-lg mb-10">
              Set up your departments, invite staff, and run your first walk-in
              visit in under 10 minutes. No credit card required for the 7-day
              trial. Local supporting standing by.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 bg-brand-mint hover:bg-brand-mint-dark text-brand-forest font-bold rounded-full px-8 py-4 transition text-lg shadow-xl shadow-black/10 hover:scale-105 transform"
              >
                Register your hospital <ArrowRight size={20} />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold rounded-full px-8 py-4 transition text-lg backdrop-blur-sm"
              >
                View pricing details
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
