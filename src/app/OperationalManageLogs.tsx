import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { API_URL } from "../services/api";

export function ManageLogsDialog({
  children, busy, onClose, label = "Manage Logs",
}: {
  children: ReactNode;
  busy: boolean;
  onClose: () => void;
  label?: string;
}) {
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-black/65 p-4"
      data-qrpass-manage-logs-overlay
      style={{ zIndex: 2147483000, isolation: "isolate" }}
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div data-qrpass-manage-v31="true" data-qrpass-manage-v32="true"
        role="dialog" aria-modal="true" aria-label={label}
        className="relative m-auto flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl border border-[#cbd5e1] bg-white text-[#17336d]"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,.28)" }}>
        <div className="flex shrink-0 items-center justify-between gap-4 bg-white px-6 pb-4 pt-5">
          <h3 className="text-xl font-bold text-[#142b54]">Manage Logs</h3>
          <button type="button" disabled={busy} onClick={onClose}
            className="rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-medium hover:bg-[#eef2ff]"
            data-qrpass-neutral-v169="true">Close</button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-6 pb-5 pt-1 text-[#17336d]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ManageLogsTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#cbd5e1] bg-white text-[#17336d]">
      <div className="max-h-[43vh] overflow-auto bg-white">
        <table className="w-full min-w-[400px] table-fixed border-collapse bg-white text-left text-sm text-[#17336d]">
          <thead className="sticky top-0 z-10 bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
            <tr>
              <th scope="col" className="w-[100px] border-b border-[#dbe3f0] px-3 py-3">Select</th>
              <th scope="col" className="border-b border-[#dbe3f0] px-3 py-3">Record</th>
              <th scope="col" className="w-[100px] border-b border-[#dbe3f0] px-3 py-3">Status</th>
              <th scope="col" className="w-[115px] border-b border-[#dbe3f0] px-3 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white text-[#17336d]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

type Module = "scans" | "resolved-incidents" | "requests" | "items";

type LogRecord = {
  id: number;
  title: string | null;
  status: string;
  date: string;
  person?: string;
  gate?: string;
  direction?: string;
  item_type?: string;
  serial_number?: string;
  qr_code?: string;
};

function recordDetails(record: LogRecord) {
  return [record.person, record.gate, record.direction, record.item_type, record.serial_number, record.qr_code]
    .filter(Boolean).join(" · ");
}

function downloadRecords(records: LogRecord[], filename: string) {
  const rows = [
    ["ID", "Record", "Details", "Status", "Date"],
    ...records.map(record => [record.id, record.title ?? "", recordDetails(record), record.status, record.date]),
  ];
  const csv = rows.map(row => row.map(value => {
    const cell = String(value ?? "");
    const escaped = /^[\s]*[=+@-]|^[\t\r\n]/.test(cell) ? "'" + cell : cell;
    return '"' + escaped.replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n");

  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function requestLogs(module: Module, suffix: string, init?: RequestInit) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Log in again to manage records.");

  const response = await fetch(`${API_URL}/operational-logs/${module}${suffix}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(data?.message || `Could not access Manage Logs (HTTP ${response.status}).`);
  }
  return data;
}

export function OperationalManageLogs({ module, onChange }: {
  module: Module;
  onChange: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" data-operational-manage-logs aria-label="Manage Logs" title="Manage Logs" onClick={() => setOpen(true)}
        className="inline-flex !h-12 !w-12 !min-w-12 shrink-0 items-center justify-center rounded-xl border !border-[#cbd5e1] !bg-white !p-0 !text-[#31539b] transition-colors hover:!border-[#a8bde4] hover:!bg-[#eef2ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5278e7]/20">
        <SlidersHorizontal size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && <OperationalLogDialog module={module} onClose={() => setOpen(false)} onChange={onChange} />}
    </>
  );
}

function OperationalLogDialog({ module, onClose, onChange }: {
  module: Module;
  onClose: () => void;
  onChange: () => void | Promise<void>;
}) {
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<LogRecord[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const view = archived ? "archived" : "active";
  const query = search.trim().toLowerCase();
  const visible = records.filter(record =>
    [record.id, record.title, recordDetails(record), record.status, record.date]
      .some(value => String(value ?? "").toLowerCase().includes(query)),
  );
  const allSelected = visible.length > 0 && visible.every(record => selected.has(record.id));
  const buttonClass = "inline-flex h-11 min-w-[96px] items-center justify-center rounded-xl border bg-white px-4 text-sm font-medium disabled:opacity-50";
  const actionClass = buttonClass + " border-[#cbd5e1] text-[#17336d] hover:bg-[#eef2ff]";
  const busy = loading || saving;

  useEffect(() => {
    const controller = new AbortController();
    requestLogs(module, `?view=${view}`, { signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) {
          if (!Array.isArray(data.data)) throw new Error("The server returned an invalid record list.");
          setRecords(data.data);
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [module, view, version]);

  function toggleView() {
    setArchived(value => !value);
    setRecords([]);
    setSelected(new Set());
    setLoading(true);
    setError("");
    setMessage("");
  }

  async function changeArchiveState() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { affected } = await requestLogs(module, "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: archived ? "restore" : "archive", ids: [...selected] }),
      });
      setMessage(`${affected} record${affected === 1 ? "" : "s"} ${archived ? "restored" : "archived"}.`);
      setSelected(new Set());
      setRecords([]);
      setLoading(true);
      setVersion(value => value + 1);
      await onChange();
    } catch (error) {
      setError(error instanceof Error ? error.message : "The operation failed.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: number) {
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectAllButton = (
    <button type="button" disabled={busy || !visible.length} className={actionClass}
      onClick={() => setSelected(previous => {
        const next = new Set(previous);
        visible.forEach(({ id }) => allSelected ? next.delete(id) : next.add(id));
        return next;
      })}>
      {allSelected ? "Deselect All" : "Select All"}
    </button>
  );

  return (
    <ManageLogsDialog busy={saving} onClose={onClose}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" disabled={busy} onClick={toggleView} className={actionClass + " shrink-0 sm:w-[156px]"}>
          {archived ? "Back to Records" : "View Archives"}
        </button>
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
          <input autoFocus type="search" aria-label="Search managed logs" value={search}
            onChange={event => setSearch(event.target.value)} placeholder="Search records..."
            className="h-12 w-full min-w-0 rounded-xl border border-[#c7d2fe] bg-white pl-10 pr-4 text-sm text-[#17336d]" />
        </div>
      </div>
      {message && <div role="status" className="rounded-xl border border-[#cbd5e1] bg-[#f5f8ff] px-3 py-2 text-sm">{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <ManageLogsTable>
        {visible.map(record => {
          const checked = selected.has(record.id);
          const details = recordDetails(record);
          return (
            <tr key={record.id} onClick={() => !busy && toggle(record.id)}
              className={`cursor-pointer border-b border-[#e4eaf2] transition-colors hover:bg-[#f1f5ff] ${checked ? "bg-[#eef2ff]" : "bg-white"}`}>
              <td className="px-3 py-3">
                <input type="checkbox" checked={checked} disabled={busy} aria-label={`Select record ${record.id}`}
                  onChange={() => toggle(record.id)} onClick={event => event.stopPropagation()} />
              </td>
              <td className="px-3 py-3">
                <span className="block truncate font-medium" title={record.title || undefined}>{record.title || `Record #${record.id}`}</span>
                <span className="block max-w-[380px] truncate text-xs text-[#64748b]" title={details}>{details}</span>
              </td>
              <td className="break-words px-3 py-3 capitalize">{record.status}</td>
              <td className="whitespace-nowrap px-3 py-3 text-xs">{record.date ? new Date(record.date.replace(" ", "T")).toLocaleDateString() : "—"}</td>
            </tr>
          );
        })}
        {!visible.length && <tr><td colSpan={4} className="p-6 text-center font-semibold">
          {loading ? "Loading records..." : error ? "Records unavailable." : archived ? "No matching archived records." : "No matching records."}
        </td></tr>}
      </ManageLogsTable>
      <div className={archived ? "flex flex-wrap items-center justify-between gap-2" : "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"}>
        <div className={archived ? "flex flex-wrap items-center gap-2" : undefined}>
          <p className="text-xs text-[#64748b]">
            {selected.size} selected · {visible.length} of {records.length} {archived ? "archived" : "active"} records
          </p>
          {archived && selectAllButton}
        </div>
        <div className={archived ? "ml-auto flex flex-wrap items-center justify-end gap-2" : "flex flex-wrap items-center justify-end gap-2 sm:shrink-0"}>
          {!archived && selectAllButton}
          <button type="button" disabled={busy || !selected.size} className={actionClass}
            onClick={() => downloadRecords(records.filter(record => selected.has(record.id)), `qrpass-${module}-${view}.csv`)}>
            Download
          </button>
          <button type="button" disabled={busy || !selected.size} className={actionClass} onClick={changeArchiveState}>
            {saving ? "Processing..." : archived ? "Restore" : "Archive"}
          </button>
          {archived && (
            <button type="button" disabled title="Permanent deletion is prohibited for operational logs."
              className={buttonClass + " border-red-200 text-red-700 !font-semibold [@media(max-width:640px)]:h-[42px] [@media(max-width:640px)]:px-3"}>
              Delete
            </button>
          )}
        </div>
      </div>
    </ManageLogsDialog>
  );
}
