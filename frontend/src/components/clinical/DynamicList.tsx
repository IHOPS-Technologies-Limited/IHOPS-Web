import React from "react";

interface FieldDef {
  key: string;
  placeholder: string;
  width?: string;
  // "select" renders a fixed dropdown instead of free text — used for
  // fields backed by a strict enum on the backend (e.g. allergy type),
  // so a row can never fail validation from a typo or a value that
  // doesn't match the enum exactly.
  type?: "text" | "select";
  options?: string[];
}

export default function DynamicList({
  items,
  onChange,
  fields,
  addLabel,
}: {
  items: Record<string, string>[];
  onChange: (items: Record<string, string>[]) => void;
  fields: FieldDef[];
  addLabel: string;
}) {
  function updateRow(idx: number, key: string, value: string) {
    onChange(items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  }
  function removeRow(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function addRow() {
    onChange([...items, {}]);
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="flex flex-wrap gap-2 items-center bg-blue-50/60 rounded-lg p-2"
        >
          {fields.map((f) =>
            f.type === "select" ? (
              <select
                key={f.key}
                className={`input !py-1.5 text-sm ${f.width || "flex-1 min-w-[100px]"}`}
                value={item[f.key] || ""}
                onChange={(e) => updateRow(idx, f.key, e.target.value)}
              >
                <option value="">{f.placeholder}</option>
                {(f.options || []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={f.key}
                className={`input !py-1.5 text-sm ${f.width || "flex-1 min-w-[100px]"}`}
                placeholder={f.placeholder}
                value={item[f.key] || ""}
                onChange={(e) => updateRow(idx, f.key, e.target.value)}
              />
            ),
          )}
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="text-red-500 text-xs px-1"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="text-xs text-blue-600 font-medium hover:underline"
      >
        + {addLabel}
      </button>
    </div>
  );
}
