import React, { useState } from "react";
import { api } from "../../api/client";
import { Modal, ErrorBanner } from "../../components/ui";

export default function CloseVisitModal({ visit, onClose, onSaved }: { visit: any; onClose: () => void; onSaved: () => void }) {
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [amount, setAmount] = useState("");
  const [expectedTotal, setExpectedTotal] = useState("");
  const [method, setMethod] = useState("cash");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [expectedInsuranceAmount, setExpectedInsuranceAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<any>(null);

  async function close() {
    setLoading(true);
    setError(null);
    try {
      const body: any = { paymentStatus };
      if (paymentStatus === "paid") { body.amount = Number(amount); body.method = method; }
      if (paymentStatus === "partially_paid") { body.amount = Number(amount); body.expectedTotal = Number(expectedTotal); }
      if (paymentStatus === "covered_by_insurance") { body.insuranceProvider = insuranceProvider; body.expectedInsuranceAmount = Number(expectedInsuranceAmount); }
      const res = await api.post(`/visits/${visit.id}/close`, body);
      setDone(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Modal open onClose={onSaved} title="Visit closed">
        <p className="text-sm text-teal-900/70 mb-3">The visit for {visit.patient.name} has been closed.</p>
        {done.reminderQueued && <p className="text-sm text-teal-700 bg-teal-50 rounded-lg p-2">A follow-up reminder has been queued for delivery.</p>}
        {done.missingContact && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-2">Follow-up was requested but this patient has no contact detail on file for their preferred channel — no reminder was sent.</p>}
        <button className="btn-primary w-full mt-3" onClick={onSaved}>Done</button>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Close visit — ${visit.patient.name}`}>
      <ErrorBanner message={error} />
      <div className="space-y-3">
        <div>
          <label className="label">Payment status</label>
          <select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially paid</option>
            <option value="not_paid">Not paid</option>
            <option value="covered_by_insurance">Covered by insurance</option>
          </select>
        </div>
        {paymentStatus === "paid" && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Amount (₦)</label><input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><label className="label">Method</label>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option><option value="transfer">Transfer</option><option value="pos">POS</option><option value="other">Other</option>
              </select>
            </div>
          </div>
        )}
        {paymentStatus === "partially_paid" && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Expected total (₦)</label><input type="number" className="input" value={expectedTotal} onChange={(e) => setExpectedTotal(e.target.value)} /></div>
            <div><label className="label">Amount paid (₦)</label><input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
        )}
        {paymentStatus === "covered_by_insurance" && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Insurance provider</label><input className="input" value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} /></div>
            <div><label className="label">Expected amount (₦)</label><input type="number" className="input" value={expectedInsuranceAmount} onChange={(e) => setExpectedInsuranceAmount(e.target.value)} /></div>
          </div>
        )}
        <button className="btn-primary w-full" disabled={loading} onClick={close}>{loading ? "Closing…" : "Close visit"}</button>
      </div>
    </Modal>
  );
}
