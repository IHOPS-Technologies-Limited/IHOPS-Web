import React, { useState } from "react";
import { api } from "../../api/client";
import { Modal, ErrorBanner, Badge } from "../ui";

export default function CommunicationPayloadModal({
  noteId,
  onClose,
  onDone,
}: {
  noteId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [payload, setPayload] = useState<any>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function draft() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/ai-communication/payloads", {
        clinicalNoteId: noteId,
      });
      setPayload(res.payload);
      setEditedMessage(res.payload.generatedMessage || "");
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function approve() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(
        `/ai-communication/payloads/${payload.id}/approve`,
        { editedMessage },
      );
      setPayload(res.payload);
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(
        `/ai-communication/payloads/${payload.id}/reject`,
        { reason: rejectReason },
      );
      setPayload(res.payload);
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Restricted AI Communication">
      <ErrorBanner message={error} />
      {!payload ? (
        <div className="text-center py-6">
          <p className="text-sm text-slate-500 mb-4">
            This will build a Communication Payload from this note's Follow-up &
            Communication section only — never the diagnosis, allergies, or
            prescription — and draft a message for review.
          </p>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-50"
            disabled={loading}
            onClick={draft}
          >
            {loading ? "Building…" : "Build & draft message"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <Badge
            tone={
              payload.status === "sent"
                ? "teal"
                : payload.status === "rejected"
                  ? "alert"
                  : "amber"
            }
          >
            {payload.status.replace("_", " ")}
          </Badge>
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <div className="text-xs text-slate-500 mb-1">
              Approved instruction (what the AI was allowed to see)
            </div>
            {payload.approvedInstruction}
          </div>
          <div>
            <label className="label">
              Drafted message ({payload.preferredChannel})
            </label>
            <textarea
              className="input"
              rows={3}
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              disabled={payload.status !== "pending_review"}
            />
          </div>
          {payload.status === "pending_review" && (
            <>
              <div className="flex gap-2">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-50 flex-1"
                  disabled={loading}
                  onClick={approve}
                >
                  Approve & send
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Rejection reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <button
                  className="text-alert border border-alert rounded-lg px-3 text-sm shrink-0"
                  disabled={loading || !rejectReason}
                  onClick={reject}
                >
                  Reject
                </button>
              </div>
            </>
          )}
          {payload.status === "sent" && (
            <button
              className="bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-slate-50 w-full"
              onClick={onDone}
            >
              Done
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
