import React from "react";
import Navbar from "../../components/marketing/Navbar";
import Footer from "../../components/marketing/Footer";
import { ShieldAlert } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-white overflow-x-hidden">
      <section className="relative bg-gradient-to-br from-brand-forest via-brand-forest-light to-brand-sage pt-28 pb-20">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 md:px-8 text-center relative z-10">
          <span className="inline-flex items-center gap-2 bg-brand-mint/15 border border-brand-mint/30 text-brand-mint text-xs font-semibold tracking-wide uppercase rounded-full px-4 py-2">
            Legal
          </span>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-white leading-tight mt-5">
            Privacy Policy
          </h1>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 md:px-8 py-14">
        {/* <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-10 flex gap-3">
          <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>
              This page is a draft template, not a published policy.
            </strong>{" "}
            It's a starting point that reflects how the IHOPS platform actually
            handles data, based on the Nigeria Data Protection Act 2023. It has
            not been reviewed by a lawyer and should be before it's relied on
            publicly — replace this notice once that review is done.
          </div>
        </div> */}

        <div className="prose prose-slate max-w-none text-sm text-brand-forest/80 space-y-6">
          <div>
            <h2 className="font-display font-bold text-brand-forest text-lg mb-2">
              1. Who this covers
            </h2>
            <p>
              This policy describes how IHOPS ("we", "the platform") and the
              hospitals, clinics, and other facilities that use it ("our
              customers") handle personal data belonging to patients, hospital
              staff, and website visitors.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-brand-forest text-lg mb-2">
              2. What we collect
            </h2>
            <p>
              Patient data entered by hospital staff (contact details, visit
              history, clinical notes, payment records); hospital staff account
              data (name, contact details, role); and website visitor data
              (contact form submissions).
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-brand-forest text-lg mb-2">
              3. Why we process it
            </h2>
            <p>
              To provide the hospital operations platform itself — patient
              registration, visit tracking, clinical documentation, billing, and
              staff communication with patients about their own care.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-brand-forest text-lg mb-2">
              4. Your rights
            </h2>
            <p>
              Under the Nigeria Data Protection Act, data subjects can request
              access to their data, correction of inaccurate data, and erasure.
              Patients can make these requests to the hospital that holds their
              records; hospitals process access and erasure requests directly in
              IHOPS (Patient Profile → Data Protection).
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-brand-forest text-lg mb-2">
              5. How long we keep data
            </h2>
            <p>
              Patient clinical and financial records are retained per each
              hospital's own retention policy and applicable medical
              record-keeping requirements. Erasure requests result in
              anonymization of identifying details rather than deletion of the
              underlying clinical/financial record, consistent with standard
              healthcare record-retention practice.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-brand-forest text-lg mb-2">
              6. Security
            </h2>
            <p>
              Data is encrypted in transit, access is role-based and logged, and
              clinical data is never shared with the platform's AI features
              beyond an explicitly staff-approved instruction.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-brand-forest text-lg mb-2">
              7. Contact
            </h2>
            <p>
              Questions about this policy can be sent via the{" "}
              <a href="/contact" className="text-brand-sage-dark font-medium">
                Contact page
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
