import React from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import Navbar from "../../components/marketing/Navbar";
import Footer from "../../components/marketing/Footer";
import {
  HeartPulse,
  ShieldCheck,
  Users,
  ArrowRight,
  ShieldPlus,
  Lock,
  Zap,
  Timer,
  TrendingUp,
  Heart,
  Smartphone,
} from "lucide-react";

// --- ANIMATION VARIANTS ---
const fadeInUp: Variants = {
  initial: { y: 30, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};

// --- DATA ---
const VALUES = [
  {
    icon: ShieldPlus,
    title: "Built for Healthcare",
    desc: "Every feature is designed around real hospital workflows and the unique needs of African healthcare providers.",
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-100/50",
  },
  {
    icon: Lock,
    title: "Secure & Compliant",
    desc: "We protect sensitive data with enterprise-grade security and comply with NDPC and global best practices.",
    iconColor: "text-purple-600",
    iconBg: "bg-purple-100/50",
  },
  {
    icon: Zap,
    title: "Intelligent & Automated",
    desc: "From follow-ups to reminders and reports, IHOPS automates the busywork so your team can focus on what matters most.",
    iconColor: "text-amber-500",
    iconBg: "bg-amber-100/50",
  },
  {
    icon: Users,
    title: "People First",
    desc: "We listen, we learn, and we build with our customers — because your success is our success.",
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100/50",
  },
];

const WHY_IHOPS = [
  {
    icon: Timer,
    title: "Save Time",
    desc: "Automate routine tasks and reduce manual work across departments.",
  },
  {
    icon: TrendingUp,
    title: "Increase Revenue",
    desc: "Improve follow-ups, reduce no-shows and get paid faster.",
  },
  {
    icon: Heart,
    title: "Improve Patient Care",
    desc: "Complete patient records, timely reminders and better continuity of care.",
  },
  {
    icon: Smartphone,
    title: "Access Anywhere",
    desc: "Cloud-based platform accessible securely from any device.",
  },
  {
    icon: ShieldCheck,
    title: "Grow with Confidence",
    desc: "Scalable to support a single clinic or a group of hospitals.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-white overflow-x-hidden">
      {/* ---------------- HERO ---------------- */}
      <section className="relative bg-gradient-to-br from-brand-forest via-brand-forest-light to-brand-sage pt-28 pb-24 overflow-hidden">
        {/* Decorative SVG */}
        <svg
          className="absolute right-[-100px] top-[-50px] opacity-20 pointer-events-none hidden md:block"
          width="400"
          height="400"
          viewBox="0 0 400 400"
          fill="none"
        >
          <circle cx="200" cy="200" r="199" stroke="#89D7B7" />
          <circle cx="200" cy="200" r="150" stroke="#89D7B7" />
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
            About Us, Our Story & Mission
          </motion.span>
          <motion.h1
            className="text-3xl md:text-5xl font-display font-extrabold text-white leading-tight mt-5"
            variants={fadeInUp}
          >
            Software that fits how Nigerian hospitals actually work
          </motion.h1>
          <motion.p
            className="text-white/70 mt-5 text-lg max-w-2xl mx-auto"
            variants={fadeInUp}
          >
            Building the operating system for hospitals in Africa. IHOPS
            (Intelligent Hospital Operation System) is a cloud-based platform
            that helps hospitals, clinics, dental practices, veterinary clinics,
            and diagnostic centers run their operations smarter, simpler, and
            more profitably.
          </motion.p>
        </motion.div>
      </section>

      {/* ---------------- Mission ---------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-24 grid md:grid-cols-2 gap-16 items-center">
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
        >
          <motion.span
            className="inline-block bg-brand-cream text-brand-sage-dark px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
            variants={fadeInUp}
          >
            Our mission
          </motion.span>
          <motion.h2
            className="text-3xl md:text-4xl font-display font-extrabold text-brand-forest leading-tight mb-6"
            variants={fadeInUp}
          >
            Operational backbone for every facility
          </motion.h2>
          <motion.p
            className="text-brand-forest/70 text-base mb-5 leading-relaxed"
            variants={fadeInUp}
          >
            To empower every healthcare provider in Africa with intelligent,
            easy-to-use technology that improves patient care, simplifies
            operations, and drives sustainable growth.
          </motion.p>
          <motion.span
            className="inline-block bg-brand-cream text-brand-sage-dark px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
            variants={fadeInUp}
          >
            Our Story
          </motion.span>
          <motion.p
            className="text-brand-forest/70 text-base mb-5 leading-relaxed"
            variants={fadeInUp}
          >
            IHOPS was born out of a simple observation: hospitals in Nigeria and
            across Africa are doing amazing work, but outdated systems,
            paperwork, and disconnected tools slow them down. We set out to
            build a platform that feels simple, works reliably, and grows with
            our customers. Today, IHOPS is helping healthcare providers run
            their operations smarter and deliver better outcomes for their
            patients.
          </motion.p>
          <motion.p
            className="text-brand-forest/70 text-base leading-relaxed"
            variants={fadeInUp}
          >
            That's the entire premise of IHOPS: visit-centric, not
            appointment-centric; role-based, not all-access; automated where it
            helps, and never automated with clinical data it shouldn't see.
          </motion.p>
        </motion.div>

        <motion.div
          className="relative"
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <img
            // Localized Image: Black doctor examining a child
            src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=800&auto=format&fit=crop"
            alt="Nigerian Doctor with patient"
            className="rounded-3xl shadow-xl aspect-square object-cover"
          />
          <div className="absolute -left-8 -bottom-8 bg-brand-sage p-5 rounded-3xl shadow-lg animate-bounce-slow">
            <HeartPulse size={48} className="text-white" strokeWidth={1} />
          </div>
        </motion.div>
      </section>

      {/* ---------------- 4-Column Values Grid (Replicated from Image) ---------------- */}
      <section className="max-w-[85rem] mx-auto px-4 md:px-8 py-12">
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
        >
          {VALUES.map((v) => (
            <motion.div
              key={v.title}
              className="bg-white rounded-2xl p-8 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-50 flex flex-col items-center text-center group"
              variants={fadeInUp}
            >
              <div
                className={`w-14 h-14 rounded-2xl ${v.iconBg} ${v.iconColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
              >
                <v.icon size={28} strokeWidth={2} />
              </div>
              <div className="font-display font-bold text-lg text-brand-forest mb-3">
                {v.title}
              </div>
              <div className="text-sm text-brand-forest/70 leading-relaxed">
                {v.desc}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ---------------- Why IHOPS (Replicated from Image) ---------------- */}
      <section className="max-w-[85rem] mx-auto px-4 md:px-8 py-20 mb-12">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-brand-forest relative inline-block pb-3">
            Why IHOPS?
            {/* Small underline as seen in the image */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-brand-forest rounded-full"></div>
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-12"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
        >
          {WHY_IHOPS.map((item) => (
            <motion.div
              key={item.title}
              className="flex flex-col items-center text-center"
              variants={fadeInUp}
            >
              <div className="text-blue-600 mb-5">
                <item.icon size={36} strokeWidth={1.5} />
              </div>
              <h3 className="font-display font-bold text-[17px] text-brand-forest mb-3">
                {item.title}
              </h3>
              <p className="text-[13px] text-brand-forest/70 leading-relaxed px-2">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-24 BG-WHITE">
        <motion.div
          className="rounded-[2.5rem] bg-brand-cream p-10 md:p-16 text-center border border-brand-sage/20 relative overflow-hidden"
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <svg
            className="absolute right-[-50px] top-[-50px] opacity-20"
            width="200"
            height="200"
            viewBox="0 0 200 200"
            fill="none"
          >
            <circle cx="100" cy="100" r="99" stroke="#1D3E37" />
          </svg>

          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-brand-forest mb-4 relative z-10">
            Ready to transform your hospital operations?
          </h2>
          <p className="text-brand-forest/70 text-lg mb-8 max-w-xl mx-auto relative z-10">
            Join hundreds of healthcare providers already using IHOPS
          </p>
          <motion.div
            className="flex flex-wrap justify-center gap-4 relative z-10"
            whileHover={{ scale: 1.02 }}
          >
            <Link
              to="/signup"
              className="bg-brand-forest hover:bg-brand-forest-light text-white font-semibold rounded-full px-8 py-3.5 transition inline-flex items-center gap-2 group shadow-lg"
            >
              Register your hospital{" "}
              <ArrowRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
            </Link>
            <Link
              to="/contact"
              className="bg-white border border-brand-forest/15 text-brand-forest font-semibold rounded-full px-8 py-3.5 transition hover:bg-gray-50 hover:border-brand-forest/30"
            >
              Talk to us first
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
