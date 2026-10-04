import React, { useState } from "react";
import Navbar from "../../components/marketing/Navbar";
import Footer from "../../components/marketing/Footer";
import { api } from "../../api/client";
import { Mail, Phone, MapPin, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    hospitalName: "",
    phone: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/public/contact", form);
      setSent(true);
    } catch (err: any) {
      setError(err.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white overflow-x-hidden">
      <section className="relative bg-gradient-to-br from-brand-forest via-brand-forest-light to-brand-sage pt-28 pb-24">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 md:px-8 text-center relative z-10">
          <span className="inline-flex items-center gap-2 bg-brand-mint/15 border border-brand-mint/30 text-brand-mint text-xs font-semibold tracking-wide uppercase rounded-full px-4 py-2">
            Contact
          </span>
          <h1 className="text-3xl md:text-5xl font-display font-extrabold text-white leading-tight mt-5">
            Let's talk about your hospital
          </h1>
          <p className="text-white/70 mt-5 text-lg max-w-2xl mx-auto">
            Whether you're deciding between plans or ready to register today,
            we're happy to help.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 md:px-8 py-20 grid md:grid-cols-5 gap-10">
        <div className="md:col-span-2 space-y-5">
          <ContactCard icon={Mail} title="Email us" line="hello@ihops.ng" />
          <ContactCard icon={Phone} title="Call us" line="+234 800 000 0000" />
          <ContactCard
            icon={MapPin}
            title="Based in"
            line="Lagos, Nigeria — serving hospitals nationwide"
          />
        </div>

        <div className="md:col-span-3">
          {sent ? (
            <div className="bg-brand-cream/60 rounded-3xl p-10 text-center">
              <CheckCircle2
                size={40}
                className="text-brand-sage mx-auto mb-4"
              />
              <h2 className="font-display font-bold text-xl text-brand-forest mb-2">
                Message sent
              </h2>
              <p className="text-brand-forest/60 text-sm">
                Thanks, {form.name.split(" ")[0]} — we'll get back to you
                shortly.
              </p>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="bg-white border border-brand-forest/10 rounded-3xl p-7 space-y-4"
            >
              {error && (
                <div className="bg-red-50 border border-red-200 text-alert text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-brand-forest/80 mb-1 block">
                    Full name
                  </label>
                  <input
                    required
                    className="w-full border border-brand-forest/15 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-sage/30"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-brand-forest/80 mb-1 block">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    className="w-full border border-brand-forest/15 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-sage/30"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-brand-forest/80 mb-1 block">
                    Hospital name (optional)
                  </label>
                  <input
                    className="w-full border border-brand-forest/15 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-sage/30"
                    value={form.hospitalName}
                    onChange={(e) => set("hospitalName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-brand-forest/80 mb-1 block">
                    Phone (optional)
                  </label>
                  <input
                    className="w-full border border-brand-forest/15 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-sage/30"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-brand-forest/80 mb-1 block">
                  Message
                </label>
                <textarea
                  required
                  rows={5}
                  className="w-full border border-brand-forest/15 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-sage/30"
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-forest hover:bg-brand-forest-light text-white font-semibold rounded-full px-8 py-3 transition disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

function ContactCard({
  icon: Icon,
  title,
  line,
}: {
  icon: any;
  title: string;
  line: string;
}) {
  return (
    <div className="flex items-start gap-4 bg-brand-cream/50 rounded-2xl p-5">
      <span className="w-10 h-10 rounded-xl bg-white text-brand-sage-dark flex items-center justify-center shrink-0">
        <Icon size={18} />
      </span>
      <div>
        <div className="font-semibold text-brand-forest text-sm">{title}</div>
        <div className="text-brand-forest/60 text-sm">{line}</div>
      </div>
    </div>
  );
}
