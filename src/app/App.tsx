import { login, register, createItem, getItems, getPendingItems, approveItem, verifyItem, createScanLog, getScanLogs, getAllItems, } from "../services/api";
import { QRCodeSVG } from "qrcode.react";
import { Html5QrcodeScanner } from "html5-qrcode";
import React, { useState, useEffect, useId } from "react";
import {
  Shield, LogOut, Bell, ClipboardList, Users, FileText, Map,
  Settings, BarChart2, ChevronRight, CheckCircle, Clock,
  AlertTriangle, Eye, Menu, X, Lock, User, Plus, Search,
  Download, Filter, RefreshCw, QrCode, Package, ScanLine,
  BookOpen, AlertCircle, Layers, XCircle,
} from "lucide-react";

// ── QRpass Logo — shield-shaped QR code ──────────────────────────────────────
function QRpassLogo({ size = 96, showText = false }: { size?: number; showText?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const clipId = `qr-shield-${uid}`;

  // 15×15 QR-like grid
  const CELL = 8;
  const COLS = 15;
  const ROWS = 15;
  const PAD = 3;
  const W = COLS * CELL + PAD * 2;       // 123
  const shieldBotY = Math.round(ROWS * CELL * 0.63) + PAD; // ~78
  const tipY = ROWS * CELL + PAD - 2;    // 121

  // Finder pattern 7×7
  const FP = [
    [1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1],
  ];
  const grid: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    grid[r][c]     = FP[r][c]; // top-left
    grid[r][c + 8] = FP[r][c]; // top-right
    grid[r + 8][c] = FP[r][c]; // bottom-left
  }
  // Timing strips
  for (let i = 8; i < 13; i++) {
    if (grid[6][i] < 0) grid[6][i] = i % 2 === 0 ? 1 : 0;
    if (grid[i][6] < 0) grid[i][6] = i % 2 === 0 ? 1 : 0;
  }
  // Data cells — deterministic pseudo-random
  let s = 0xdeadbeef;
  const rnd = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000; };
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] < 0) grid[r][c] = rnd() > 0.42 ? 1 : 0;

  const pts = `${PAD},${PAD} ${W-PAD},${PAD} ${W-PAD},${shieldBotY} ${W/2},${tipY} ${PAD},${shieldBotY}`;
  const textH = showText ? 50 : 0;
  const totalH = tipY + textH + (showText ? 0 : PAD);

  return (
    <svg
      width={size}
      height={showText ? Math.round(size * totalH / W) : size}
      viewBox={`0 0 ${W} ${totalH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <polygon points={pts} />
        </clipPath>
      </defs>

      {/* Shield background */}
      <polygon points={pts} fill="white" />

      {/* QR cells clipped to shield */}
      <g clipPath={`url(#${clipId})`}>
        {grid.map((row, r) =>
          row.map((v, c) =>
            v === 1 ? (
              <rect
                key={`${r}-${c}`}
                x={PAD + c * CELL + 0.8}
                y={PAD + r * CELL + 0.8}
                width={CELL - 1.6}
                height={CELL - 1.6}
                fill="#003087"
              />
            ) : null
          )
        )}
      </g>

      {/* Shield outline */}
      <polygon points={pts} fill="none" stroke="#003087" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Yellow accent dot at tip */}
      <circle cx={W / 2} cy={tipY} r="2.5" fill="#f5c200" />

      {showText && (
        <>
          <text
            x={W / 2} y={tipY + 24}
            textAnchor="middle"
            fontFamily="Barlow, sans-serif"
            fontWeight="900"
            fontSize="23"
            fill="#003087"
            letterSpacing="4"
          >QRPASS</text>
          <text
            x={W / 2} y={tipY + 42}
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontWeight="600"
            fontSize="10"
            fill="#5a6a8a"
            letterSpacing="3"
          >SINCE 2026</text>
        </>
      )}
    </svg>
  );
}

