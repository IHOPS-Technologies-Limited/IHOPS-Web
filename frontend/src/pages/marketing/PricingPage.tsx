import React from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import Navbar from "../../components/marketing/Navbar";
import Footer from "../../components/marketing/Footer";
import { CheckCircle2, ArrowRight, HelpCircle } from "lucide-react";

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
const PLANS = [
  {
    name: "Starter",
    price: "₦20,000",
    period: "/month",
    annualPrice: "₦200,000/year",
    desc: "Small clinics getting started",
    features: [
      "Up to 5 staff accounts",
      "Core patient & visit workflow",
      "Manual + automated reminders",
      "Attendance kiosk",
      "Finance dashboard",
    ],
  },
  {
    name: "Standard",
    price: "₦35,000",
    period: "/month",
    annualPrice: "₦350,000/year",
    desc: "Growing hospitals and multi-department clinics",
    features: [
      "Unlimited staff accounts",
      "Clinical Notes & Medical Record",
      "AI-personalised reminders",
      "Finance exports & insurance tracking",
      "Priority local support",
    ],
    highlight: true,
  },
  {
    name: "Public Hospital",
    price: "Free",
    period: "subject to approval",
    desc: "For government-run facilities",
    features: [
      "Full platform access",
      "Reviewed by the IHOPS team",
      "Same clinical & operational tooling",
      "Local onboarding help",
    ],
  },
];

const FAQS = [
  {
    q: "Is there a free trial?",
    a: "Yes — every Starter and Standard signup gets a 7-day free trial with no card required. Public Hospital applications are reviewed separately and are free once approved.",
  },
  {
    q: "What happens if I don't renew on time?",
    a: "You get a 5-day grace period after your subscription lapses before access is restricted — nothing is ever deleted, and you can renew at any time via Paystack to pick up right where you left off.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes, upgrades and downgrades take effect from your next billing cycle. Talk to our Nigerian support team if you need it sooner.",
  },
  {
    q: "How does billing work?",
    a: "Billing runs through Paystack in Naira, monthly or annually. Annual billing works out to two months free compared to monthly.",
  },
];

export default function PricingPage() {
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
            Transparent Pricing
          </motion.span>
          <motion.h1
            className="text-3xl md:text-5xl font-display font-extrabold text-white leading-tight mt-5"
            variants={fadeInUp}
          >
            Simple, Naira-first pricing
          </motion.h1>
          <motion.p
            className="text-white/70 mt-5 text-lg max-w-2xl mx-auto"
            variants={fadeInUp}
          >
            Start on a 7-day free trial. Public hospitals apply for free access,
            reviewed by our team. Billed locally via Paystack.
          </motion.p>
        </motion.div>
      </section>

      {/* ---------------- Pricing Cards ---------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-24 BG-WHITE relative">
        <motion.div
          className="grid md:grid-cols-3 gap-8 items-start"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
        >
          {PLANS.map((p) => (
            <motion.div
              key={p.name}
              className={`rounded-3xl p-8 flex flex-col border transition-all duration-300 hover:shadow-2xl ${p.highlight ? "border-brand-sage bg-brand-cream/40 ring-2 ring-brand-sage/20 relative shadow-xl scale-105 transform z-10" : "border-gray-100 bg-white shadow-sm hover:border-gray-200"}`}
              variants={fadeInUp}
              whileHover={{ y: -5 }}
            >
              {p.highlight && (
                <span className="absolute top-[-14px] left-8 badge bg-brand-forest text-white w-fit font-bold tracking-wide shadow-md">
                  Most popular
                </span>
              )}
              <div className="font-display font-bold text-2xl text-brand-forest mb-1">
                {p.name}
              </div>
              <div className="text-base text-brand-forest/60 mb-6">
                {p.desc}
              </div>

              <div className="mb-2 flex items-end gap-1">
                <span className="text-4xl font-mono font-bold text-brand-forest tracking-tight">
                  {p.price}
                </span>
                <span className="text-sm text-brand-forest/50 pb-1">
                  {" "}
                  {p.period}
                </span>
              </div>

              {p.annualPrice && (
                <div className="text-sm text-brand-sage-dark font-medium mb-8 bg-brand-sage/10 px-3 py-1 rounded-full w-fit">
                  or {p.annualPrice} — 2 months free
                </div>
              )}
              {!p.annualPrice && <div className="mb-8 h-[28px]" />}

              <ul className="text-base text-brand-forest/80 space-y-4 mb-10 flex-1 border-t border-gray-100 pt-8 PlansFeatureList">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-3 items-start">
                    <CheckCircle2
                      size={20}
                      className="text-brand-sage shrink-0 mt-0.5"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/signup"
                className={
                  p.highlight
                    ? "bg-brand-forest hover:bg-brand-forest-light text-white text-center rounded-full px-6 py-4 font-semibold transition text-lg shadow-lg hover:scale-105 transform"
                    : "bg-white border border-brand-forest/15 text-brand-forest text-center rounded-full px-6 py-4 font-semibold transition hover:bg-gray-50 hover:border-brand-forest/30 text-lg"
                }
              >
                Start 7-day free trial
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="bg-brand-cream/40 py-24 relative overflow-hidden">
        <svg
          className="absolute left-[-100px] top-[-100px] opacity-20 pointer-events-none"
          width="300"
          height="300"
          viewBox="0 0 300 300"
          fill="none"
        >
          <circle cx="150" cy="150" r="149" stroke="#89D7B7" />
        </svg>

        <div className="max-w-3xl mx-auto px-4 md:px-8 relative z-10">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <span className="inline-block bg-white text-brand-sage-dark px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 shadow-sm flex items-center gap-1.5 w-fit mx-auto">
              {" "}
              <HelpCircle size={14} /> FAQ
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-extrabold text-brand-forest">
              Common questions
            </h2>
          </motion.div>

          <motion.div
            className="space-y-4"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
          >
            {FAQS.map((f) => (
              <motion.div
                key={f.q}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-brand-sage/20 transition-colors"
                variants={fadeInUp}
              >
                <div className="font-display font-bold text-lg text-brand-forest mb-2">
                  {f.q}
                </div>
                <div className="text-base text-brand-forest/70 leading-relaxed text-sm">
                  {f.a}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-24 BG-WHITE">
        <motion.div
          className="rounded-[2.5rem] bg-brand-forest p-12 md:p-16 text-center shadow-xl relative overflow-hidden"
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <svg
            className="absolute left-[-50px] bottom-[-50px] opacity-10"
            width="200"
            height="200"
            viewBox="0 0 200 200"
            fill="none"
          >
            <circle cx="100" cy="100" r="99" stroke="white" />
          </svg>

          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-white mb-4 relative z-10">
            Still deciding? Talk to us.
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-xl mx-auto relative z-10">
            We're happy to walk through which plan fits your hospital before you
            commit to anything. Our team is ready to help.
          </p>

          <motion.div whileHover={{ scale: 1.05 }}>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2.5 bg-brand-mint hover:bg-brand-mint-dark text-brand-forest font-bold rounded-full px-8 py-4 transition text-lg shadow-lg group"
            >
              Contact our team{" "}
              <ArrowRight
                size={20}
                className="group-hover:translate-x-1 transition-transform"
              />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