// ── Fake QR code visual ───────────────────────────────────────────────────────
function QRCodeDisplay({
  value,
  size = 80,
}: {
  value: string;
  size?: number;
}) {
  if (!value) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-muted rounded-md flex items-center justify-center"
      >
        <QrCode size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      bgColor="#ffffff"
      fgColor="#003087"
      marginSize={4}
      title={`QR Code ${value}`}
    />
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "student" | "security" | "sao" | "sysadmin";

type View = "login" | "dashboard";

const ROLES: { id: Role; label: string; color: string; textColor: string }[] = [
  { id: "student", label: "Student", color: "#003087", textColor: "#fff" },
  { id: "security", label: "Security Personnel (CSU)", color: "#f5c200", textColor: "#0d1b3e" },
  { id: "sao", label: "PCO Staff", color: "#00aeef", textColor: "#fff" },
  { id: "sysadmin", label: "System Administrator", color: "#e8edf5", textColor: "#0d1b3e" },
];

// ── Shared UI ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-card rounded-lg p-4 border border-border flex items-center gap-4 shadow-sm">
      <div className="rounded-md p-3 flex-shrink-0" style={{ backgroundColor: color + "20", color }}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function NotifItem({ type, message, time }: { type: "success" | "warning" | "info"; message: string; time: string }) {
  const icons = {
    success: <CheckCircle size={15} className="text-green-500" />,
    warning: <AlertTriangle size={15} className="text-yellow-500" />,
    info: <Bell size={15} className="text-blue-500" />,
  };
  const bg = { success: "bg-green-50 border-green-100", warning: "bg-yellow-50 border-yellow-100", info: "bg-blue-50 border-blue-100" };
  return (
    <div className={`flex gap-3 p-3 rounded-md border text-sm ${bg[type]}`}>
      <span className="flex-shrink-0 mt-0.5">{icons[type]}</span>
      <div>
        <p className="text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Approved: "bg-green-100 text-green-700",
    Active: "bg-green-100 text-green-700",
    Registered: "bg-green-100 text-green-700",
    Verified: "bg-green-100 text-green-700",
    Pending: "bg-yellow-100 text-yellow-700",
    Rejected: "bg-red-100 text-red-600",
    Expired: "bg-gray-100 text-gray-500",
    Flagged: "bg-orange-100 text-orange-600",
    Recovered: "bg-blue-100 text-blue-600",
    Lost: "bg-red-100 text-red-600",
    Found: "bg-teal-100 text-teal-700",
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border border-border shadow-sm">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: "Barlow, sans-serif" }}>{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Sample item data ──────────────────────────────────────────────────────────
const sampleItems = [
  { id: "ITEM-001", name: "Laptop Dell XPS 15", serial: "SN-92841", type: "Laptop", owner: "Adrian N. Badon", ownerID: "22-1234", status: "Registered", date: "Jun 10, 2026", expires: "Dec 10, 2026", qr: "QRPASS-001-SN92841" },
  { id: "ITEM-002", name: "iPad Pro 12.9 (2024)", serial: "SN-77210", type: "Tablet", owner: "Adrian N. Badon", ownerID: "22-1234", status: "Pending", date: "Jun 14, 2026", expires: "—", qr: "QRPASS-002-SN77210" },
  { id: "ITEM-003", name: "DJI Mini 4 Pro Drone", serial: "SN-30412", type: "Equipment", owner: "Adrian N. Badon", ownerID: "22-1234", status: "Pending", date: "Jun 8, 2026", expires: "—", qr: "" },
  { id: "ITEM-004", name: "Samsung Galaxy S24 Ultra", serial: "SN-54321", type: "Mobile Phone", owner: "Adrian N. Badon", ownerID: "22-1234", status: "Registered", date: "May 20, 2026", expires: "Nov 20, 2026", qr: "QRPASS-004-SN54321" },
];

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT PAGES
// ══════════════════════════════════════════════════════════════════════════════
function StudentRegisterItem() {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [form, setForm] = useState({
    item_name: "",
    brand_model: "",
    serial_number: "",
    color: "",
    item_type: "Laptop",
    purpose: "",
  });

  async function loadItems() {
    try {
      setLoadingItems(true);

      const data = await getItems();

      setItems(data.items ?? []);
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleItemSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSubmitting(true);

      await createItem(form);

      alert("Item registration submitted successfully!");

      setForm({
        item_name: "",
        brand_model: "",
        serial_number: "",
        color: "",
        item_type: "Laptop",
        purpose: "",
      });

      setShowForm(false);

      await loadItems();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Item registration failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Register Item"
        subtitle="Submit a new item for QR code registration. Items must be approved by PCO before a QR code is issued."
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-3 py-2 rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={13} /> New Registration
          </button>
        }
      />

      {showForm && (
        <Card title="Item Registration Form">
          <form
            onSubmit={handleItemSubmit}
            className="p-4 grid md:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Item Name / Description
              </label>

              <input
                type="text"
                value={form.item_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    item_name: e.target.value,
                  })
                }
                placeholder="e.g. Laptop Dell XPS 15"
                required
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Brand & Model
              </label>

              <input
                type="text"
                value={form.brand_model}
                onChange={(e) =>
                  setForm({
                    ...form,
                    brand_model: e.target.value,
                  })
                }
                placeholder="e.g. Dell XPS 15 9530"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Serial Number
              </label>

              <input
                type="text"
                value={form.serial_number}
                onChange={(e) =>
                  setForm({
                    ...form,
                    serial_number: e.target.value,
                  })
                }
                placeholder="e.g. SN-00000"
                required
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Color
              </label>

              <input
                type="text"
                value={form.color}
                onChange={(e) =>
                  setForm({
                    ...form,
                    color: e.target.value,
                  })
                }
                placeholder="e.g. Silver"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Item Type
              </label>

              <select
                value={form.item_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    item_type: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option>Laptop</option>
                <option>Mobile Phone</option>
                <option>Tablet</option>
                <option>Camera</option>
                <option>Audio Equipment</option>
                <option>Other Equipment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Purpose / Reason for Bringing
              </label>

              <input
                type="text"
                value={form.purpose}
                onChange={(e) =>
                  setForm({
                    ...form,
                    purpose: e.target.value,
                  })
                }
                placeholder="e.g. Academic use, thesis documentation"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="md:col-span-2 bg-yellow-50 border border-yellow-200 rounded-md p-3 text-xs text-yellow-800">
              <strong>Note:</strong> After submission, your item will
              be reviewed by PCO. A QR code will be issued after
              approval.
            </div>

            <div className="md:col-span-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-xs px-3 py-2 border border-border rounded-md text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="text-xs bg-primary text-white px-4 py-2 rounded-md hover:opacity-90 font-semibold disabled:opacity-50"
              >
                {submitting
                  ? "Submitting..."
                  : "Submit for Approval"}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="My Registered Items"
        action={
          <button
            onClick={loadItems}
            className="text-xs flex items-center gap-1 text-primary font-medium"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                {[
                  "Item ID",
                  "Item",
                  "Type",
                  "Serial No.",
                  "Status",
                  "Date Filed",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2 px-3 text-xs text-muted-foreground font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loadingItems ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-6 text-sm text-muted-foreground"
                  >
                    Loading items...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-6 text-sm text-muted-foreground"
                  >
                    No registered items yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const displayStatus =
                    item.status?.charAt(0).toUpperCase() +
                    item.status?.slice(1);

                  return (
                    <tr
                      key={item.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">
                        ITEM-{String(item.id).padStart(3, "0")}
                      </td>

                      <td className="py-2.5 px-3 text-sm text-foreground font-medium">
                        {item.item_name}
                      </td>

                      <td className="py-2.5 px-3 text-xs text-muted-foreground">
                        {item.item_type}
                      </td>

                      <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">
                        {item.serial_number}
                      </td>

                      <td className="py-2.5 px-3">
                        <StatusBadge status={displayStatus} />
                      </td>

                      <td className="py-2.5 px-3 text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString(
                          "en-PH",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StudentMyQRCodes() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMyItems() {
    try {
      setLoading(true);

      const data = await getItems();

      setItems(data.items ?? []);
    } catch (error) {
      console.error("Failed to load QR codes:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyItems();
  }, []);

  const approvedItems = items.filter(
    (item) => item.status === "approved" && item.qr_code
  );

  const pendingItems = items.filter(
    (item) => item.status === "pending"
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="My QR Codes"
        subtitle="Approved items with their QR codes. Present these to security during inspection or exit."
        action={
          <button
            onClick={loadMyItems}
            className="text-xs flex items-center gap-1 text-primary font-medium"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Loading QR codes...
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">

          {approvedItems.map((item) => (
            <div
              key={item.id}
              onClick={() =>
                setSelected(
                  selected?.id === item.id ? null : item
                )
              }
              className="bg-card rounded-lg border-2 cursor-pointer transition-all hover:shadow-md"
              style={{
                borderColor:
                  selected?.id === item.id
                    ? "#003087"
                    : "var(--border)",
              }}
            >
              <div className="p-4 flex gap-4 items-start">

                <QRCodeDisplay
                  value={item.qr_code}
                  size={88}
                />

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground">
                    {item.item_name}
                  </p>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.item_type}
                  </p>

                  <div className="mt-2 space-y-1">

                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Serial:
                      </span>

                      <span className="font-mono text-foreground">
                        {item.serial_number}
                      </span>
                    </div>

                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground">
                        QR ID:
                      </span>

                      <span className="font-mono text-foreground">
                        {item.qr_code}
                      </span>
                    </div>

                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Registered:
                      </span>

                      <span className="text-foreground">
                        {new Date(
                          item.created_at
                        ).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                  </div>

                  <div className="mt-2">
                    <StatusBadge status="Approved" />
                  </div>
                </div>
              </div>

              {selected?.id === item.id && (
                <div className="border-t border-border px-4 py-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    QR ID:
                    <span className="font-mono text-primary ml-2">
                      {item.qr_code}
                    </span>
                  </p>
                </div>
              )}
            </div>
          ))}

          {pendingItems.map((item) => (
            <div
              key={item.id}
              className="bg-card rounded-lg border border-dashed border-yellow-300 p-4 flex gap-4 items-center opacity-70"
            >
              <div className="w-[88px] h-[88px] bg-yellow-50 border border-yellow-200 rounded-md flex flex-col items-center justify-center gap-1 flex-shrink-0">
                <Clock
                  size={22}
                  className="text-yellow-500"
                />

                <span className="text-xs text-yellow-600 font-medium">
                  Pending
                </span>
              </div>

              <div>
                <p className="font-semibold text-sm text-foreground">
                  {item.item_name}
                </p>

                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.item_type} · {item.serial_number}
                </p>

                <p className="text-xs text-yellow-600 mt-2">
                  Awaiting PCO approval — QR code will be issued
                  upon approval.
                </p>
              </div>
            </div>
          ))}

          {approvedItems.length === 0 &&
            pendingItems.length === 0 && (
              <div className="md:col-span-2 text-center py-10 text-sm text-muted-foreground">
                You don't have any registered items yet.
              </div>
            )}

        </div>
      )}
    </div>
  );
}

function StudentPermitStatus() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadItems() {
    try {
      setLoading(true);

      const data = await getItems();

      setItems(data.items ?? []);
    } catch (error) {
      console.error("Failed to load permit status:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  const pendingCount = items.filter(
    (item) => item.status === "pending"
  ).length;

  const approvedCount = items.filter(
    (item) => item.status === "approved"
  ).length;


  return (
    <div className="space-y-5">
      <PageHeader
        title="Permit Status"
        subtitle="Track the approval status of your registered items."
        action={
          <button
            onClick={loadItems}
            className="text-xs flex items-center gap-1 text-primary font-medium"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Requests"
          value={String(items.length)}
          icon={<Package size={20} />}
          color="#003087"
        />

        <StatCard
          label="Pending"
          value={String(pendingCount)}
          icon={<Clock size={20} />}
          color="#f5c200"
        />

        <StatCard
          label="Approved"
          value={String(approvedCount)}
          icon={<CheckCircle size={20} />}
          color="#2ecc71"
        />

      
      </div>

      <Card title="My Item Permit Requests">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                {[
                  "Item",
                  "Type",
                  "Brand / Model",
                  "Serial Number",
                  "Date Registered",
                  "QR ID",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="text-left py-2 px-3 text-xs text-muted-foreground font-medium"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    Loading permit requests...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    You have no registered items yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-border hover:bg-muted/30"
                  >
                    <td className="py-3 px-3 text-sm font-medium">
                      {item.item_name}
                    </td>

                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      {item.item_type}
                    </td>

                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      {item.brand_model || "—"}
                    </td>

                    <td className="py-3 px-3 text-xs font-mono">
                      {item.serial_number}
                    </td>

                    <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(
                        item.created_at
                      ).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    <td className="py-3 px-3 text-xs font-mono text-primary">
                      {item.qr_code || "Not issued yet"}
                    </td>

                    <td className="py-3 px-3">
                      <StatusBadge
                        status={
                          item.status === "approved"
                            ? "Approved"
                            : "Pending"
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Shared Lost & Found store (module-level for demo) ─────────────────────
type LFItem = {
  id: string;
  type: "lost" | "found";
  item: string;
  description: string;
  location: string;
  date: string;
  postedBy: string;
  postedByRole: "student" | "security";
  imageUrl?: string;
  status: "Open" | "Claimed" | "Recovered";
  inquiries: { name: string; message: string; time: string }[];
};
let _lfItems: LFItem[] = [
  { id: "LF-001", type: "found", item: "Laptop Bag (Black, Jansport)", description: "Found near the library entrance, has stickers on it.", location: "Library", date: "Jun 15, 2026", postedBy: "Guard Ramos", postedByRole: "security", status: "Open", inquiries: [] },
  { id: "LF-002", type: "lost", item: "Samsung Earbuds (White)", description: "Lost after lunch, last seen at the canteen table.", location: "Canteen", date: "Jun 14, 2026", postedBy: "John Dela Cruz", postedByRole: "student", status: "Open", inquiries: [] },
  { id: "LF-003", type: "found", item: "Laptop Charger (Dell, 65W)", description: "Left in Room 201 after class. Adapter included.", location: "Room 201", date: "Jun 12, 2026", postedBy: "Guard Santos", postedByRole: "security", status: "Open", inquiries: [] },
  { id: "LF-004", type: "found", item: "iPad with Blue Case", description: "Found at Gate 1 guardhouse. Screen has a small crack.", location: "Gate 1", date: "Jun 10, 2026", postedBy: "Guard Ramos", postedByRole: "security", status: "Claimed", inquiries: [{ name: "Maria Santos", message: "This is mine! I can show my receipt.", time: "Jun 11, 2026 – 9:00 AM" }] },
];
let _lfListeners: (() => void)[] = [];
function getLFItems() { return [..._lfItems]; }
function addLFItem(item: LFItem) { _lfItems = [item, ..._lfItems]; _lfListeners.forEach(fn => fn()); }
function updateLFItem(id: string, patch: Partial<LFItem>) { _lfItems = _lfItems.map(i => i.id === id ? { ...i, ...patch } : i); _lfListeners.forEach(fn => fn()); }
function useLFItems() {
  const [items, setItems] = useState(getLFItems);
  useEffect(() => {
    const refresh = () => setItems(getLFItems());
    _lfListeners.push(refresh);
    return () => { _lfListeners = _lfListeners.filter(fn => fn !== refresh); };
  }, []);
  return items;
}

// ── Shared notifications store ────────────────────────────────────────────────
type AppNotif = { id: string; role: "student" | "security"; type: "success" | "warning" | "info"; message: string; time: string };
let _notifs: AppNotif[] = [];
let _notifListeners: (() => void)[] = [];
function addNotif(n: Omit<AppNotif, "id">) { _notifs = [{ ...n, id: Date.now().toString() }, ..._notifs]; _notifListeners.forEach(fn => fn()); }
function getNotifsForRole(role: "student" | "security") { return _notifs.filter(n => n.role === role); }
function useNotifs(role: "student" | "security") {
  const [items, setItems] = useState(() => getNotifsForRole(role));
  useEffect(() => {
    const refresh = () => setItems(getNotifsForRole(role));
    _notifListeners.push(refresh);
    return () => { _notifListeners = _notifListeners.filter(fn => fn !== refresh); };
  }, [role]);
  return items;
}

function StudentLostAndFound() {
  const items = useLFItems();
  const [selectedItem, setSelectedItem] = useState<LFItem | null>(null);
  const [inquiryMsg, setInquiryMsg] = useState("");
  const [inquirySent, setInquirySent] = useState<string[]>([]);

  function handleInquire(lf: LFItem) {
    if (!inquiryMsg.trim()) return;
    updateLFItem(lf.id, {
      inquiries: [...lf.inquiries, { name: "Adrian N. Badon", message: inquiryMsg, time: new Date().toLocaleString("en-PH") }],
    });
    addNotif({ role: "security", type: "info", message: `Student Adrian N. Badon inquired about: "${lf.item}"`, time: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) });
    setInquiryMsg("");
    setSelectedItem(null);
    setInquirySent(prev => [...prev, lf.id]);
  }

  function handleClaim(lf: LFItem) {
    updateLFItem(lf.id, { status: "Claimed" });
    addNotif({ role: "security", type: "success", message: `Student Adrian N. Badon claimed item: "${lf.item}" — please verify ownership at the guardhouse.`, time: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) });
    setSelectedItem(null);
    setInquirySent(prev => [...prev, lf.id]);
  }

  const statusColor: Record<string, string> = { Open: "bg-blue-100 text-blue-700", Claimed: "bg-green-100 text-green-700", Recovered: "bg-teal-100 text-teal-700" };
  const typeColor = { lost: "bg-red-100 text-red-700", found: "bg-teal-100 text-teal-700" };

  return (
    <div className="space-y-5">
      <PageHeader title="Lost & Found" subtitle="Browse lost and found items posted by Security Personnel. Inquire or claim items that belong to you." />
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
        <AlertTriangle size={14} className="text-yellow-600 flex-shrink-0" />
        <p className="text-xs text-yellow-800">Only Security Personnel (CSU) are authorized to post lost or found items. Contact the guardhouse to report a lost item.</p>
      </div>
      <div className="space-y-3">
        {items.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">No lost & found items posted yet.</div>
        )}
        {items.map(lf => (
          <div key={lf.id} className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="flex gap-3 p-4">
              {lf.imageUrl ? (
                <img src={lf.imageUrl} alt={lf.item} className="w-20 h-20 object-cover rounded-md flex-shrink-0 border border-border" />
              ) : (
                <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                  <Package size={24} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${typeColor[lf.type]}`}>{lf.type}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[lf.status]}`}>{lf.status}</span>
                </div>
                <p className="font-semibold text-sm text-foreground mt-1">{lf.item}</p>
                <p className="text-xs text-muted-foreground">{lf.description}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  <span>📍 {lf.location}</span>
                  <span>📅 {lf.date}</span>
                  <span>👤 Posted by: {lf.postedBy}</span>
                </div>
                {lf.status === "Open" && !inquirySent.includes(lf.id) && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setSelectedItem(selectedItem?.id === lf.id ? null : lf)}
                      className="text-xs bg-primary text-white px-3 py-1.5 rounded font-semibold hover:opacity-90">
                      Inquire
                    </button>
                    {lf.type === "found" && (
                      <button onClick={() => handleClaim(lf)}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded font-semibold hover:opacity-90">
                        Claim This Item
                      </button>
                    )}
                  </div>
                )}
                {inquirySent.includes(lf.id) && (
                  <p className="text-xs text-green-600 font-medium mt-2">✓ Inquiry / Claim submitted — Security has been notified. Please proceed to the guardhouse.</p>
                )}
                {lf.status === "Claimed" && !inquirySent.includes(lf.id) && (
                  <p className="text-xs text-muted-foreground mt-2 italic">This item has already been claimed.</p>
                )}
              </div>
            </div>
            {selectedItem?.id === lf.id && (
              <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-2">
                <p className="text-xs font-semibold text-foreground">Send an inquiry message to Security:</p>
                <textarea
                  value={inquiryMsg}
                  onChange={e => setInquiryMsg(e.target.value)}
                  placeholder="Describe why you think this is your item or ask for more details..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setSelectedItem(null)} className="text-xs px-3 py-1.5 border border-border rounded text-muted-foreground hover:bg-muted">Cancel</button>
                  <button onClick={() => handleInquire(lf)} className="text-xs bg-primary text-white px-3 py-1.5 rounded font-semibold hover:opacity-90">Send Inquiry</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentNotifications() {
  const liveNotifs = useNotifs("student");
  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" subtitle="Alerts and updates from the QRpass system." />
      <Card title="All Notifications" action={<button className="text-xs text-muted-foreground hover:text-foreground">Mark all as read</button>}>
        <div className="p-3 space-y-2">
          {liveNotifs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No notifications yet.</p>}
          {liveNotifs.map(n => <NotifItem key={n.id} type={n.type} message={n.message} time={n.time} />)}
          <NotifItem type="success" message="Your Laptop Dell XPS 15 has been approved by PCO. QR code is now active." time="Jun 10, 2026 – 9:42 AM" />
          <NotifItem type="warning" message="iPad Pro registration requires additional documentation from the registrar." time="Jun 14, 2026 – 2:15 PM" />
          <NotifItem type="info" message="Scheduled campus QR item check on June 18 — ensure all items are QR-registered." time="Jun 13, 2026 – 10:00 AM" />
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECURITY (CSU) PAGES
// ══════════════════════════════════════════════════════════════════════════════
function SecurityScanVerify() {
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [input, setInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const [gate, setGate] = useState("Gate 1");
  const [logging, setLogging] = useState(false);

  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  async function verifyCode(code: string) {
    const cleanCode = code.trim();

    if (!cleanCode) {
      setVerifyError("Please enter a QR ID or serial number.");
      setScanResult(null);
      return;
    }

    try {
      setVerifying(true);
      setVerifyError("");
      setScanResult(null);

      const data = await verifyItem(cleanCode);

      setInput(cleanCode);
      setScanResult(data.item);
    } catch (error) {
      setScanResult(null);

      setVerifyError(
        error instanceof Error
          ? error.message
          : "Item verification failed."
      );
    } finally {
      setVerifying(false);
    }
  }

  async function doScan() {
    await verifyCode(input);
  }

  async function loadRecentLogs() {
    try {
      setLoadingLogs(true);

      const data = await getScanLogs();

      setRecentLogs((data.logs ?? []).slice(0, 5));
    } catch (error) {
      console.error("Failed to load recent scan logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function handleLog(direction: "IN" | "OUT") {
    if (!scanResult) {
      alert("Please verify an item first.");
      return;
    }

    try {
      setLogging(true);

      await createScanLog(
        scanResult.id,
        gate,
        direction
      );

      await loadRecentLogs();

      alert(`Item logged ${direction} successfully!`);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to save scan log."
      );
    } finally {
      setLogging(false);
    }
  }

  useEffect(() => {
    loadRecentLogs();
  }, []);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: {
          width: 220,
          height: 220,
        },
      },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner
          .clear()
          .then(() => {
            verifyCode(decodedText);
          })
          .catch(() => {
            verifyCode(decodedText);
          });
      },
      () => {
        // Normal while camera is searching for a QR code.
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Scan & Verify"
        subtitle="Scan an item's QR code or enter the QR ID or serial number to verify registration status."
      />

      {/* QR SCANNER */}
      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-md">
            <div id="qr-reader" className="w-full" />
          </div>

          {/* MANUAL INPUT */}
          <div className="w-full max-w-sm flex gap-2">
            <div className="relative flex-1">
              <QrCode
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    doScan();
                  }
                }}
                placeholder="QR ID or serial number..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <button
              onClick={doScan}
              disabled={verifying}
              className="bg-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify"}
            </button>
          </div>

          {/* ERROR */}
          {verifyError && (
            <div className="w-full max-w-sm bg-red-50 border border-red-200 text-red-700 text-xs rounded-md p-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} />

                <span>{verifyError}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VERIFIED ITEM */}
      {scanResult && (
        <div className="bg-card rounded-lg border-2 border-green-400 p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <QRCodeDisplay
              value={scanResult.qr_code}
              size={90}
            />

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle
                  size={18}
                  className="text-green-500"
                />

                <span className="font-bold text-base text-green-600">
                  ITEM VERIFIED ✓
                </span>
              </div>

              {/* ITEM DETAILS */}
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">
                    Item:{" "}
                  </span>

                  <span className="font-medium">
                    {scanResult.item_name}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Type:{" "}
                  </span>

                  <span className="font-medium">
                    {scanResult.item_type}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Brand / Model:{" "}
                  </span>

                  <span className="font-medium">
                    {scanResult.brand_model || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Color:{" "}
                  </span>

                  <span className="font-medium">
                    {scanResult.color || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Serial No.:{" "}
                  </span>

                  <span className="font-mono font-medium">
                    {scanResult.serial_number}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    QR ID:{" "}
                  </span>

                  <span className="font-mono font-medium text-primary">
                    {scanResult.qr_code}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Registered Owner:{" "}
                  </span>

                  <span className="font-medium">
                    {scanResult.user?.name ?? "Unknown"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Owner ID:{" "}
                  </span>

                  <span className="font-mono font-medium">
                    {scanResult.user?.username ?? "—"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Date Registered:{" "}
                  </span>

                  <span className="font-medium">
                    {new Date(
                      scanResult.created_at
                    ).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex gap-1.5 items-center">
                  <span className="text-muted-foreground">
                    Status:
                  </span>

                  <StatusBadge status="Approved" />
                </div>
              </div>

              {/* ENTRY / EXIT CONTROLS */}
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Entry / Exit Log
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={gate}
                    onChange={(e) => setGate(e.target.value)}
                    className="px-3 py-2 text-xs border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="Gate 1">
                      Gate 1
                    </option>

                    <option value="Gate 2">
                      Gate 2
                    </option>

                    <option value="Gate 3">
                      Gate 3
                    </option>

                    <option value="Main Entrance">
                      Main Entrance
                    </option>
                  </select>

                  <button
                    onClick={() => handleLog("IN")}
                    disabled={logging}
                    className="text-xs bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {logging
                      ? "Saving..."
                      : "Log IN"}
                  </button>

                  <button
                    onClick={() => handleLog("OUT")}
                    disabled={logging}
                    className="text-xs bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {logging
                      ? "Saving..."
                      : "Log OUT"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECENT SCAN LOGS */}
      <Card
        title="Recent Scan Logs"
        action={
          <button
            onClick={loadRecentLogs}
            disabled={loadingLogs}
            className="text-xs flex items-center gap-1 text-primary font-medium disabled:opacity-50"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                {[
                  "Time",
                  "QR ID",
                  "Item",
                  "Owner",
                  "Gate",
                  "Direction",
                  "Result",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="text-left py-2 px-3 text-xs text-muted-foreground font-medium whitespace-nowrap"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loadingLogs ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-6 text-sm text-muted-foreground"
                  >
                    Loading recent scans...
                  </td>
                </tr>
              ) : recentLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-6 text-sm text-muted-foreground"
                  >
                    No scan records yet.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(
                        log.scanned_at
                      ).toLocaleString("en-PH", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-2.5 px-3 text-xs font-mono text-primary whitespace-nowrap">
                      {log.qr_code}
                    </td>

                    <td className="py-2.5 px-3 text-sm font-medium whitespace-nowrap">
                      {log.item?.item_name ?? "Unknown"}
                    </td>

                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {log.item?.user?.name ?? "Unknown"}
                    </td>

                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {log.gate}
                    </td>

                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs font-bold ${
                          log.direction === "IN"
                            ? "text-green-600"
                            : "text-blue-600"
                        }`}
                      >
                        {log.direction}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <StatusBadge
                        status={log.result}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SecurityEntryExitLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLogs() {
    try {
      setLoading(true);

      const data = await getScanLogs();

      setLogs(data.logs ?? []);
    } catch (error) {
      console.error("Failed to load scan logs:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  // Today's date
  const today = new Date();

  // Only scans made today
  const todayLogs = logs.filter((log) => {
    const scanDate = new Date(log.scanned_at);

    return (
      scanDate.getFullYear() === today.getFullYear() &&
      scanDate.getMonth() === today.getMonth() &&
      scanDate.getDate() === today.getDate()
    );
  });

  // Verified scans today
  const verifiedCount = todayLogs.filter(
    (log) => log.result === "Verified"
  ).length;

  // Flagged scans today
  const flaggedCount = todayLogs.filter(
    (log) => log.result === "Flagged"
  ).length;

  // Unique students today
  const uniqueUsers = new Set(
    todayLogs
      .map((log) => log.item?.user?.id)
      .filter(Boolean)
  ).size;

  // CSV export
  function handleExport() {
    if (logs.length === 0) {
      alert("There are no entry / exit records to export.");
      return;
    }

    const headers = [
      "Date",
      "Time",
      "Student / Person",
      "ID",
      "Item",
      "QR ID",
      "Gate",
      "Direction",
      "Scanned By",
      "Result",
    ];

    function escapeCSV(value: any) {
      const text = String(value ?? "");

      return `"${text.replace(/"/g, '""')}"`;
    }

    const rows = logs.map((log) => {
      const scannedDate = new Date(log.scanned_at);

      return [
        scannedDate.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),

        scannedDate.toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
        }),

        log.item?.user?.name ?? "Unknown",
        log.item?.user?.username ?? "—",
        log.item?.item_name ?? "Unknown",
        log.qr_code ?? "—",
        log.gate ?? "—",
        log.direction ?? "—",
        log.scanner?.name ?? "Unknown",
        log.result ?? "—",
      ];
    });

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) =>
        row.map(escapeCSV).join(",")
      ),
    ].join("\n");

    const blob = new Blob(
      ["\uFEFF" + csvContent],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    const fileDate = new Date()
      .toISOString()
      .split("T")[0];

    link.href = url;

    link.download =
      `QRPass-Entry-Exit-Log-${fileDate}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Entry / Exit Log"
        subtitle="Record of all QR-scanned items at campus entry and exit points."
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="text-xs flex items-center gap-1 text-primary font-medium disabled:opacity-50"
            >
              <RefreshCw size={12} />

              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              onClick={handleExport}
              disabled={logs.length === 0}
              className="text-xs flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-md font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Download size={12} />
              Export CSV
            </button>
          </div>
        }
      />

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Scanned Today"
          value={String(todayLogs.length)}
          icon={<ScanLine size={20} />}
          color="#003087"
        />

        <StatCard
          label="Verified"
          value={String(verifiedCount)}
          icon={<CheckCircle size={20} />}
          color="#2ecc71"
        />

        <StatCard
          label="Flagged"
          value={String(flaggedCount)}
          icon={<AlertTriangle size={20} />}
          color="#e8543a"
        />

        <StatCard
          label="Unique Students"
          value={String(uniqueUsers)}
          icon={<Users size={20} />}
          color="#f5c200"
        />
      </div>

      {/* ENTRY / EXIT RECORDS */}
      <Card
        title="Entry / Exit Records"
        action={
          <span className="text-xs text-muted-foreground">
            {logs.length} total records
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                {[
                  "Date",
                  "Time",
                  "Student / Person",
                  "ID",
                  "Item",
                  "QR ID",
                  "Gate",
                  "Direction",
                  "Scanned By",
                  "Result",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="text-left py-2 px-3 text-xs text-muted-foreground font-medium whitespace-nowrap"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    Loading scan logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    No entry / exit records yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const scannedDate = new Date(
                    log.scanned_at
                  );

                  return (
                    <tr
                      key={log.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {scannedDate.toLocaleDateString(
                          "en-PH",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {scannedDate.toLocaleTimeString(
                          "en-PH",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-sm text-foreground whitespace-nowrap">
                        {log.item?.user?.name ??
                          "Unknown"}
                      </td>

                      <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {log.item?.user?.username ??
                          "—"}
                      </td>

                      <td className="py-2.5 px-3 text-sm text-foreground whitespace-nowrap">
                        {log.item?.item_name ??
                          "Unknown"}
                      </td>

                      <td className="py-2.5 px-3 text-xs font-mono text-primary whitespace-nowrap">
                        {log.qr_code}
                      </td>

                      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {log.gate}
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`text-xs font-bold ${
                            log.direction === "IN"
                              ? "text-green-600"
                              : "text-blue-600"
                          }`}
                        >
                          {log.direction}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {log.scanner?.name ??
                          "Unknown"}
                      </td>

                      <td className="py-2.5 px-3">
                        <StatusBadge
                          status={log.result}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SecurityReports() {
  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Security inspection and QR verification reports." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Inspections Done" value="48" icon={<ClipboardList size={20} />} color="#003087" />
        <StatCard label="QR Scans This Month" value="6,240" icon={<ScanLine size={20} />} color="#00aeef" />
        <StatCard label="Flagged Items" value="12" icon={<AlertTriangle size={20} />} color="#e8543a" />
        <StatCard label="Incidents Resolved" value="10" icon={<CheckCircle size={20} />} color="#2ecc71" />
      </div>
      <Card title="Available Reports">
        <div className="divide-y divide-border">
          {[["Daily QR Scan Summary", "Jun 16, 2026", "PDF"], ["Weekly Inspection Log", "Jun 10–16, 2026", "PDF"], ["Flagged Items Report", "Jun 2026", "Excel"], ["Entry/Exit Summary", "Jun 2026", "Excel"]].map(([name, period, fmt]) => (
            <div key={name as string} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div>
                <p className="text-sm text-foreground font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{period}</p>
              </div>
              <button className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
                <Download size={13} /> {fmt}
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SecurityNotifications() {
  const liveNotifs = useNotifs("security");
  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" subtitle="Security alerts and QRpass system updates." />
      <Card title="All Alerts">
        <div className="p-3 space-y-2">
          {liveNotifs.map(n => <NotifItem key={n.id} type={n.type} message={n.message} time={n.time} />)}
          <NotifItem type="warning" message="Unregistered camera (Nikon D5600) detected at Gate 1 — no QR code presented." time="Jun 16, 2026 – 8:15 AM" />
          <NotifItem type="warning" message="QR scan failed for item SN-UNKNOWN at Gate 2 — item not found in registry." time="Jun 16, 2026 – 9:30 AM" />
          <NotifItem type="success" message="Campus inspection of Building A completed. 47/47 items verified." time="Jun 16, 2026 – 7:50 AM" />
        </div>
      </Card>
    </div>
  );
}

function SecurityLostFound() {
  const items = useLFItems();
  const [tab, setTab] = useState<"view" | "post">("view");
  const [postType, setPostType] = useState<"lost" | "found">("found");
  const [postItem, setPostItem] = useState("");
  const [postDesc, setPostDesc] = useState("");
  const [postLocation, setPostLocation] = useState("");
  const [postImage, setPostImage] = useState<string | undefined>();
  const [postSuccess, setPostSuccess] = useState(false);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPostImage(URL.createObjectURL(file));
  }

  function handleMarkClaimed(id: string, itemName: string) {
    updateLFItem(id, { status: "Claimed" });
    addNotif({ role: "student", type: "success", message: `Your item "${itemName}" has been marked as Claimed by Security. Please proceed to the guardhouse.`, time: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) });
  }

  function handlePost(e: React.FormEvent) {
    e.preventDefault();
    const newItem: LFItem = {
      id: `LF-${Date.now()}`,
      type: postType,
      item: postItem,
      description: postDesc,
      location: postLocation,
      date: new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }),
      postedBy: "Guard Ramos",
      postedByRole: "security",
      imageUrl: postImage,
      status: "Open",
      inquiries: [],
    };
    addLFItem(newItem);
    const msg = postType === "found"
      ? `Security found an item: "${postItem}" at ${postLocation}. Check Lost & Found if it's yours.`
      : `Security posted a lost item report: "${postItem}" at ${postLocation}. Contact the guardhouse if you have information.`;
    addNotif({ role: "student", type: postType === "found" ? "info" : "warning", message: msg, time: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) });
    setPostItem(""); setPostDesc(""); setPostLocation(""); setPostImage(undefined); setPostSuccess(true);
    setTimeout(() => { setPostSuccess(false); setTab("view"); }, 2000);
  }

  const typeColor: Record<string, string> = { lost: "bg-red-100 text-red-700", found: "bg-teal-100 text-teal-700" };
  const statusColor: Record<string, string> = { Open: "bg-blue-100 text-blue-700", Claimed: "bg-green-100 text-green-700", Recovered: "bg-teal-100 text-teal-700" };

  return (
    <div className="space-y-5">
      <PageHeader title="Lost & Found" subtitle="Post lost or found items and manage student inquiries and claims." />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Reports" value={String(items.length)} icon={<BookOpen size={20} />} color="#003087" />
        <StatCard label="Open" value={String(items.filter(i => i.status === "Open").length)} icon={<Clock size={20} />} color="#f5c200" />
        <StatCard label="Claimed" value={String(items.filter(i => i.status === "Claimed").length)} icon={<CheckCircle size={20} />} color="#2ecc71" />
      </div>
      <div className="flex gap-2 border-b border-border">
        {(["view", "post"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-semibold border-b-2 transition-colors"
            style={{ borderColor: tab === t ? "#003087" : "transparent", color: tab === t ? "#003087" : "var(--muted-foreground)" }}>
            {t === "view" ? "All Reports" : "Post Item"}
          </button>
        ))}
      </div>

      {tab === "view" && (
        <div className="space-y-3">
          {items.map(lf => (
            <div key={lf.id} className="bg-card rounded-lg border border-border shadow-sm">
              <div className="flex gap-3 p-4">
                {lf.imageUrl ? (
                  <img src={lf.imageUrl} alt={lf.item} className="w-20 h-20 object-cover rounded-md flex-shrink-0 border border-border" />
                ) : (
                  <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                    <Package size={24} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${typeColor[lf.type]}`}>{lf.type}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[lf.status]}`}>{lf.status}</span>
                  </div>
                  <p className="font-semibold text-sm text-foreground mt-1">{lf.item}</p>
                  <p className="text-xs text-muted-foreground">{lf.description}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>📍 {lf.location}</span><span>📅 {lf.date}</span><span>👤 {lf.postedBy}</span>
                  </div>
                  {lf.inquiries.length > 0 && (
                    <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-md p-2">
                      <p className="text-xs font-semibold text-yellow-800 mb-1">📬 {lf.inquiries.length} Inquiry / Claim</p>
                      {lf.inquiries.map((inq, i) => (
                        <div key={i} className="text-xs text-yellow-700"><strong>{inq.name}:</strong> {inq.message} <span className="text-yellow-500">— {inq.time}</span></div>
                      ))}
                    </div>
                  )}
                  {lf.status === "Open" && (
                    <button onClick={() => handleMarkClaimed(lf.id, lf.item)}
                      className="mt-2 text-xs bg-green-600 text-white px-3 py-1.5 rounded font-semibold hover:opacity-90">
                      Mark as Claimed
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "post" && (
        <div className="bg-card rounded-lg border border-border shadow-sm">
          <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-sm text-foreground">Post a Lost or Found Item</h3></div>
          {postSuccess ? (
            <div className="p-8 flex flex-col items-center gap-3">
              <CheckCircle size={36} className="text-green-500" />
              <p className="font-semibold text-foreground">Item posted! Students have been notified.</p>
            </div>
          ) : (
            <form onSubmit={handlePost} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">Type</label>
                <div className="flex gap-3">
                  {(["found", "lost"] as const).map(t => (
                    <button type="button" key={t} onClick={() => setPostType(t)}
                      className="flex-1 py-2 rounded-md border-2 font-semibold text-sm capitalize transition-all"
                      style={{ borderColor: postType === t ? "#003087" : "var(--border)", backgroundColor: postType === t ? "#003087" : "white", color: postType === t ? "white" : "var(--foreground)" }}>
                      {t === "found" ? "📦 Found Item" : "🔍 Lost Item"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
              {([["Item Name", postItem, setPostItem, "e.g. Laptop bag, charger..."], ["Location", postLocation, setPostLocation, "e.g. Gate 1, Library"]] as const).map(([label, val, setter, ph]) => (                  <div key={label as string}>
                    <label className="block text-xs font-semibold text-foreground mb-1">{label}</label>
                    <input type="text" value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} placeholder={ph as string} required
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
                  <textarea value={postDesc} onChange={e => setPostDesc(e.target.value)} required rows={2}
                    placeholder="Describe the item — color, brand, condition, distinguishing marks..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1">Upload Photo (optional)</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload}
                    className="block w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:opacity-90" />
                  {postImage && <img src={postImage} alt="preview" className="mt-2 h-24 object-cover rounded-md border border-border" />}
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="text-xs bg-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90">Post Item</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PCO PAGES
// ══════════════════════════════════════════════════════════════════════════════
function PCOPermitRequests() {
  const [pending, setPending] = useState<any[]>([]);
  const [approved, setApproved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  async function loadPendingItems() {
    try {
      setLoading(true);

      const data = await getPendingItems();

      setPending(data.items ?? []);
    } catch (error) {
      console.error("Failed to load pending items:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPendingItems();
  }, []);

  async function handleApprove(item: any) {
    try {
      setApprovingId(item.id);

      const data = await approveItem(item.id);

      alert("Item approved and QR code issued successfully!");

      setPending((prev) =>
        prev.filter((p) => p.id !== item.id)
      );

      setApproved((prev) => [
        {
          ...item,
          ...data.item,
          approvedAt: new Date().toLocaleString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev,
      ]);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to approve item."
      );
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Item Registration Requests"
        subtitle="Review and approve student item registration requests. Approval triggers QR code generation."
        action={
          <button
            onClick={loadPendingItems}
            className="text-xs flex items-center gap-1 text-primary font-medium"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label="Pending Review"
          value={String(pending.length)}
          icon={<Clock size={20} />}
          color="#f5c200"
        />

        <StatCard
          label="Approved This Session"
          value={String(approved.length)}
          icon={<CheckCircle size={20} />}
          color="#003087"
        />

        <StatCard
          label="QR Codes Issued"
          value={String(approved.length)}
          icon={<QrCode size={20} />}
          color="#00aeef"
        />
      </div>

      <Card
        title="Pending Requests"
        action={
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">
            {pending.length} pending
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                {[
                  "Ref #",
                  "Student",
                  "ID",
                  "Item",
                  "Type",
                  "Serial No.",
                  "Date Filed",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2 px-3 text-xs text-muted-foreground font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    Loading pending requests...
                  </td>
                </tr>
              ) : pending.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    No pending item registration requests.
                  </td>
                </tr>
              ) : (
                pending.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">
                      REQ-{String(item.id).padStart(3, "0")}
                    </td>

                    <td className="py-2.5 px-3 text-sm text-foreground font-medium">
                      {item.user?.name ?? "Unknown"}
                    </td>

                    <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">
                      {item.user?.username ?? "—"}
                    </td>

                    <td className="py-2.5 px-3 text-sm text-foreground">
                      {item.item_name}
                    </td>

                    <td className="py-2.5 px-3 text-xs text-muted-foreground">
                      {item.item_type}
                    </td>

                    <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">
                      {item.serial_number}
                    </td>

                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(
                        item.created_at
                      ).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={approvingId === item.id}
                        className="text-xs bg-primary text-white px-3 py-1.5 rounded font-semibold hover:opacity-90 whitespace-nowrap disabled:opacity-50"
                      >
                        {approvingId === item.id
                          ? "Approving..."
                          : "Approve & Issue QR"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {approved.length > 0 && (
        <Card title="Approved Requests">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  {[
                    "Ref #",
                    "Student",
                    "Item",
                    "Serial No.",
                    "QR Code",
                    "Status",
                    "Approved At",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2 px-3 text-xs text-muted-foreground font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {approved.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-border"
                  >
                    <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">
                      REQ-{String(item.id).padStart(3, "0")}
                    </td>

                    <td className="py-2.5 px-3 text-sm font-medium">
                      {item.user?.name ?? "Unknown"}
                    </td>

                    <td className="py-2.5 px-3 text-sm">
                      {item.item_name}
                    </td>

                    <td className="py-2.5 px-3 text-xs font-mono">
                      {item.serial_number}
                    </td>

                    <td className="py-2.5 px-3 text-xs font-mono text-primary">
                      {item.qr_code}
                    </td>

                    <td className="py-2.5 px-3">
                      <StatusBadge status="Approved" />
                    </td>

                    <td className="py-2.5 px-3 text-xs text-green-600 whitespace-nowrap">
                      {item.approvedAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PCOItemRegistry() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadItems() {
    try {
      setLoading(true);

      const data = await getAllItems();

      setItems(data.items ?? []);
    } catch (error) {
      console.error("Failed to load registered items:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  // SEARCH
  const filteredItems = items.filter((item) => {
    const keyword = search.toLowerCase().trim();

    return (
      item.item_name?.toLowerCase().includes(keyword) ||
      item.brand_model?.toLowerCase().includes(keyword) ||
      item.serial_number?.toLowerCase().includes(keyword) ||
      item.qr_code?.toLowerCase().includes(keyword) ||
      item.item_type?.toLowerCase().includes(keyword) ||
      item.user?.name?.toLowerCase().includes(keyword) ||
      item.user?.username?.toLowerCase().includes(keyword)
    );
  });

  // SUMMARY
  const approvedCount = items.filter(
    (item) => item.status === "approved"
  ).length;

  const pendingCount = items.filter(
    (item) => item.status === "pending"
  ).length;

  // EXPORT FULL ITEM REGISTRY
  function handleExportRegistry() {
    if (items.length === 0) {
      alert("There are no item records to export.");
      return;
    }

    const headers = [
      "Owner",
      "Owner ID",
      "Item",
      "Type",
      "Brand / Model",
      "Serial Number",
      "Color",
      "Purpose",
      "QR ID",
      "Date Registered",
      "Status",
    ];

    function escapeCSV(value: any) {
      const text = String(value ?? "");

      return `"${text.replace(/"/g, '""')}"`;
    }

    const rows = items.map((item) => [
      item.user?.name ?? "Unknown",
      item.user?.username ?? "—",
      item.item_name ?? "—",
      item.item_type ?? "—",
      item.brand_model ?? "—",
      item.serial_number ?? "—",
      item.color ?? "—",
      item.purpose ?? "—",
      item.qr_code ?? "Not issued",
      new Date(item.created_at).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      item.status === "approved"
        ? "Approved"
        : "Pending",
    ]);

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) =>
        row.map(escapeCSV).join(",")
      ),
    ].join("\n");

    const blob = new Blob(
      ["\uFEFF" + csvContent],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    const fileDate = new Date()
      .toISOString()
      .split("T")[0];

    link.href = url;

    link.download =
      `QRPass-Item-Registry-${fileDate}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Item Registry"
        subtitle="View and manage the centralized registry of campus items."
        action={
          <button
            onClick={loadItems}
            disabled={loading}
            className="text-xs flex items-center gap-1 text-primary font-medium disabled:opacity-50"
          >
            <RefreshCw size={12} />

            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        }
      />

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label="Total Items"
          value={String(items.length)}
          icon={<Package size={20} />}
          color="#003087"
        />

        <StatCard
          label="Approved"
          value={String(approvedCount)}
          icon={<CheckCircle size={20} />}
          color="#2ecc71"
        />

        <StatCard
          label="Pending"
          value={String(pendingCount)}
          icon={<Clock size={20} />}
          color="#f5c200"
        />
      </div>

      <Card
        title="Registered Items"
        action={
          <button
            onClick={handleExportRegistry}
            disabled={items.length === 0}
            className="text-xs flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-md font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <Download size={12} />
            Export CSV
          </button>
        }
      >
        {/* SEARCH */}
        <div className="mb-4">
          <div className="relative w-full md:max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search item, owner, serial number, or QR ID..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* RESULT COUNT */}
        {search && !loading && (
          <div className="mb-3 text-xs text-muted-foreground">
            Showing {filteredItems.length} of{" "}
            {items.length} item(s)
          </div>
        )}

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                {[
                  "Owner",
                  "Owner ID",
                  "Item",
                  "Type",
                  "Brand / Model",
                  "Serial Number",
                  "QR ID",
                  "Date Registered",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="text-left py-2 px-3 text-xs text-muted-foreground font-medium whitespace-nowrap"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    Loading registered items...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    {search
                      ? "No matching registered items found."
                      : "No registered items found."}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                  >
                    {/* OWNER */}
                    <td className="py-3 px-3 text-sm font-medium whitespace-nowrap">
                      {item.user?.name ?? "Unknown"}
                    </td>

                    {/* OWNER ID */}
                    <td className="py-3 px-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {item.user?.username ?? "—"}
                    </td>

                    {/* ITEM */}
                    <td className="py-3 px-3 text-sm font-medium whitespace-nowrap">
                      {item.item_name}
                    </td>

                    {/* TYPE */}
                    <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {item.item_type}
                    </td>

                    {/* BRAND / MODEL */}
                    <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {item.brand_model || "—"}
                    </td>

                    {/* SERIAL NUMBER */}
                    <td className="py-3 px-3 text-xs font-mono whitespace-nowrap">
                      {item.serial_number}
                    </td>

                    {/* QR ID */}
                    <td className="py-3 px-3 text-xs font-mono text-primary whitespace-nowrap">
                      {item.qr_code || "Not issued"}
                    </td>

                    {/* DATE REGISTERED */}
                    <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(
                        item.created_at
                      ).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    {/* STATUS */}
                    <td className="py-3 px-3">
                      <StatusBadge
                        status={
                          item.status === "approved"
                            ? "Approved"
                            : "Pending"
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PCOReports() {
  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Item registration and approval reports." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Monthly Approvals" value="94" icon={<CheckCircle size={20} />} color="#003087" />
        <StatCard label="QR Codes Issued" value="94" icon={<QrCode size={20} />} color="#00aeef" />
        <StatCard label="Still Pending" value="8" icon={<Clock size={20} />} color="#f5c200" />
        <StatCard label="Pending" value="8" icon={<Clock size={20} />} color="#f5c200" />
      </div>
      <Card title="Available Reports">
        <div className="divide-y divide-border">
          {[["Monthly Item Registration Summary", "Jun 2026", "PDF"], ["QR Code Issuance Log", "Jun 2026", "Excel"], ["Approval History with Timestamps", "Jun 2026", "PDF"], ["Item Registry Export", "All time", "Excel"]].map(([name, period, fmt]) => (
            <div key={name as string} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div>
                <p className="text-sm text-foreground font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{period}</p>
              </div>
              <button className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
                <Download size={13} /> {fmt}
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PCONotifications() {
  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" subtitle="PCO alerts and item registration updates." />
      <Card title="All Notifications">
        <div className="p-3 space-y-2">
          <NotifItem type="warning" message="8 item registration requests are awaiting PCO approval." time="Jun 16, 2026 – 8:00 AM" />
          <NotifItem type="success" message="12 items approved and QR codes issued today." time="Jun 16, 2026 – 12:00 PM" />
          <NotifItem type="info" message="System reminder: Monthly PCO item registration report due June 30." time="Jun 14, 2026 – 9:00 AM" />
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PAGES
// ══════════════════════════════════════════════════════════════════════════════
function AdminDashboard() {
  return (
    <div className="space-y-5">
      <PageHeader title="Overview Dashboard" subtitle="System-wide summary of QRpass operations." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Items Registered" value="842" icon={<Package size={20} />} color="#003087" />
        <StatCard label="QR Codes Active" value="820" icon={<QrCode size={20} />} color="#00aeef" />
        <StatCard label="Scans Today" value="214" icon={<ScanLine size={20} />} color="#f5c200" />
        <StatCard label="Incidents" value="4" icon={<AlertTriangle size={20} />} color="#e8543a" />
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <Card title="Registration Trend (June 2026)">
          <div className="p-4 space-y-2">
            {[["Laptops", 241, "#003087"], ["Mobile Phones", 198, "#00aeef"], ["Tablets", 142, "#f5c200"], ["Cameras", 89, "#2ecc71"], ["Other Equipment", 172, "#8b5cf6"]].map(([label, count, color]) => (
              <div key={label as string}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-foreground">{label}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((count as number) / 842 * 100)}%`, backgroundColor: color as string }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Recent System Activity">
          <div className="divide-y divide-border">
            {[["PCO approved Laptop Dell XPS for Maria Santos", "9:45 AM"], ["QR scan flagged at Gate 1 — unknown item", "8:15 AM"], ["Building A inspection completed by Guard Ramos", "7:50 AM"], ["Student 22-5678 submitted new item registration", "7:30 AM"]].map(([msg, t]) => (
              <div key={t as string} className="px-4 py-2.5 flex justify-between gap-3">
                <span className="text-xs text-foreground">{msg}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{t}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function AdminRecords() {
  return (
    <div className="space-y-5">
      <PageHeader title="System Records" subtitle="Centralized records for all QRpass transactions." />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Records" value="5,284" icon={<Layers size={20} />} color="#003087" />
        <StatCard label="This Month" value="642" icon={<FileText size={20} />} color="#f5c200" />
        <StatCard label="Flagged" value="8" icon={<AlertTriangle size={20} />} color="#e8543a" />
      </div>
      <Card title="Recent Records" action={<button className="text-xs text-primary flex items-center gap-1 font-medium"><Filter size={12} /> Filter</button>}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-muted/50">
              {["Record ID", "Type", "Description", "Handled By", "Date", "Status"].map(h => <th key={h} className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {[
                ["REC-4521", "Registration", "Laptop Dell XPS approved — QR issued", "PCO", "Jun 10", "Approved"],
                ["REC-4522", "Scan Incident", "Unregistered camera at Gate 1", "Security", "Jun 16", "Flagged"],
                ["REC-4523", "Inspection", "Building A inspection completed", "Guard Ramos", "Jun 16", "Verified"],
                ["REC-4524", "Registration", "DJI Drone rejected — policy violation", "PCO", "Jun 8", "Rejected"],
              ].map(([id, type, desc, by, date, status]) => (
                <tr key={id as string} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">{id}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{type}</td>
                  <td className="py-2.5 px-3 text-sm text-foreground max-w-xs truncate">{desc}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{by}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{date}, 2026</td>
                  <td className="py-2.5 px-3"><StatusBadge status={status as string} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AdminAnalytics() {
  return (
    <div className="space-y-5">
      <PageHeader title="Reports & Analytics" subtitle="Generate and download system-wide reports." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Reports This Month" value="32" icon={<BarChart2 size={20} />} color="#003087" />
        <StatCard label="Registration Reports" value="14" icon={<FileText size={20} />} color="#f5c200" />
        <StatCard label="Incident Reports" value="5" icon={<AlertTriangle size={20} />} color="#e8543a" />
        <StatCard label="Inspection Reports" value="13" icon={<ClipboardList size={20} />} color="#00aeef" />
      </div>
      <Card title="Available Reports">
        <div className="divide-y divide-border">
          {[["Monthly Item Registration Summary", "Jun 2026", "PDF"], ["QR Code Scan Activity Report", "Jun 2026", "Excel"], ["Gate Entry/Exit Log", "Jun 16, 2026", "PDF"], ["Flagged Items & Incidents Log", "Jun 2026", "Excel"], ["Lost & Found Summary", "Jun 2026", "PDF"]].map(([name, period, fmt]) => (
            <div key={name as string} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div>
                <p className="text-sm text-foreground font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{period}</p>
              </div>
              <button className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
                <Download size={13} /> {fmt}
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AdminNotifications() {
  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" subtitle="Administrative alerts and system updates." />
      <Card title="All Notifications">
        <div className="p-3 space-y-2">
          <NotifItem type="warning" message="4 flagged QR scan incidents require administrative review." time="Jun 16, 2026 – 8:00 AM" />
          <NotifItem type="info" message="Monthly system report due by June 30, 2026." time="Jun 14, 2026 – 9:00 AM" />
          <NotifItem type="success" message="Campus-wide QR inspection for June 18 has been scheduled." time="Jun 13, 2026 – 3:00 PM" />
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SYSADMIN PAGES
// ══════════════════════════════════════════════════════════════════════════════
function SysAdminUserAccounts() {
  type UserEntry = { id: string; name: string; username: string; role: string; lastLogin: string; status: "Active" | "Disabled" };
  const [users, setUsers] = useState<UserEntry[]>([
    { id: "1", name: "Adrian N. Badon", username: "22-1234", role: "Student", lastLogin: "Jun 16, 9:02 AM", status: "Active" },
    { id: "2", name: "Guard Ramos", username: "guard.ramos", role: "Security (CSU)", lastLogin: "Jun 16, 7:00 AM", status: "Active" },
    { id: "3", name: "PCO De paz", username: "pco.depaz", role: "PCO Staff", lastLogin: "Jun 15, 4:30 PM", status: "Active" },
    { id: "4", name: "Rodel Cuyos", username: "admin.cuyos", role: "Admin", lastLogin: "Jun 16, 8:45 AM", status: "Active" },
  ]);
  const [editUser, setEditUser] = useState<UserEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", username: "", role: "Student" });
  const [search, setSearch] = useState("");

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  function handleToggle(id: string) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === "Active" ? "Disabled" : "Active" } : u));
  }
  function handleSaveEdit() {
    if (!editUser) return;
    setUsers(prev => prev.map(u => u.id === editUser.id ? editUser : u));
    setEditUser(null);
  }
  function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setUsers(prev => [...prev, { id: Date.now().toString(), name: newUser.name, username: newUser.username, role: newUser.role, lastLogin: "Never", status: "Active" }]);
    setNewUser({ name: "", username: "", role: "Student" });
    setShowAdd(false);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="User Accounts" subtitle="Manage all QRpass user accounts and role-based access." action={
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-3 py-2 rounded-md hover:opacity-90">
          <Plus size={13} /> Add User
        </button>
      } />

      {showAdd && (
        <Card title="Add New User">
          <form onSubmit={handleAddUser} className="p-4 grid md:grid-cols-3 gap-4">
            {[["Full Name", "name", "text", "e.g. Juan Dela Cruz"], ["Username / ID", "username", "text", "e.g. 22-5678"]].map(([label, key, type, ph]) => (
              <div key={key as string}>
                <label className="block text-xs font-semibold text-foreground mb-1">{label}</label>
                <input type={type as string} placeholder={ph as string} value={(newUser as any)[key as string]}
                  onChange={e => setNewUser(prev => ({ ...prev, [key as string]: e.target.value }))} required
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Role</label>
              <select value={newUser.role} onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30">
                {["Student", "Security (CSU)", "PCO Staff", "Admin"].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="md:col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)} className="text-xs px-3 py-2 border border-border rounded-md text-muted-foreground hover:bg-muted">Cancel</button>
              <button type="submit" className="text-xs bg-primary text-white px-4 py-2 rounded-md font-semibold hover:opacity-90">Add User</button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Users" value={String(users.length)} icon={<Users size={20} />} color="#003087" />
        <StatCard label="Active" value={String(users.filter(u => u.status === "Active").length)} icon={<CheckCircle size={20} />} color="#2ecc71" />
        <StatCard label="Disabled" value={String(users.filter(u => u.status === "Disabled").length)} icon={<X size={20} />} color="#e8543a" />
        <StatCard label="Active Sessions" value="247" icon={<Eye size={20} />} color="#f5c200" />
      </div>

      <Card title="User List" action={
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 text-xs border border-border rounded-md bg-muted/50 w-48 focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Search users..." />
        </div>
      }>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-muted/50">
              {["Name", "Username", "Role", "Last Login", "Status", "Actions"].map(h => <th key={h} className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  {editUser?.id === u.id ? (
                    <>
                      <td className="py-1.5 px-3"><input value={editUser.name} onChange={e => setEditUser({ ...editUser, name: e.target.value })} className="w-full px-2 py-1 text-sm border border-primary/40 rounded focus:outline-none focus:ring-1 focus:ring-primary/30" /></td>
                      <td className="py-1.5 px-3"><input value={editUser.username} onChange={e => setEditUser({ ...editUser, username: e.target.value })} className="w-full px-2 py-1 text-xs font-mono border border-primary/40 rounded focus:outline-none focus:ring-1 focus:ring-primary/30" /></td>
                      <td className="py-1.5 px-3">
                        <select value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })} className="w-full px-2 py-1 text-xs border border-primary/40 rounded focus:outline-none">
                          {["Student", "Security (CSU)", "PCO Staff", "Admin"].map(r => <option key={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground">{u.lastLogin}</td>
                      <td className="py-1.5 px-3"><StatusBadge status={u.status} /></td>
                      <td className="py-1.5 px-3">
                        <div className="flex gap-1">
                          <button onClick={handleSaveEdit} className="text-xs bg-primary text-white px-2 py-1 rounded hover:opacity-90">Save</button>
                          <button onClick={() => setEditUser(null)} className="text-xs border border-border px-2 py-1 rounded hover:bg-muted">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-3 text-sm text-foreground font-medium">{u.name}</td>
                      <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground">{u.username}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{u.role}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{u.lastLogin}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={u.status} /></td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          <button onClick={() => setEditUser(u)} className="text-xs text-primary font-medium hover:underline">Edit</button>
                          <span className="text-muted-foreground">·</span>
                          <button onClick={() => handleToggle(u.id)} className={`text-xs font-medium hover:underline ${u.status === "Active" ? "text-red-500" : "text-green-600"}`}>
                            {u.status === "Active" ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SysAdminSettings() {
  return (
    <div className="space-y-5">
      <PageHeader title="System Settings" subtitle="Configure QRpass portal settings and security policies." />
      <div className="grid md:grid-cols-2 gap-5">
        <Card title="General Settings">
          <div className="p-4 space-y-4">
            {[["System Name", "QRpass"], ["Institution", "University of Cebu – Main Campus"], ["Academic Year", "2025-2026"], ["Semester", "2nd Semester"]].map(([label, value]) => (
              <div key={label as string}>
                <label className="block text-xs font-semibold text-foreground mb-1">{label}</label>
                <input defaultValue={value as string} className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            ))}
            <button className="text-xs bg-primary text-white px-4 py-2 rounded-md font-semibold hover:opacity-90">Save Settings</button>
          </div>
        </Card>
        <Card title="QR & Security Policy">
          <div className="p-4 space-y-4">
            {[["Session Timeout (minutes)", "30"], ["Max Login Attempts", "5"], ["QR Code Validity (months)", "6"]].map(([label, value]) => (
              <div key={label as string}>
                <label className="block text-xs font-semibold text-foreground mb-1">{label}</label>
                <input defaultValue={value as string} type="number" className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            ))}
            <div className="flex items-center justify-between p-3 border border-border rounded-md">
              <span className="text-sm text-foreground">Enable Two-Factor Auth</span>
              <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5" />
              </div>
            </div>
            <button className="text-xs bg-primary text-white px-4 py-2 rounded-md font-semibold hover:opacity-90">Save Policy</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SysAdminAuditLogs() {
  return (
    <div className="space-y-5">
      <PageHeader title="Audit Logs" subtitle="Complete record of all system activity, QR scans, and user actions." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Logs Today" value="1,024" icon={<FileText size={20} />} color="#003087" />
        <StatCard label="QR Scan Events" value="214" icon={<ScanLine size={20} />} color="#00aeef" />
        <StatCard label="Data Changes" value="382" icon={<RefreshCw size={20} />} color="#f5c200" />
        <StatCard label="Errors" value="3" icon={<AlertTriangle size={20} />} color="#e8543a" />
      </div>
      <Card title="Recent Audit Log" action={
        <div className="flex gap-2">
          <button className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"><Filter size={12} /> Filter</button>
          <button className="text-xs text-primary flex items-center gap-1 font-medium"><Download size={12} /> Export</button>
        </div>
      }>
        <div className="divide-y divide-border">
          {[
            ["PCO De paz", "Approved item registration for Maria Santos — QR code QRPASS-001 issued", "9:45 AM", "success"],
            ["Guard Ramos", "QR scan: QRPASS-001-SN92841 — Verified at Gate 1", "7:02 AM", "info"],
            ["System", "Flagged unknown QR code scan attempt at Gate 1", "8:15 AM", "warning"],
            ["22-1234", "Submitted item registration for iPad Pro 12.9", "7:30 AM", "info"],
            ["Admin Lim", "Updated QR code validity period to 6 months", "9:00 AM", "info"],
          ].map(([u, a, t, type]) => (
            <div key={`${u}-${t}`} className="px-4 py-2.5 flex gap-3 hover:bg-muted/30 transition-colors">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${type === "warning" ? "bg-yellow-100" : type === "success" ? "bg-green-100" : "bg-primary/10"}`}>
                <User size={12} className={type === "warning" ? "text-yellow-600" : type === "success" ? "text-green-600" : "text-primary"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">{u}</p>
                  <p className="text-xs text-muted-foreground">{t}</p>
                </div>
                <p className="text-xs text-muted-foreground">{a}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SysAdminPerformance() {
  return (
    <div className="space-y-5">
      <PageHeader title="Performance" subtitle="System health, uptime, and QRpass resource usage." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Uptime" value="99.9%" icon={<CheckCircle size={20} />} color="#2ecc71" />
        <StatCard label="Active Sessions" value="247" icon={<Eye size={20} />} color="#003087" />
        <StatCard label="Avg QR Response" value="82ms" icon={<Clock size={20} />} color="#f5c200" />
        <StatCard label="Errors Today" value="3" icon={<AlertTriangle size={20} />} color="#e8543a" />
      </div>
      <Card title="System Status">
        <div className="p-4 space-y-4">
          {[["Database Server", "Online", "green", "23ms"], ["Web Application", "Online", "green", "82ms"], ["QR Scan Service", "Online", "green", "12ms"], ["Notification Service", "Online", "green", "—"], ["Backup Service", "Last run: 8:00 AM", "yellow", "—"]].map(([s, v, c, rt]) => (
            <div key={s as string} className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${c === "green" ? "bg-green-500" : "bg-yellow-500"}`} />
                <span className="text-sm text-foreground font-medium">{s}</span>
              </div>
              <div className="flex items-center gap-4">
                {rt !== "—" && <span className="text-xs text-muted-foreground font-mono">{rt}</span>}
                <span className="text-xs text-muted-foreground">{v}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SysAdminSecurityConfig() {
  return (
    <div className="space-y-5">
      <PageHeader title="Security Config" subtitle="Role-based access control and QRpass permission matrix." />
      <Card title="Role Permissions">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-muted/50">
              <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Role</th>
              {["Register Items", "View QR Codes", "Approve Requests", "Scan & Verify", "View Reports", "Manage Users"].map(p => (
                <th key={p} className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">{p}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                ["Student", [true, true, false, false, false, false]],
                ["Security (CSU)", [false, false, false, true, false, false]],
                ["PCO Staff", [false, true, true, false, true, false]],
                ["System Administrator", [true, true, true, true, true, true]],
              ].map(([role, perms]) => (
                <tr key={role as string} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 text-sm text-foreground font-medium">{role}</td>
                  {(perms as boolean[]).map((p, i) => (
                    <td key={i} className="py-2.5 px-3 text-center">
                      {p ? <CheckCircle size={14} className="text-green-500 mx-auto" /> : <X size={14} className="text-muted-foreground/40 mx-auto" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Page registry ─────────────────────────────────────────────────────────────
const PAGES: Record<Role, React.ComponentType[]> = {
  student: [StudentRegisterItem, StudentMyQRCodes, StudentPermitStatus, StudentLostAndFound, StudentNotifications],
  security: [SecurityScanVerify, SecurityEntryExitLog, SecurityLostFound, SecurityReports, SecurityNotifications],
  sao: [PCOPermitRequests, PCOItemRegistry, PCOReports, PCONotifications],
  sysadmin: [SysAdminUserAccounts, SysAdminSettings, SysAdminAuditLogs, SysAdminPerformance, SysAdminSecurityConfig],
};

const NAV: Record<Role, { icon: React.ReactNode; label: string; badge?: number }[]> = {
  student: [
    { icon: <Package size={16} />, label: "Register Item" },
    { icon: <QrCode size={16} />, label: "My QR Codes", badge: 2 },
    { icon: <Eye size={16} />, label: "Permit Status" },
    { icon: <BookOpen size={16} />, label: "Lost & Found" },
    { icon: <Bell size={16} />, label: "Notifications", badge: 3 },
  ],
  security: [
    { icon: <ScanLine size={16} />, label: "Scan & Verify" },
    { icon: <Map size={16} />, label: "Entry / Exit Log" },
    { icon: <BookOpen size={16} />, label: "Lost & Found" },
    { icon: <BarChart2 size={16} />, label: "Reports" },
    { icon: <Bell size={16} />, label: "Notifications", badge: 4 },
  ],
  sao: [
    { icon: <FileText size={16} />, label: "Registration Requests", badge: 8 },
    { icon: <Layers size={16} />, label: "Item Registry" },
    { icon: <BarChart2 size={16} />, label: "Reports" },
    { icon: <Bell size={16} />, label: "Notifications", badge: 2 },
  ],
  sysadmin: [
    { icon: <Users size={16} />, label: "User Accounts" },
    { icon: <Settings size={16} />, label: "System Settings" },
    { icon: <FileText size={16} />, label: "Audit Logs" },
    { icon: <BarChart2 size={16} />, label: "Performance" },
    { icon: <Shield size={16} />, label: "Security Config" },
  ],
};

// ── Login page ────────────────────────────────────────────────────────────────
// ── Registration field definitions per role ───────────────────────────────────
const REG_FIELDS: Record<Role, { label: string; type: string; placeholder: string; options?: string[] }[]> = {
  student: [
    { label: "Full Name", type: "text", placeholder: "e.g. Juan Dela Cruz" },
    { label: "Student ID No.", type: "text", placeholder: "e.g. 22-1234" },
    { label: "Email Address", type: "email", placeholder: "e.g. juan@uc.edu.ph" },
    { label: "Contact Number", type: "text", placeholder: "e.g. 09XX-XXX-XXXX" },
    { label: "Course / Program", type: "text", placeholder: "e.g. BS Information Technology" },
    { label: "Year Level", type: "select", placeholder: "", options: ["1st Year", "2nd Year", "3rd Year", "4th Year"] },
    { label: "Password", type: "password", placeholder: "Create a password" },
    { label: "Confirm Password", type: "password", placeholder: "Repeat password" },
  ],
  security: [
    { label: "Full Name", type: "text", placeholder: "e.g. Ramon Santos" },
    { label: "Employee ID", type: "text", placeholder: "e.g. EMP-0012" },
    { label: "Email Address", type: "email", placeholder: "e.g. rsantos@uc.edu.ph" },
    { label: "Contact Number", type: "text", placeholder: "e.g. 09XX-XXX-XXXX" },
    { label: "Position / Rank", type: "text", placeholder: "e.g. Security Guard II" },
    { label: "Password", type: "password", placeholder: "Create a password" },
    { label: "Confirm Password", type: "password", placeholder: "Repeat password" },
  ],
  sao: [
    { label: "Full Name", type: "text", placeholder: "e.g. Maria Cruz" },
    { label: "Employee ID", type: "text", placeholder: "e.g. EMP-0045" },
    { label: "Email Address", type: "email", placeholder: "e.g. mcruz@uc.edu.ph" },
    { label: "Contact Number", type: "text", placeholder: "e.g. 09XX-XXX-XXXX" },
    { label: "Password", type: "password", placeholder: "Create a password" },
    { label: "Confirm Password", type: "password", placeholder: "Repeat password" },
  ],
  sysadmin: [
    { label: "Full Name", type: "text", placeholder: "e.g. System Administrator" },
    { label: "Username", type: "text", placeholder: "e.g. sysadmin" },
    { label: "Email Address", type: "email", placeholder: "e.g. admin@uc.edu.ph" },
    { label: "Contact Number", type: "text", placeholder: "e.g. 09XX-XXX-XXXX" },
    { label: "Password", type: "password", placeholder: "Create a password" },
    { label: "Confirm Password", type: "password", placeholder: "Repeat password" },
  ],
};

// ── Role selector shared UI ───────────────────────────────────────────────────
function RoleSelector({ selected, onSelect, excludeRoles = [] }: { selected: Role | null; onSelect: (r: Role) => void; excludeRoles?: Role[] }) {
  const visible = ROLES.filter(r => !excludeRoles.includes(r.id));
  const isOdd = visible.length % 2 !== 0;

  const btnStyle = (r: typeof visible[0]) => ({
    backgroundColor: selected === r.id ? r.color : "white",
    color: selected === r.id ? r.textColor : "#0d1b3e",
    borderColor: selected === r.id ? r.color : "#d0d8e8",
    boxShadow: selected === r.id ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
  });

  // Separate the last item when count is odd so we can center it alone
  const pairs = isOdd ? visible.slice(0, -1) : visible;
  const lastItem = isOdd ? visible[visible.length - 1] : null;

  return (
    <div className="w-full max-w-xl mx-auto space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {pairs.map(r => (
          <button key={r.id} onClick={() => onSelect(r.id)}
            className="py-3 px-3 rounded-md font-semibold text-sm transition-all duration-150 border-2 text-center"
            style={btnStyle(r)}>
            {r.label}
          </button>
        ))}
      </div>
      {lastItem && (
        <div className="flex justify-center">
          <button onClick={() => onSelect(lastItem.id)}
            className="py-3 px-3 rounded-md font-semibold text-sm transition-all duration-150 border-2 text-center"
            style={{ ...btnStyle(lastItem), width: "calc(50% - 4px)" }}>
            {lastItem.label}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Login page ────────────────────────────────────────────────────────────────
type LoginMode = "login" | "register" | "forgot" | "verify" | "reset" | "reset-done";

function LoginPage({ onLogin }: { onLogin: (role: Role) => void }) {
  const [mode, setMode] = useState<LoginMode>("login");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // Registration state
  const [regRole, setRegRole] = useState<Role | null>(null);
  const [regFields, setRegFields] = useState<Record<string, string>>({});
  const [regSubmitted, setRegSubmitted] = useState(false);
  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [codeInputs, setCodeInputs] = useState(["", "", "", "", "", ""]);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [codeError, setCodeError] = useState(false);
  // Simulated sent code (in real app this comes from backend)
  const DEMO_CODE = "847261";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
  
    if (!selectedRole) {
      alert("Please select a role.");
      return;
    }
  
    try {
      const data = await login(username, password, selectedRole);
  
      localStorage.setItem("token", data.token);
  
      onLogin(selectedRole);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Login failed.");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
  
    if (!regRole) return;
  
    const name = regFields["Full Name"]?.trim();
    const email = regFields["Email Address"]?.trim();
  
    const username =
      regRole === "student"
        ? regFields["Student ID No."]?.trim()
        : regFields["Employee ID"]?.trim();
  
    const password = regFields["Password"] ?? "";
    const confirmPassword = regFields["Confirm Password"] ?? "";
  
    if (!name || !email || !username || !password) {
      alert("Please complete all required fields.");
      return;
    }
  
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
  
    try {
      await register(
        name,
        email,
        username,
        password,
        regRole
      );
  
      setRegSubmitted(true);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Registration failed."
      );
    }
  }

  function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (forgotEmail) setMode("verify");
  }

  function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    const entered = codeInputs.join("");
    if (entered === DEMO_CODE) {
      setCodeError(false);
      setMode("reset");
    } else {
      setCodeError(true);
    }
  }

  function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPass && newPass === confirmPass) setMode("reset-done");
  }

  function switchMode(m: LoginMode) {
    setMode(m);
    setRegSubmitted(false);
    setRegRole(null);
    setRegFields({});
    setForgotEmail("");
    setCodeInputs(["", "", "", "", "", ""]);
    setVerifyCode("");
    setNewPass("");
    setConfirmPass("");
    setCodeError(false);
  }

  const fields = regRole ? REG_FIELDS[regRole] : [];

  // Shared top-bar
  const TopBar = (
    <div className="bg-primary h-1.5 w-full" />
  );
  const NavBar = (
    <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-border shadow-sm">
      <div className="flex items-center gap-2.5">
        <QRpassLogo size={36} />
        <div>
          <p className="text-xs font-semibold text-primary" style={{ fontFamily: "Barlow, sans-serif" }}>QRpass</p>
          <p className="text-xs text-muted-foreground">University of Cebu – Main Campus</p>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">V1.0 &nbsp;|&nbsp; <span className="text-primary font-medium cursor-pointer hover:underline">Help</span></div>
    </div>
  );

  // ── Register view ─────────────────────────────────────────────────────────
  if (mode === "register") {
    return (
      <div className="min-h-screen flex flex-col" style={{ fontFamily: "Inter, sans-serif", background: "#f4f6fa" }}>
        {TopBar}{NavBar}
        <div className="flex-1 flex flex-col items-center px-4 py-8">
          {/* Logo small */}
          <div className="flex flex-col items-center mb-6">
            <QRpassLogo size={72} showText />
          </div>

          <div className="w-full max-w-2xl bg-white rounded-xl border border-border shadow-md overflow-hidden">
            {/* Header */}
            <div className="bg-primary px-6 py-4">
              <h2 className="text-white font-bold text-base" style={{ fontFamily: "Barlow, sans-serif" }}>Create an Account</h2>
              <p className="text-white/70 text-xs mt-0.5">Fill in your details to register for QRpass access.</p>
            </div>

            {!regSubmitted ? (
              <div className="p-6">
                {/* Step 1: Role */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Step 1 — Select your role</p>
                  <RoleSelector selected={regRole} onSelect={r => { setRegRole(r); setRegFields({}); }} excludeRoles={["sysadmin"]} />
                </div>

                {/* Step 2: Fields */}
                {regRole && (
                  <form onSubmit={handleRegister}>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">
                      Step 2 — {ROLES.find(r => r.id === regRole)?.label} Information
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      {fields.map((f) => (
                        <div key={f.label} className={f.type === "password" ? "" : ""}>
                          <label className="block text-xs font-semibold text-foreground mb-1">{f.label}</label>
                          {f.type === "select" ? (
                            <select
                              value={regFields[f.label] ?? ""}
                              onChange={e => setRegFields(prev => ({ ...prev, [f.label]: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                              <option value="">Select…</option>
                              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              type={f.type}
                              placeholder={f.placeholder}
                              value={regFields[f.label] ?? ""}
                              onChange={e => setRegFields(prev => ({ ...prev, [f.label]: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800">
                      <strong>Note:</strong> Your account will be reviewed and activated by the System Administrator before you can log in.
                    </div>
                    <div className="flex gap-3 mt-5 justify-end">
                      <button type="button" onClick={() => switchMode("login")}
                        className="text-xs px-4 py-2 border border-border rounded-md text-muted-foreground hover:bg-muted transition-colors">
                        Back to Login
                      </button>
                      <button type="submit"
                        className="text-xs bg-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90 transition-opacity">
                        Submit Registration
                      </button>
                    </div>
                  </form>
                )}

                {!regRole && (
                  <div className="text-center text-xs text-muted-foreground py-4">
                    Select a role above to continue with registration.
                  </div>
                )}
              </div>
            ) : (
              /* Success state */
              <div className="p-10 flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-foreground text-base" style={{ fontFamily: "Barlow, sans-serif" }}>Registration Submitted!</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Your account request has been submitted. The System Administrator will review and activate your account. You will be notified via email.
                  </p>
                </div>
                <button onClick={() => switchMode("login")}
                  className="text-xs bg-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90">
                  Back to Login
                </button>
              </div>
            )}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">&copy; Copyright 2026 – University of Cebu Main Campus</p>
        </div>
        <div className="flex h-2">
          <div className="flex-1" style={{ backgroundColor: "#003087" }} />
          <div className="flex-1" style={{ backgroundColor: "#f5c200" }} />
          <div className="flex-1" style={{ backgroundColor: "#00aeef" }} />
          <div className="flex-1" style={{ backgroundColor: "#f4f6fa" }} />
        </div>
      </div>
    );
  }

  // ── Shared page shell ─────────────────────────────────────────────────────
  const PageShell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "Inter, sans-serif", background: "#f4f6fa" }}>
      {TopBar}{NavBar}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {children}
        <p className="mt-8 text-xs text-muted-foreground">&copy; Copyright 2026 – University of Cebu Main Campus</p>
      </div>
      <div className="flex h-2">
        <div className="flex-1" style={{ backgroundColor: "#003087" }} />
        <div className="flex-1" style={{ backgroundColor: "#f5c200" }} />
        <div className="flex-1" style={{ backgroundColor: "#00aeef" }} />
        <div className="flex-1" style={{ backgroundColor: "#f4f6fa" }} />
      </div>
    </div>
  );

  // ── Forgot — enter email ──────────────────────────────────────────────────
  if (mode === "forgot") return (
    <PageShell>
      <div className="flex flex-col items-center mb-6"><QRpassLogo size={72} showText /></div>
      <div className="w-full max-w-sm bg-white rounded-xl border border-border shadow-md overflow-hidden">
        <div className="bg-primary px-6 py-4">
          <h2 className="text-white font-bold text-base" style={{ fontFamily: "Barlow, sans-serif" }}>Forgot Password</h2>
          <p className="text-white/70 text-xs mt-0.5">Enter your registered Gmail address to receive a verification code.</p>
        </div>
        <form onSubmit={handleForgotSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Gmail Address</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                placeholder="e.g. juan@gmail.com" required
                className="w-full pl-9 pr-3 py-2.5 rounded-md border border-border text-sm bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800">
            A 6-digit verification code will be sent to your Gmail address. Check your inbox and spam folder.
          </div>
          <button type="submit"
            className="w-full py-2.5 rounded-md font-semibold text-sm"
            style={{ backgroundColor: "#003087", color: "#fff" }}>
            Send Verification Code
          </button>
          <button type="button" onClick={() => switchMode("login")}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Login
          </button>
        </form>
      </div>
    </PageShell>
  );

  // ── Verify — enter 6-digit code ───────────────────────────────────────────
  if (mode === "verify") return (
    <PageShell>
      <div className="flex flex-col items-center mb-6"><QRpassLogo size={72} showText /></div>
      <div className="w-full max-w-sm bg-white rounded-xl border border-border shadow-md overflow-hidden">
        <div className="bg-primary px-6 py-4">
          <h2 className="text-white font-bold text-base" style={{ fontFamily: "Barlow, sans-serif" }}>Enter Verification Code</h2>
          <p className="text-white/70 text-xs mt-0.5">A 6-digit code was sent to <strong>{forgotEmail}</strong></p>
        </div>
        <form onSubmit={handleVerifySubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-3 uppercase tracking-wide text-center">6-Digit Code</label>
            <div className="flex gap-2 justify-center">
              {codeInputs.map((val, i) => (
                <input
                  key={i}
                  id={`code-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={val}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/, "");
                    const next = [...codeInputs];
                    next[i] = v;
                    setCodeInputs(next);
                    if (v && i < 5) (document.getElementById(`code-${i + 1}`) as HTMLInputElement)?.focus();
                  }}
                  onKeyDown={e => {
                    if (e.key === "Backspace" && !codeInputs[i] && i > 0)
                      (document.getElementById(`code-${i - 1}`) as HTMLInputElement)?.focus();
                  }}
                  className={`w-10 h-12 text-center text-lg font-bold rounded-md border-2 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${codeError ? "border-red-400 bg-red-50" : "border-border bg-muted/50 focus:border-primary"}`}
                />
              ))}
            </div>
            {codeError && <p className="text-center text-xs text-red-500 mt-2">Incorrect code. Please try again. (Demo: {DEMO_CODE})</p>}
          </div>
          <button type="submit"
            className="w-full py-2.5 rounded-md font-semibold text-sm"
            style={{ backgroundColor: "#003087", color: "#fff" }}>
            Verify Code
          </button>
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              Didn{"'"}t receive a code?{" "}
              <button type="button" onClick={() => setCodeInputs(["", "", "", "", "", ""])}
                className="text-primary font-medium hover:underline">Resend</button>
            </p>
            <button type="button" onClick={() => switchMode("forgot")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Change email</button>
          </div>
        </form>
      </div>
    </PageShell>
  );

  // ── Reset — set new password ───────────────────────────────────────────────
  if (mode === "reset") return (
    <PageShell>
      <div className="flex flex-col items-center mb-6"><QRpassLogo size={72} showText /></div>
      <div className="w-full max-w-sm bg-white rounded-xl border border-border shadow-md overflow-hidden">
        <div className="bg-primary px-6 py-4">
          <h2 className="text-white font-bold text-base" style={{ fontFamily: "Barlow, sans-serif" }}>Set New Password</h2>
          <p className="text-white/70 text-xs mt-0.5">Choose a strong new password for your account.</p>
        </div>
        <form onSubmit={handleResetSubmit} className="p-6 space-y-4">
        {([["New Password", newPass, setNewPass], ["Confirm New Password", confirmPass, setConfirmPass]] as const).map(([label, val, setter]) => (            <div key={label as string}>
              <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">{label}</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)}
                  placeholder="Enter password" required
                  className="w-full pl-9 pr-3 py-2.5 rounded-md border border-border text-sm bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
              </div>
            </div>
          ))}
          {confirmPass && newPass !== confirmPass && (
            <p className="text-xs text-red-500">Passwords do not match.</p>
          )}
          <button type="submit" disabled={!newPass || newPass !== confirmPass}
            className="w-full py-2.5 rounded-md font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#003087", color: "#fff" }}>
            Change Password
          </button>
        </form>
      </div>
    </PageShell>
  );

  // ── Reset done ────────────────────────────────────────────────────────────
  if (mode === "reset-done") return (
    <PageShell>
      <div className="w-full max-w-sm bg-white rounded-xl border border-border shadow-md p-10 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-foreground text-base" style={{ fontFamily: "Barlow, sans-serif" }}>Password Changed!</h3>
          <p className="text-xs text-muted-foreground mt-1">Your password has been updated successfully. You can now log in with your new password.</p>
        </div>
        <button onClick={() => switchMode("login")}
          className="text-xs bg-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90">
          Back to Login
        </button>
      </div>
    </PageShell>
  );

  // ── Login view ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "Inter, sans-serif", background: "#f4f6fa" }}>
      {TopBar}{NavBar}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* Full logo with text */}
        <div className="flex flex-col items-center mb-8">
          <QRpassLogo size={120} showText />
          <p className="text-sm text-muted-foreground mt-3 text-center max-w-sm">
            Enhancing Campus Security Through QR-Based Item Registration & Verification
          </p>
        </div>

        <div className="w-full max-w-xl mb-5">
          <p className="text-center text-sm font-semibold text-foreground mb-3">Select your role to continue:</p>
          <RoleSelector selected={selectedRole} onSelect={setSelectedRole} />
        </div>

        <div className="w-full max-w-sm bg-white rounded-xl border border-border shadow-md p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">USERNAME</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username"
                  className="w-full pl-9 pr-3 py-2.5 rounded-md border border-border text-sm bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
                  className="w-full pl-9 pr-3 py-2.5 rounded-md border border-border text-sm bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
              </div>
            </div>
            <div className="text-right">
              <button type="button" onClick={() => switchMode("forgot")}
                className="text-xs text-primary font-medium hover:underline">
                Forgot Password?
              </button>
            </div>
            <button type="submit" disabled={!selectedRole}
              className="w-full py-2.5 rounded-md font-semibold text-sm transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#003087", color: "#fff" }}>
              {selectedRole ? `Log in as ${ROLES.find(r => r.id === selectedRole)?.label}` : "Select a role above"}
            </button>
          </form>
          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              Don{"'"}t have an account?{" "}
              <button onClick={() => switchMode("register")} className="text-primary font-semibold hover:underline">Register here</button>
            </p>
          </div>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">&copy; Copyright 2026 – University of Cebu Main Campus</p>
      </div>

      <div className="flex h-2">
        <div className="flex-1" style={{ backgroundColor: "#003087" }} />
        <div className="flex-1" style={{ backgroundColor: "#f5c200" }} />
        <div className="flex-1" style={{ backgroundColor: "#00aeef" }} />
        <div className="flex-1" style={{ backgroundColor: "#f4f6fa" }} />
      </div>
    </div>
  );
}

// ── Dashboard layout ──────────────────────────────────────────────────────────
function Dashboard({ role, onLogout }: { role: Role; onLogout: () => void }) {
  const navItems = NAV[role];
  const pages = PAGES[role];
  const [activeNav, setActiveNav] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const roleInfo = ROLES.find((r) => r.id === role)!;
  const totalBadge = navItems.reduce((sum, n) => sum + (n.badge ?? 0), 0);
  const ActivePage = pages[activeNav];

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  function handleNavClick(i: number) {
    setActiveNav(i);
    if (isMobile) setSidebarOpen(false);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "Inter, sans-serif", background: "#f4f6fa" }}>
      {/* Header */}
      <header className="bg-primary text-white h-12 flex items-center px-3 gap-2 z-50 shadow-md flex-shrink-0 sticky top-0">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white/80 hover:text-white transition-colors p-1">
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div className="flex items-center gap-1.5">
          <QRpassLogo size={28} />
          <span className="font-bold text-sm tracking-wide" style={{ fontFamily: "Barlow, sans-serif" }}>QRpass</span>
          <span className="hidden md:inline text-white/50 text-xs">V1.0</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button className="relative text-white/80 hover:text-white transition-colors p-1">
            <Bell size={17} />
            {totalBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-secondary text-secondary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">{totalBadge}</span>
            )}
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <User size={13} className="text-secondary-foreground" />
            </div>
            <span className="hidden sm:inline text-white/90 text-xs font-medium max-w-[100px] truncate">{roleInfo.label}</span>
          </div>
          <button onClick={onLogout} className="text-white/70 hover:text-white transition-colors p-1" title="Log out">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        {/* Mobile backdrop */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 top-12 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar — fixed overlay on mobile, in-flow on desktop */}
        <aside
          className="flex-col flex-shrink-0 transition-all duration-200 overflow-hidden z-40"
          style={{
            position: isMobile ? "fixed" : "relative",
            top: isMobile ? "48px" : "auto",
            bottom: isMobile ? "0" : "auto",
            left: 0,
            width: sidebarOpen ? "210px" : "0px",
            backgroundColor: "#003087",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
          }}
        >
          <div className="p-3 border-b border-white/10 flex-shrink-0">
            <p className="text-xs text-white/50 font-medium uppercase tracking-wider whitespace-nowrap">Navigation</p>
          </div>
          <nav className="flex-1 py-2 overflow-y-auto">
            {navItems.map((item, i) => (
              <button key={i} onClick={() => handleNavClick(i)}
                className="w-full flex items-center gap-2.5 px-3 py-3 text-sm font-medium transition-all duration-150 text-left whitespace-nowrap"
                style={{
                  color: activeNav === i ? "#f5c200" : "rgba(255,255,255,0.75)",
                  backgroundColor: activeNav === i ? "rgba(245,194,0,0.1)" : "transparent",
                  borderLeft: activeNav === i ? "3px solid #f5c200" : "3px solid transparent",
                }}>
                <span style={{ opacity: activeNav === i ? 1 : 0.7 }}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-secondary text-secondary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">{item.badge}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-white/10 flex-shrink-0">
            <button onClick={onLogout} className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors whitespace-nowrap">
              <LogOut size={13} /><span>Log Out</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-3 md:p-5 min-w-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3 flex-wrap">
            <QrCode size={11} className="text-primary flex-shrink-0" />
            <span className="text-primary font-medium">QRpass</span>
            <ChevronRight size={11} />
            <span className="hidden sm:inline">{roleInfo.label}</span>
            <ChevronRight size={11} className="hidden sm:inline" />
            <span className="text-foreground font-medium truncate">{navItems[activeNav]?.label}</span>
          </div>

          {/* Announcement */}
          <div className="mb-4 bg-secondary/20 border border-secondary/40 rounded-lg px-3 py-2 flex items-start gap-2">
            <Bell size={14} style={{ color: "#c49e00" }} className="flex-shrink-0 mt-0.5" />
            <p className="text-xs text-foreground">
              <span className="font-semibold">Announcement:</span> Campus-wide QR item check on{" "}
              <strong>June 18, 2026</strong>. Ensure all items are QR-registered.
            </p>
          </div>

          <ActivePage />
        </main>
      </div>

      <footer className="bg-white border-t border-border px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">&copy; 2026 University of Cebu — QRpass</p>
        <p className="text-xs text-muted-foreground hidden sm:block">Main Campus &nbsp;|&nbsp; V1.0</p>
      </footer>
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<View>("login");
  const [role, setRole] = useState<Role>("student");

  function handleLogin(r: Role) {
    setRole(r);
    setView("dashboard");
  }

  if (view === "dashboard") return <Dashboard role={role} onLogout={() => setView("login")} />;
  return <LoginPage onLogin={handleLogin} />;
}
