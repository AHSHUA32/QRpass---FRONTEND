import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { login, register, createItem, getItems, getPendingItems, approveItem, verifyItem, 
         createScanLog, getScanLogs, getAllItems, getSecurityIncidents, createSecurityIncident, 
         resolveSecurityIncident,getLostFoundItems, createLostFoundItem, claimLostFoundItem,markLostFoundRecovered,  
         getNotifications, markNotificationRead, markAllNotificationsRead, getDashboard,
         getSystemRecords, getReports, getUsers, updateUserStatus, createUser,updateUser, logout,  } from "../services/api";
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

type Role = "student" | "security" | "pco" | "sysadmin";

type View = "login" | "dashboard";

const ROLES: { id: Role; label: string; color: string; textColor: string }[] = [
  { id: "student", label: "Student", color: "#003087", textColor: "#fff" },
  { id: "security", label: "Security Personnel (CSU)", color: "#f5c200", textColor: "#0d1b3e" },
  { id: "pco", label: "PCO Staff", color: "#00aeef", textColor: "#fff" },
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
    
    quantity: "1",
    complete_description: "",
    
    computer_type: "",
    processor: "",
    motherboard: "",
    memory: "",
    hard_drive: "",
    monitor: "",
    casing: "",
    cd_dvd_rom: "",
    operating_system: "",

    accessories_included: "",
    valid_until: "",
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

        quantity: "1",
        complete_description: "",

        computer_type: "",
        processor: "",
        motherboard: "",
        memory: "",
        hard_drive: "",
        monitor: "",
        casing: "",
        cd_dvd_rom: "",
        operating_system: "",

        accessories_included: "",
        valid_until: "",
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
            <Plus size={13} />
            New Registration
          </button>
        }
      />

      {showForm && (
        <Card title="Item Registration Form">
          <form
            onSubmit={handleItemSubmit}
            className="p-4 grid md:grid-cols-2 gap-4"
          >
            {/* ITEM NAME */}
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

            {/* BRAND / MODEL */}
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

            {/* SERIAL NUMBER */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Serial Number (Optional)
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
                placeholder="e.g. SN-00000 — leave blank if none"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* COLOR */}
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

            {/* ITEM TYPE */}
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
                <option value="Laptop">Laptop / Computer</option>
                <option value="Mobile Phone">Mobile Phone</option>
                <option value="Tablet">Tablet</option>
                <option value="Camera">Camera</option>
                <option value="Audio Equipment">
                  Audio Equipment
                </option>
                <option value="Musical Instrument">
                  Musical Instrument
                </option>
                <option value="Sports Equipment">
                  Sports Equipment
                </option>
                <option value="Tumbler">Tumbler</option>
                <option value="Other Equipment">
                  Other Equipment
                </option>
              </select>
            </div>

            {/* PURPOSE */}
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

            {/* ACCESSORIES */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Accessories Included
              </label>

              <input
                type="text"
                value={form.accessories_included}
                onChange={(e) =>
                  setForm({
                    ...form,
                    accessories_included: e.target.value,
                  })
                }
                placeholder="e.g. Charger, mouse, laptop bag"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* VALID UNTIL */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Valid Until
              </label>

              <input
                type="date"
                value={form.valid_until}
                onChange={(e) =>
                  setForm({
                    ...form,
                    valid_until: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* COMPUTER SPECIFICATIONS */}
            {form.item_type === "Laptop" && (
              <div className="md:col-span-2 border border-blue-200 rounded-lg overflow-hidden bg-blue-50/30">
                <div className="bg-primary px-4 py-3">
                  <h3 className="text-sm font-semibold text-white">
                    Computer / Laptop Specifications
                  </h3>

                  <p className="text-xs text-white/70 mt-0.5">
                    Complete the applicable specifications based on the
                    UC Computer Equipment Gate Pass.
                  </p>
                </div>

                <div className="p-4 grid md:grid-cols-2 gap-4">
                  {/* COMPUTER TYPE */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Computer / Laptop Type
                    </label>

                    <input
                      type="text"
                      value={form.computer_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          computer_type: e.target.value,
                        })
                      }
                      placeholder="e.g. Laptop, Desktop, Gaming Laptop"
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* PROCESSOR */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Processor
                    </label>

                    <input
                      type="text"
                      value={form.processor}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          processor: e.target.value,
                        })
                      }
                      placeholder="e.g. Intel Core i5 / Ryzen 5"
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* MOTHERBOARD */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Motherboard
                    </label>

                    <input
                      type="text"
                      value={form.motherboard}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          motherboard: e.target.value,
                        })
                      }
                      placeholder="e.g. ASUS B550M / Built-in"
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* MEMORY */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Memory / RAM
                    </label>

                    <input
                      type="text"
                      value={form.memory}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          memory: e.target.value,
                        })
                      }
                      placeholder="e.g. 16 GB DDR4"
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* STORAGE */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Hard Drive / Storage
                    </label>

                    <input
                      type="text"
                      value={form.hard_drive}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          hard_drive: e.target.value,
                        })
                      }
                      placeholder="e.g. 512 GB SSD"
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* MONITOR */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Monitor
                    </label>

                    <input
                      type="text"
                      value={form.monitor}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          monitor: e.target.value,
                        })
                      }
                      placeholder="e.g. Built-in 15.6 inch"
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* CASING */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Casing
                    </label>

                    <input
                      type="text"
                      value={form.casing}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          casing: e.target.value,
                        })
                      }
                      placeholder="e.g. Black chassis / Built-in"
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* CD/DVD */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      CD / DVD ROM
                    </label>

                    <input
                      type="text"
                      value={form.cd_dvd_rom}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          cd_dvd_rom: e.target.value,
                        })
                      }
                      placeholder="e.g. None / DVD-RW"
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* OPERATING SYSTEM */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Operating System
                    </label>

                    <input
                      type="text"
                      value={form.operating_system}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          operating_system: e.target.value,
                        })
                      }
                      placeholder="e.g. Windows 11 Pro"
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* NOTE */}
            <div className="md:col-span-2 bg-yellow-50 border border-yellow-200 rounded-md p-3 text-xs text-yellow-800">
              <strong>Note:</strong> After submission, your item will be
              reviewed by PCO. A QR code will be issued after approval.
            </div>

            {/* BUTTONS */}
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

      {/* MY REGISTERED ITEMS */}
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
                        {item.serial_number || "—"}
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
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [claimingId, setClaimingId] =
    useState<number | null>(null);

  /*
  |--------------------------------------------------------------------------
  | LOAD LOST & FOUND REGISTRY
  |--------------------------------------------------------------------------
  */

  async function loadItems() {
    try {
      setLoading(true);
      setError("");

      const data =
        await getLostFoundItems();

      setItems(
        Array.isArray(data)
          ? data
          : data?.items ?? []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Lost & Found registry."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | CLAIM ITEM
  |--------------------------------------------------------------------------
  */

  async function handleClaim(
    id: number
  ) {
    const confirmed =
      window.confirm(
        "Submit a claim for this item? You will still need to visit the CSU office for ownership verification."
      );

    if (!confirmed) {
      return;
    }

    try {
      setClaimingId(id);
      setError("");
      setSuccess("");

      const result =
        await claimLostFoundItem(id);

      setSuccess(
        result?.message ||
          "Claim submitted successfully."
      );

      await loadItems();

      setTimeout(() => {
        setSuccess("");
      }, 4000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit claim."
      );
    } finally {
      setClaimingId(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SEARCH
  |--------------------------------------------------------------------------
  */

  const filteredItems =
    items.filter((item) => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return true;
      }

      const searchableText = [
        item.id,
        item.item_name,
        item.category,
        item.brand_model,
        item.color,
        item.location_found,
        item.description,
        item.status,
        item.finder?.name,
        item.finder?.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        query
      );
    });

  /*
  |--------------------------------------------------------------------------
  | FORMAT DATE
  |--------------------------------------------------------------------------
  */

  function formatDate(
    value?: string | null
  ) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleDateString(
      "en-PH",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PAGE
  |--------------------------------------------------------------------------
  */

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lost & Found"
        subtitle="Browse items turned over to the Civil Security Unit and submit a claim if an item belongs to you."
      />

      {/* Information */}

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <Shield
            size={16}
            className="mt-0.5 flex-shrink-0 text-blue-700"
          />

          <div>
            <p className="text-sm font-medium text-blue-900">
              CSU Lost & Found Procedure
            </p>

            <p className="mt-1 text-xs text-blue-800">
              Found items must be
              physically turned over to
              the CSU office. CSU
              personnel will record the
              item in QRPass and credit
              the person who turned it
              over. Students can browse
              records and submit claims,
              but cannot create Lost &
              Found reports.
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Statistics */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Reports"
          value={String(
            items.length
          )}
          icon={
            <BookOpen size={20} />
          }
          color="#003087"
        />

        <StatCard
          label="Available Items"
          value={String(
            items.filter(
              (item) =>
                String(
                  item.status ?? ""
                ).toLowerCase() ===
                "found"
            ).length
          )}
          icon={
            <Package size={20} />
          }
          color="#f5c200"
        />

        <StatCard
          label="Recovered"
          value={String(
            items.filter(
              (item) =>
                String(
                  item.status ?? ""
                ).toLowerCase() ===
                "recovered"
            ).length
          )}
          icon={
            <CheckCircle
              size={20}
            />
          }
          color="#2ecc71"
        />
      </div>

      {/* Search */}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search item, category, location, finder..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          type="button"
          onClick={loadItems}
          disabled={loading}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {/* Loading */}

      {loading && (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Loading Lost & Found
            registry...
          </p>
        </div>
      )}

      {/* Empty */}

      {!loading &&
        filteredItems.length ===
          0 && (
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <BookOpen
              size={32}
              className="mx-auto mb-3 text-muted-foreground"
            />

            <p className="text-sm font-medium text-foreground">
              No Lost & Found
              records found.
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Items turned over to
              CSU will appear here.
            </p>
          </div>
        )}

      {/* Registry */}

      {!loading &&
        filteredItems.map(
          (item) => {
            const status =
              String(
                item.status ??
                  "Found"
              );

            const statusLower =
              status.toLowerCase();

            const isFound =
              statusLower ===
              "found";

            const isClaimed =
              statusLower ===
              "claimed";

            const isRecovered =
              statusLower ===
              "recovered";

            return (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-card shadow-sm"
              >
                <div className="p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                    <div className="min-w-0 flex-1">

                      {/* Header */}

                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">
                          {item.item_name}
                        </h3>

                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            isRecovered
                              ? "bg-green-100 text-green-700"
                              : isClaimed
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {status}
                        </span>

                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Report #
                          {item.id}
                        </span>
                      </div>

                      {/* Details */}

                      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Category
                          </p>

                          <p className="font-medium text-foreground">
                            {item.category ||
                              "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Brand /
                            Model
                          </p>

                          <p className="font-medium text-foreground">
                            {item.brand_model ||
                              "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Color
                          </p>

                          <p className="font-medium text-foreground">
                            {item.color ||
                              "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Date Found
                          </p>

                          <p className="font-medium text-foreground">
                            {formatDate(
                              item.date_found
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Location
                            Found
                          </p>

                          <p className="font-medium text-foreground">
                            {item.location_found ||
                              "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">
                            Turned Over
                            By
                          </p>

                          <p className="font-medium text-foreground">
                            {item.finder
                              ?.name ||
                              "Not specified"}
                          </p>

                          {item.finder
                            ?.username && (
                            <p className="text-xs text-muted-foreground">
                              {
                                item
                                  .finder
                                  .username
                              }
                            </p>
                          )}
                        </div>

                      </div>

                      {/* Description */}

                      {item.description && (
                        <div className="mt-4 rounded-lg bg-muted/40 p-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            Item
                            Description
                          </p>

                          <p className="mt-1 text-sm text-foreground">
                            {
                              item.description
                            }
                          </p>
                        </div>
                      )}

                      {/* CSU */}

                      {item.processor && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          Processed by
                          CSU:{" "}
                          <span className="font-medium text-foreground">
                            {
                              item
                                .processor
                                .name
                            }
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Claim Action */}

                    <div className="flex-shrink-0">

                      {isFound && (
                        <button
                          type="button"
                          disabled={
                            claimingId ===
                            Number(
                              item.id
                            )
                          }
                          onClick={() =>
                            handleClaim(
                              Number(
                                item.id
                              )
                            )
                          }
                          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
                        >
                          {claimingId ===
                          Number(
                            item.id
                          )
                            ? "Submitting..."
                            : "Claim Item"}
                        </button>
                      )}

                      {isClaimed && (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                          Claim pending
                          CSU verification
                        </div>
                      )}

                      {isRecovered && (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                          Returned to
                          owner
                        </div>
                      )}

                    </div>

                  </div>
                </div>
              </div>
            );
          }
        )}
    </div>
  );
}

function StudentNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const data = await getNotifications();

      setNotifications(data.notifications ?? []);
    } catch (err) {
      console.error("Failed to load notifications:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkRead(id: number) {
    try {
      setMarkingId(id);
      setError("");

      await markNotificationRead(id);

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === id
            ? {
                ...notification,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : notification
        )
      );
    } catch (err) {
      console.error(
        "Failed to mark notification as read:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark notification as read."
      );
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAllRead() {
    const unreadExists = notifications.some(
      (notification) => !notification.is_read
    );

    if (!unreadExists) return;

    try {
      setMarkingAll(true);
      setError("");

      await markAllNotificationsRead();

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true,
          read_at:
            notification.read_at ??
            new Date().toISOString(),
        }))
      );
    } catch (err) {
      console.error(
        "Failed to mark all notifications as read:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark all notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  function formatDate(dateString: string) {
    if (!dateString) return "—";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString();
  }

  function formatTime(dateString: string) {
    if (!dateString) return "";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  const readCount =
    notifications.length - unreadCount;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Notifications
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            View updates about your registered items and
            QRPass activity.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            onClick={handleMarkAllRead}
            disabled={
              markingAll ||
              unreadCount === 0
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {markingAll
              ? "Updating..."
              : "Mark All as Read"}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">
            Total Notifications
          </p>

          <p className="text-3xl font-bold text-gray-900 mt-2">
            {notifications.length}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">
            Unread
          </p>

          <p className="text-3xl font-bold text-blue-600 mt-2">
            {unreadCount}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">
            Read
          </p>

          <p className="text-3xl font-bold text-green-600 mt-2">
            {readCount}
          </p>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Recent Notifications
          </h2>
        </div>

        {loading ? (
          <div className="py-14 text-center text-gray-500">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-14 text-center">
            <p className="font-semibold text-gray-700">
              No notifications yet.
            </p>

            <p className="text-sm text-gray-500 mt-1">
              Item approval and other QRPass updates will
              appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const unread = !notification.is_read;

              return (
                <div
                  key={notification.id}
                  className={`p-5 ${
                    unread
                      ? "bg-blue-50/60"
                      : "bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">
                          {notification.title}
                        </h3>

                        {unread && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase">
                            New
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mt-2">
                        {notification.message}
                      </p>

                      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                        <span>
                          {formatDate(
                            notification.created_at
                          )}
                        </span>

                        <span>
                          {formatTime(
                            notification.created_at
                          )}
                        </span>

                        <span className="capitalize">
                          {String(
                            notification.type ??
                              "system"
                          ).replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    {unread ? (
                      <button
                        onClick={() =>
                          handleMarkRead(
                            notification.id
                          )
                        }
                        disabled={
                          markingId === notification.id
                        }
                        className="px-3 py-2 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap"
                      >
                        {markingId ===
                        notification.id
                          ? "Updating..."
                          : "Mark as Read"}
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold whitespace-nowrap">
                        Read
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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

  const [incidentMessage, setIncidentMessage] = useState("");

  // Keeps the latest selected gate available to the camera scanner
  const gateRef = React.useRef(gate);

  useEffect(() => {
    gateRef.current = gate;
  }, [gate]);

  async function loadRecentLogs() {
    try {
      setLoadingLogs(true);

      const data = await getScanLogs();

      setRecentLogs((data.logs ?? []).slice(0, 5));
    } catch (error) {
      console.error(
        "Failed to load recent scan logs:",
        error
      );
    } finally {
      setLoadingLogs(false);
    }
  }

  async function recordSecurityIncident(
    code: string,
    errorMessage: string
  ) {
    try {
      let incidentType = "";

      if (
        errorMessage
          .toLowerCase()
          .includes("not found")
      ) {
        incidentType = "Unregistered Item";
      } else if (
        errorMessage
          .toLowerCase()
          .includes("not approved")
      ) {
        incidentType = "Unapproved Item";
      } else {
        // Do not create incidents for network/server errors
        return;
      }

      await createSecurityIncident({
        registered_item_id: null,
        scanned_code: code,
        incident_type: incidentType,
        item_name:
          incidentType === "Unregistered Item"
            ? "Unknown Item"
            : "Unapproved Item",
        serial_number: null,
        gate: gateRef.current,
        description:
          incidentType === "Unregistered Item"
            ? `Unregistered QR ID or serial number "${code}" was presented at ${gateRef.current}.`
            : `An item that has not yet been approved was presented at ${gateRef.current}. Code: ${code}.`,
      });

      setIncidentMessage(
        `${incidentType} has been flagged and recorded at ${gateRef.current}.`
      );
    } catch (incidentError) {
      console.error(
        "Failed to record security incident:",
        incidentError
      );

      setIncidentMessage(
        "The item could not be verified, but the security incident could not be saved."
      );
    }
  }

  async function verifyCode(code: string) {
    const cleanCode = code.trim();

    if (!cleanCode) {
      setVerifyError(
        "Please enter a QR ID or serial number."
      );
      setScanResult(null);
      setIncidentMessage("");
      return;
    }

    try {
      setVerifying(true);
      setVerifyError("");
      setIncidentMessage("");
      setScanResult(null);

      const data = await verifyItem(cleanCode);

      setInput(cleanCode);
      setScanResult(data.item);

      // Successful verification removes previous incident warning
      setIncidentMessage("");
    } catch (error) {
      setScanResult(null);
      setInput(cleanCode);

      const message =
        error instanceof Error
          ? error.message
          : "Item verification failed.";

      setVerifyError(message);

      // Automatically record unregistered/unapproved items
      await recordSecurityIncident(
        cleanCode,
        message
      );
    } finally {
      setVerifying(false);
    }
  }

  async function doScan() {
    await verifyCode(input);
  }

  async function handleLog(
    direction: "IN" | "OUT"
  ) {
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

      alert(
        `Item logged ${direction} successfully!`
      );
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

  // Load recent successful scans
  useEffect(() => {
    loadRecentLogs();
  }, []);

  // Camera QR scanner
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
        // Normal while camera is searching for a QR code
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
        subtitle="Scan an item's QR code or manually enter the QR ID or serial number."
      />

      {/* SCANNER */}
      <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          {/* GATE SELECTION */}
          <div className="w-full max-w-md">
            <label className="block text-xs font-semibold text-foreground mb-1">
              Current Gate
            </label>

            <select
              value={gate}
              onChange={(e) =>
                setGate(e.target.value)
              }
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
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
          </div>

          {/* CAMERA */}
          <div className="w-full max-w-md">
            <div
              id="qr-reader"
              className="w-full"
            />
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
                onChange={(e) =>
                  setInput(e.target.value)
                }
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
              {verifying
                ? "Verifying..."
                : "Verify"}
            </button>
          </div>

          {/* VERIFICATION ERROR */}
          {verifyError && (
            <div className="w-full max-w-md bg-red-50 border border-red-200 text-red-700 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={17}
                  className="mt-0.5 flex-shrink-0"
                />

                <div>
                  <p className="text-xs font-semibold">
                    Verification Failed
                  </p>

                  <p className="text-xs mt-0.5">
                    {verifyError}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* FLAGGED INCIDENT */}
          {incidentMessage && (
            <div className="w-full max-w-md bg-red-50 border-2 border-red-300 rounded-md p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={20}
                  className="text-red-600 mt-0.5 flex-shrink-0"
                />

                <div>
                  <p className="text-sm font-bold text-red-700">
                    SECURITY ALERT — FLAGGED
                  </p>

                  <p className="text-xs text-red-700 mt-1">
                    {incidentMessage}
                  </p>

                  <p className="text-xs text-red-600 mt-2">
                    Security personnel should inspect
                    the item before allowing entry or
                    exit.
                  </p>
                </div>
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

              {/* ITEM INFORMATION */}
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
                    {scanResult.brand_model ||
                      "—"}
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
                    {scanResult.user?.name ??
                      "Unknown"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Owner ID:{" "}
                  </span>

                  <span className="font-mono font-medium">
                    {scanResult.user?.username ??
                      "—"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Date Registered:{" "}
                  </span>

                  <span className="font-medium">
                    {new Date(
                      scanResult.created_at
                    ).toLocaleDateString(
                      "en-PH",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </span>
                </div>

                <div className="flex gap-1.5 items-center">
                  <span className="text-muted-foreground">
                    Status:
                  </span>

                  <StatusBadge status="Approved" />
                </div>
              </div>

              {/* ENTRY / EXIT */}
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Entry / Exit Log
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs border border-border rounded-md px-3 py-2 bg-muted/30">
                    {gate}
                  </span>

                  <button
                    onClick={() =>
                      handleLog("IN")
                    }
                    disabled={logging}
                    className="text-xs bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {logging
                      ? "Saving..."
                      : "Log IN"}
                  </button>

                  <button
                    onClick={() =>
                      handleLog("OUT")
                    }
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

      {/* RECENT SCANS */}
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
                      ).toLocaleString(
                        "en-PH",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-xs font-mono text-primary whitespace-nowrap">
                      {log.qr_code}
                    </td>

                    <td className="py-2.5 px-3 text-sm font-medium whitespace-nowrap">
                      {log.item?.item_name ??
                        "Unknown"}
                    </td>

                    <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {log.item?.user?.name ??
                        "Unknown"}
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
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    try {
      const logsData = await getScanLogs();
      setLogs(logsData.logs ?? []);
    } catch (error) {
      console.error("Failed to load scan logs:", error);
      setLogs([]);
    }

    try {
      const incidentsData = await getSecurityIncidents();
      setIncidents(incidentsData.incidents ?? []);
    } catch (error) {
      console.error("Failed to load security incidents:", error);
      setIncidents([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleResolveIncident(id: number) {
    const confirmed = window.confirm(
      "Are you sure you want to resolve this security incident?"
    );

    if (!confirmed) return;

    try {
      await resolveSecurityIncident(id);

      alert("Security incident resolved successfully.");

      await loadData();
    } catch (error) {
      console.error("Failed to resolve incident:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to resolve security incident."
      );
    }
  }

  function isToday(dateString: string) {
    if (!dateString) return false;

    const date = new Date(dateString);
    const today = new Date();

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  const todayLogs = logs.filter((log) =>
    isToday(log.scanned_at)
  );

  const todayIncidents = incidents.filter((incident) =>
    isToday(incident.reported_at)
  );

  const verifiedCount = todayLogs.filter(
    (log) =>
      String(log.result ?? "")
        .toLowerCase() === "verified"
  ).length;

  const flaggedCount = todayIncidents.filter(
    (incident) =>
      String(incident.status ?? "")
        .toLowerCase() === "flagged"
  ).length;

  const uniqueStudents = new Set(
    todayLogs
      .map(
        (log) =>
          log.item?.user?.id ??
          log.item?.user?.username ??
          null
      )
      .filter(Boolean)
  ).size;

  const scannedToday =
    todayLogs.length + todayIncidents.length;

  function formatDate(dateString: string) {
    if (!dateString) return "—";

    return new Date(dateString).toLocaleDateString();
  }

  function formatTime(dateString: string) {
    if (!dateString) return "—";

    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function exportCSV() {
    if (logs.length === 0) {
      alert("There are no entry / exit records to export.");
      return;
    }

    const headers = [
      "Date",
      "Time",
      "Owner",
      "Owner ID",
      "Item",
      "Serial Number",
      "QR Code",
      "Gate",
      "Direction",
      "Result",
      "Scanned By",
    ];

    const rows = logs.map((log) => [
      formatDate(log.scanned_at),
      formatTime(log.scanned_at),
      log.item?.user?.name ?? "",
      log.item?.user?.username ?? "",
      log.item?.item_name ?? "",
      log.item?.serial_number ?? "",
      log.qr_code ?? "",
      log.gate ?? "",
      log.direction ?? "",
      log.result ?? "",
      log.scanner?.name ?? "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "").replace(
              /"/g,
              '""'
            );

            return `"${text}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `qrpass-entry-exit-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Entry / Exit Log
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Monitor verified item scans and security
            incidents.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">
            Scanned Today
          </p>

          <p className="text-3xl font-bold text-gray-900 mt-2">
            {scannedToday}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">
            Verified
          </p>

          <p className="text-3xl font-bold text-green-600 mt-2">
            {verifiedCount}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">
            Flagged
          </p>

          <p className="text-3xl font-bold text-red-600 mt-2">
            {flaggedCount}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">
            Unique Students
          </p>

          <p className="text-3xl font-bold text-blue-600 mt-2">
            {uniqueStudents}
          </p>
        </div>
      </div>

      {/* ENTRY / EXIT RECORDS */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Entry / Exit Records
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Successful QR verification records.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Date",
                  "Time",
                  "Owner",
                  "Item",
                  "QR Code",
                  "Gate",
                  "Direction",
                  "Result",
                  "Scanned By",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="py-3 px-3 text-left text-xs font-semibold text-gray-600"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-gray-500"
                  >
                    Loading entry / exit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-gray-500"
                  >
                    No entry / exit records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="py-3 px-3 text-sm text-gray-700">
                      {formatDate(log.scanned_at)}
                    </td>

                    <td className="py-3 px-3 text-sm text-gray-700">
                      {formatTime(log.scanned_at)}
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-sm font-semibold text-gray-900">
                        {log.item?.user?.name ??
                          "Unknown"}
                      </div>

                      <div className="text-xs text-gray-500">
                        {log.item?.user?.username ??
                          ""}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-sm font-semibold text-gray-900">
                        {log.item?.item_name ??
                          "Unknown Item"}
                      </div>

                      <div className="text-xs text-gray-500">
                        {log.item?.serial_number ??
                          ""}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-sm font-mono text-gray-700">
                      {log.qr_code ?? "—"}
                    </td>

                    <td className="py-3 px-3 text-sm text-gray-700">
                      {log.gate ?? "—"}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                          log.direction === "IN"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {log.direction ?? "—"}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        {log.result ?? "Verified"}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-sm text-gray-700">
                      {log.scanner?.name ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FLAGGED / UNREGISTERED ITEMS */}
      <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-red-100 bg-red-50">
          <h2 className="text-lg font-bold text-red-700">
            Flagged / Unregistered Items
          </h2>

          <p className="text-sm text-red-600 mt-1">
            Failed QR verification attempts that require
            security attention.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Date",
                  "Time",
                  "Code",
                  "Incident",
                  "Item",
                  "Gate",
                  "Reported By",
                  "Status",
                  "Action",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="py-3 px-3 text-left text-xs font-semibold text-gray-600"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-gray-500"
                  >
                    Loading security incidents...
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-gray-500"
                  >
                    No security incidents found.
                  </td>
                </tr>
              ) : (
                incidents.map((incident) => (
                  <tr
                    key={incident.id}
                    className="hover:bg-red-50/40"
                  >
                    <td className="py-3 px-3 text-sm text-gray-700">
                      {formatDate(
                        incident.reported_at
                      )}
                    </td>

                    <td className="py-3 px-3 text-sm text-gray-700">
                      {formatTime(
                        incident.reported_at
                      )}
                    </td>

                    <td className="py-3 px-3 text-sm font-mono text-gray-700">
                      {incident.scanned_code ??
                        "—"}
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-sm font-semibold text-red-700">
                        {incident.incident_type ??
                          "Security Incident"}
                      </span>

                      {incident.description && (
                        <div className="text-xs text-gray-500 mt-1 max-w-[240px]">
                          {incident.description}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-sm font-semibold text-gray-900">
                        {incident.item?.item_name ??
                          incident.item_name ??
                          "Unknown Item"}
                      </div>

                      <div className="text-xs text-gray-500">
                        {incident.item?.serial_number ??
                          incident.serial_number ??
                          ""}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-sm text-gray-700">
                      {incident.gate ?? "—"}
                    </td>

                    <td className="py-3 px-3 text-sm text-gray-700">
                      {incident.reporter?.name ??
                        "Security Personnel"}
                    </td>

                    <td className="py-3 px-3">
                      {String(
                        incident.status ?? ""
                      ).toLowerCase() ===
                      "resolved" ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Resolved
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          Flagged
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {String(
                        incident.status ?? ""
                      ).toLowerCase() ===
                      "flagged" ? (
                        <button
                          onClick={() =>
                            handleResolveIncident(
                              incident.id
                            )
                          }
                          className="px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-semibold hover:bg-green-700"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-green-600">
                          Resolved
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
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
  /*
  |--------------------------------------------------------------------------
  | REGISTRY STATE
  |--------------------------------------------------------------------------
  */

  const [items, setItems] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");


  /*
  |--------------------------------------------------------------------------
  | PAGE MODE
  |--------------------------------------------------------------------------
  */

  const [tab, setTab] =
    useState<"registry" | "report">(
      "registry"
    );


  /*
  |--------------------------------------------------------------------------
  | SUBMISSION STATE
  |--------------------------------------------------------------------------
  */

  const [submitting, setSubmitting] =
    useState(false);

  const [
    recoveringId,
    setRecoveringId,
  ] = useState<number | null>(null);


  /*
  |--------------------------------------------------------------------------
  | FOUND ITEM FORM
  |--------------------------------------------------------------------------
  */

  const [form, setForm] = useState({
    found_by_identifier: "",
    item_name: "",
    category: "",
    brand_model: "",
    color: "",
    location_found: "",
    date_found: "",
    description: "",
  });


  /*
  |--------------------------------------------------------------------------
  | LOAD LOST & FOUND REGISTRY
  |--------------------------------------------------------------------------
  */

  async function loadItems() {
    try {
      setLoading(true);
      setError("");

      const data =
        await getLostFoundItems();

      const list =
        Array.isArray(data)
          ? data
          : data?.items ?? [];

      setItems(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Lost & Found registry."
      );
    } finally {
      setLoading(false);
    }
  }


  /*
  |--------------------------------------------------------------------------
  | LOAD PAGE
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadItems();
  }, []);


  /*
  |--------------------------------------------------------------------------
  | FORM CHANGE
  |--------------------------------------------------------------------------
  */

  function handleFormChange(
    e:
      React.ChangeEvent<
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
      >
  ) {
    const {
      name,
      value,
    } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }


  /*
  |--------------------------------------------------------------------------
  | SUBMIT FOUND ITEM
  |--------------------------------------------------------------------------
  |
  | Finder:
  | Person who physically found / turned over the item.
  |
  | Processor:
  | Automatically assigned by Laravel from the logged-in CSU account.
  |
  */

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError("");
    setSuccess("");


    /*
    |--------------------------------------------------------------------------
    | FRONTEND VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
      !form.found_by_identifier.trim()
    ) {
      setError(
        "Please enter the Student/Employee ID of the person who turned over the item."
      );

      return;
    }


    if (!form.item_name.trim()) {
      setError(
        "Please enter the item name."
      );

      return;
    }


    if (
      !form.location_found.trim()
    ) {
      setError(
        "Please enter where the item was found."
      );

      return;
    }


    if (!form.date_found) {
      setError(
        "Please select the date the item was found."
      );

      return;
    }


    /*
    |--------------------------------------------------------------------------
    | SEND TO LARAVEL
    |--------------------------------------------------------------------------
    */

    try {
      setSubmitting(true);

      const result =
        await createLostFoundItem({
          found_by_identifier:
            form.found_by_identifier.trim(),

          item_name:
            form.item_name.trim(),

          category:
            form.category.trim() ||
            undefined,

          brand_model:
            form.brand_model.trim() ||
            undefined,

          color:
            form.color.trim() ||
            undefined,

          location_found:
            form.location_found.trim(),

          date_found:
            form.date_found,

          description:
            form.description.trim() ||
            undefined,
        });


      setSuccess(
        result?.message ||
          "Found item recorded successfully."
      );


      /*
      |--------------------------------------------------------------------------
      | CLEAR FORM
      |--------------------------------------------------------------------------
      */

      setForm({
        found_by_identifier: "",
        item_name: "",
        category: "",
        brand_model: "",
        color: "",
        location_found: "",
        date_found: "",
        description: "",
      });


      /*
      |--------------------------------------------------------------------------
      | REFRESH REGISTRY
      |--------------------------------------------------------------------------
      */

      await loadItems();

      setTab("registry");


      setTimeout(() => {
        setSuccess("");
      }, 5000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to record the found item."
      );
    } finally {
      setSubmitting(false);
    }
  }


  /*
  |--------------------------------------------------------------------------
  | MARK CLAIMED ITEM AS RECOVERED
  |--------------------------------------------------------------------------
  */

  async function handleRecovered(
    id: number
  ) {
    const confirmed =
      window.confirm(
        "Confirm that CSU has verified the claimant's ownership and the item has been returned to the rightful owner?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setRecoveringId(id);
      setError("");
      setSuccess("");

      const result =
        await markLostFoundRecovered(
          id
        );

      setSuccess(
        result?.message ||
          "Item marked as recovered."
      );

      await loadItems();

      setTimeout(() => {
        setSuccess("");
      }, 5000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark the item as recovered."
      );
    } finally {
      setRecoveringId(null);
    }
  }


  /*
  |--------------------------------------------------------------------------
  | SEARCH
  |--------------------------------------------------------------------------
  */

  const filteredItems =
    items.filter((item) => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return true;
      }

      const searchableText = [
        item.id,
        item.item_name,
        item.category,
        item.brand_model,
        item.color,
        item.location_found,
        item.description,
        item.status,

        item.finder?.name,
        item.finder?.username,

        item.processor?.name,
        item.processor?.username,

        item.claimant?.name,
        item.claimant?.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        query
      );
    });


  /*
  |--------------------------------------------------------------------------
  | STATISTICS
  |--------------------------------------------------------------------------
  */

  const foundCount =
    items.filter(
      (item) =>
        String(
          item.status ?? ""
        ).toLowerCase() ===
        "found"
    ).length;


  const claimedCount =
    items.filter(
      (item) =>
        String(
          item.status ?? ""
        ).toLowerCase() ===
        "claimed"
    ).length;


  const recoveredCount =
    items.filter(
      (item) =>
        String(
          item.status ?? ""
        ).toLowerCase() ===
        "recovered"
    ).length;


  /*
  |--------------------------------------------------------------------------
  | DATE FORMATTER
  |--------------------------------------------------------------------------
  */

  function formatDate(
    value?: string | null
  ) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleDateString(
      "en-PH",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  }


  /*
  |--------------------------------------------------------------------------
  | STATUS STYLE
  |--------------------------------------------------------------------------
  */

  function getStatusClass(
    status: string
  ) {
    const normalized =
      status.toLowerCase();

    if (
      normalized === "recovered"
    ) {
      return (
        "bg-green-100 " +
        "text-green-700"
      );
    }

    if (
      normalized === "claimed"
    ) {
      return (
        "bg-yellow-100 " +
        "text-yellow-700"
      );
    }

    return (
      "bg-blue-100 " +
      "text-blue-700"
    );
  }


  /*
  |--------------------------------------------------------------------------
  | PAGE
  |--------------------------------------------------------------------------
  */

  return (
    <div className="space-y-5">

      <PageHeader
        title="Lost & Found"
        subtitle="Record items turned over to the CSU office, credit the finder, and process ownership claims."
      />


      {/* ===============================================================
          CSU PROCEDURE NOTICE
      ================================================================ */}

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">

        <div className="flex items-start gap-3">

          <Shield
            size={18}
            className="mt-0.5 flex-shrink-0 text-blue-700"
          />

          <div>

            <p className="text-sm font-semibold text-blue-900">
              CSU Lost & Found
              Procedure
            </p>

            <p className="mt-1 text-xs leading-relaxed text-blue-800">
              A found item must first
              be physically turned over
              to the Civil Security
              Unit. CSU personnel then
              records the item in
              QRPass and credits the
              person who turned it
              over. Claims must be
              verified by CSU before
              an item is released.
            </p>

          </div>

        </div>

      </div>


      {/* ===============================================================
          MESSAGES
      ================================================================ */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}


      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}


      {/* ===============================================================
          STATISTICS
      ================================================================ */}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

        <StatCard
          label="Total Reports"
          value={String(
            items.length
          )}
          icon={
            <BookOpen size={20} />
          }
          color="#003087"
        />


        <StatCard
          label="Found"
          value={String(
            foundCount
          )}
          icon={
            <Package size={20} />
          }
          color="#00aeef"
        />


        <StatCard
          label="Pending Claims"
          value={String(
            claimedCount
          )}
          icon={
            <Clock size={20} />
          }
          color="#f5c200"
        />


        <StatCard
          label="Recovered"
          value={String(
            recoveredCount
          )}
          icon={
            <CheckCircle
              size={20}
            />
          }
          color="#2ecc71"
        />

      </div>


      {/* ===============================================================
          TAB BUTTONS
      ================================================================ */}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">

        <button
          type="button"
          onClick={() => {
            setTab("registry");
            setError("");
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "registry"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Lost & Found Registry
        </button>


        <button
          type="button"
          onClick={() => {
            setTab("report");
            setError("");
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "report"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          + Record Found Item
        </button>

      </div>


      {/* ===============================================================
          REGISTRY TAB
      ================================================================ */}

      {tab === "registry" && (
        <div className="space-y-4">

          {/* Search */}

          <div className="flex flex-col gap-2 sm:flex-row">

            <div className="relative flex-1">

              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search report, item, finder, claimant, location..."
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />

            </div>


            <button
              type="button"
              onClick={loadItems}
              disabled={loading}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>

          </div>


          {/* Loading */}

          {loading && (
            <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Loading Lost & Found
              records...
            </div>
          )}


          {/* Empty */}

          {!loading &&
            filteredItems.length ===
              0 && (
              <div className="rounded-lg border border-border bg-card p-10 text-center">

                <BookOpen
                  size={32}
                  className="mx-auto mb-3 text-muted-foreground"
                />

                <p className="text-sm font-medium text-foreground">
                  No Lost & Found
                  records found.
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Record an item after
                  it has been turned
                  over to the CSU
                  office.
                </p>

              </div>
            )}


          {/* Records */}

          {!loading &&
            filteredItems.map(
              (item) => {

                const status =
                  String(
                    item.status ??
                      "Found"
                  );

                const statusLower =
                  status.toLowerCase();

                const isClaimed =
                  statusLower ===
                  "claimed";

                const isRecovered =
                  statusLower ===
                  "recovered";

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-card shadow-sm"
                  >

                    <div className="p-4">

                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                        <div className="min-w-0 flex-1">

                          {/* Header */}

                          <div className="flex flex-wrap items-center gap-2">

                            <h3 className="text-base font-semibold text-foreground">
                              {item.item_name}
                            </h3>


                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(
                                status
                              )}`}
                            >
                              {status}
                            </span>


                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              Report #
                              {item.id}
                            </span>

                          </div>


                          {/* Item Info */}

                          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">

                            <div>
                              <p className="text-xs text-muted-foreground">
                                Category
                              </p>

                              <p className="font-medium text-foreground">
                                {item.category ||
                                  "—"}
                              </p>
                            </div>


                            <div>
                              <p className="text-xs text-muted-foreground">
                                Brand /
                                Model
                              </p>

                              <p className="font-medium text-foreground">
                                {item.brand_model ||
                                  "—"}
                              </p>
                            </div>


                            <div>
                              <p className="text-xs text-muted-foreground">
                                Color
                              </p>

                              <p className="font-medium text-foreground">
                                {item.color ||
                                  "—"}
                              </p>
                            </div>


                            <div>
                              <p className="text-xs text-muted-foreground">
                                Location
                                Found
                              </p>

                              <p className="font-medium text-foreground">
                                {item.location_found ||
                                  "—"}
                              </p>
                            </div>


                            <div>
                              <p className="text-xs text-muted-foreground">
                                Date Found
                              </p>

                              <p className="font-medium text-foreground">
                                {formatDate(
                                  item.date_found
                                )}
                              </p>
                            </div>


                            <div>
                              <p className="text-xs text-muted-foreground">
                                Date
                                Reported
                              </p>

                              <p className="font-medium text-foreground">
                                {formatDate(
                                  item.created_at
                                )}
                              </p>
                            </div>

                          </div>


                          {/* Finder Credit */}

                          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">

                            <div className="flex items-start gap-2">

                              <User
                                size={15}
                                className="mt-0.5 flex-shrink-0 text-green-700"
                              />

                              <div>

                                <p className="text-xs font-semibold text-green-800">
                                  Turned Over
                                  By / Finder
                                  Credit
                                </p>

                                <p className="mt-1 text-sm font-medium text-green-900">
                                  {item.finder
                                    ?.name ||
                                    "Not available"}
                                </p>

                                {item.finder
                                  ?.username && (
                                  <p className="text-xs text-green-700">
                                    ID:{" "}
                                    {
                                      item
                                        .finder
                                        .username
                                    }
                                  </p>
                                )}

                              </div>

                            </div>

                          </div>


                          {/* CSU Processor */}

                          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">

                            <p className="text-xs text-muted-foreground">
                              Processed by
                              CSU
                            </p>

                            <p className="mt-0.5 text-sm font-medium text-foreground">
                              {item.processor
                                ?.name ||
                                item.reporter
                                  ?.name ||
                                "—"}
                            </p>

                          </div>


                          {/* Claim Information */}

                          {item.claimant && (
                            <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">

                              <p className="text-xs font-semibold text-yellow-800">
                                Claimant
                              </p>

                              <p className="mt-1 text-sm font-medium text-yellow-900">
                                {
                                  item
                                    .claimant
                                    .name
                                }
                              </p>

                              {item.claimant
                                .username && (
                                <p className="text-xs text-yellow-700">
                                  ID:{" "}
                                  {
                                    item
                                      .claimant
                                      .username
                                  }
                                </p>
                              )}

                              {item.claimed_at && (
                                <p className="mt-1 text-xs text-yellow-700">
                                  Claim
                                  submitted:{" "}
                                  {formatDate(
                                    item.claimed_at
                                  )}
                                </p>
                              )}

                            </div>
                          )}


                          {/* Description */}

                          {item.description && (
                            <div className="mt-3 rounded-lg bg-muted/40 p-3">

                              <p className="text-xs font-medium text-muted-foreground">
                                Description
                              </p>

                              <p className="mt-1 text-sm text-foreground">
                                {
                                  item.description
                                }
                              </p>

                            </div>
                          )}

                        </div>


                        {/* Actions */}

                        <div className="flex flex-shrink-0 flex-col gap-2">

                          {isClaimed && (
                            <button
                              type="button"
                              disabled={
                                recoveringId ===
                                Number(
                                  item.id
                                )
                              }
                              onClick={() =>
                                handleRecovered(
                                  Number(
                                    item.id
                                  )
                                )
                              }
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {recoveringId ===
                              Number(
                                item.id
                              )
                                ? "Processing..."
                                : "Verify & Mark Recovered"}
                            </button>
                          )}


                          {isRecovered && (
                            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                              Item returned
                              to verified
                              owner
                            </div>
                          )}

                        </div>

                      </div>

                    </div>

                  </div>
                );
              }
            )}

        </div>
      )}


      {/* ===============================================================
          RECORD FOUND ITEM TAB
      ================================================================ */}

      {tab === "report" && (
        <div className="rounded-lg border border-border bg-card shadow-sm">

          {/* Form Header */}

          <div className="border-b border-border px-4 py-4">

            <h3 className="font-semibold text-foreground">
              Record Found Item
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">
              Use this form only after
              the physical item has
              been surrendered to the
              CSU office.
            </p>

          </div>


          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-5 p-4"
          >

            {/* Finder Credit */}

            <div className="rounded-lg border border-green-200 bg-green-50 p-4">

              <div className="mb-3">

                <p className="text-sm font-semibold text-green-900">
                  Finder / Turnover
                  Credit
                </p>

                <p className="mt-1 text-xs text-green-700">
                  Enter the QRPass
                  Student or Employee
                  ID of the person who
                  physically found and
                  turned over the
                  item.
                </p>

              </div>


              <label className="mb-1 block text-xs font-medium text-green-900">
                Student / Employee ID
                *
              </label>

              <input
                type="text"
                name="found_by_identifier"
                value={
                  form.found_by_identifier
                }
                onChange={
                  handleFormChange
                }
                required
                placeholder="Example: 26-9999"
                className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
              />

              <p className="mt-1 text-xs text-green-700">
                QRPass will use this
                ID to identify and
                credit the finder.
              </p>

            </div>


            {/* Item Name / Category */}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              <div>

                <label className="mb-1 block text-xs font-medium text-foreground">
                  Item Name *
                </label>

                <input
                  type="text"
                  name="item_name"
                  value={
                    form.item_name
                  }
                  onChange={
                    handleFormChange
                  }
                  required
                  placeholder="Example: Laptop"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />

              </div>


              <div>

                <label className="mb-1 block text-xs font-medium text-foreground">
                  Category
                </label>

                <select
                  name="category"
                  value={
                    form.category
                  }
                  onChange={
                    handleFormChange
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >

                  <option value="">
                    Select category
                  </option>

                  <option value="Laptop">
                    Laptop
                  </option>

                  <option value="Mobile Phone">
                    Mobile Phone
                  </option>

                  <option value="Tablet">
                    Tablet
                  </option>

                  <option value="Bag">
                    Bag
                  </option>

                  <option value="Wallet">
                    Wallet
                  </option>

                  <option value="ID / Card">
                    ID / Card
                  </option>

                  <option value="Accessories">
                    Accessories
                  </option>

                  <option value="Other">
                    Other
                  </option>

                </select>

              </div>

            </div>


            {/* Brand / Color */}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              <div>

                <label className="mb-1 block text-xs font-medium text-foreground">
                  Brand / Model
                </label>

                <input
                  type="text"
                  name="brand_model"
                  value={
                    form.brand_model
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Example: Acer Aspire 5"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />

              </div>


              <div>

                <label className="mb-1 block text-xs font-medium text-foreground">
                  Color
                </label>

                <input
                  type="text"
                  name="color"
                  value={
                    form.color
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Example: Black"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />

              </div>

            </div>


            {/* Location / Date */}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              <div>

                <label className="mb-1 block text-xs font-medium text-foreground">
                  Location Found *
                </label>

                <input
                  type="text"
                  name="location_found"
                  value={
                    form.location_found
                  }
                  onChange={
                    handleFormChange
                  }
                  required
                  placeholder="Example: 4th Floor Computer Laboratory"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />

              </div>


              <div>

                <label className="mb-1 block text-xs font-medium text-foreground">
                  Date Found *
                </label>

                <input
                  type="date"
                  name="date_found"
                  value={
                    form.date_found
                  }
                  onChange={
                    handleFormChange
                  }
                  required
                  max={
                    new Date()
                      .toISOString()
                      .split("T")[0]
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />

              </div>

            </div>


            {/* Description */}

            <div>

              <label className="mb-1 block text-xs font-medium text-foreground">
                Item Description
              </label>

              <textarea
                name="description"
                value={
                  form.description
                }
                onChange={
                  handleFormChange
                }
                rows={4}
                placeholder="Describe identifying features, case, stickers, scratches, accessories, or other useful details."
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />

            </div>


            {/* Security Notice */}

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">

              <p className="text-xs text-yellow-800">
                Confirm that the item
                has already been
                physically received by
                CSU before saving this
                record.
              </p>

            </div>


            {/* Buttons */}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <button
                type="button"
                onClick={() => {
                  setTab(
                    "registry"
                  );

                  setError("");
                }}
                className="rounded-lg border border-border bg-background px-5 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>


              <button
                type="submit"
                disabled={
                  submitting
                }
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Saving..."
                  : "Record Found Item"}
              </button>

            </div>

          </form>

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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const data = await getNotifications();

      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    } catch (err) {
      console.error(
        "Failed to load PCO notifications:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkRead(id: number) {
    try {
      setProcessingId(id);

      await markNotificationRead(id);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? {
                ...notification,
                is_read: true,
                read_at:
                  notification.read_at ??
                  new Date().toISOString(),
              }
            : notification
        )
      );

      setUnreadCount((current) =>
        Math.max(0, current - 1)
      );
    } catch (err) {
      console.error(
        "Failed to mark notification as read:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Failed to mark notification as read."
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleMarkAllRead() {
    try {
      setMarkingAll(true);

      await markAllNotificationsRead();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
          read_at:
            notification.read_at ??
            new Date().toISOString(),
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error(
        "Failed to mark all notifications as read:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Failed to mark all notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  function formatNotificationDate(
    dateString: string
  ) {
    if (!dateString) {
      return "—";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getNotificationStyle(type: string) {
    switch (
      String(type ?? "").toLowerCase()
    ) {
      case "new_item_registration":
        return {
          background:
            "bg-yellow-50 border-yellow-200",
          iconBackground:
            "bg-yellow-100 text-yellow-700",
        };

      case "item_approved":
        return {
          background:
            "bg-green-50 border-green-200",
          iconBackground:
            "bg-green-100 text-green-700",
        };

      case "item_submitted":
        return {
          background:
            "bg-blue-50 border-blue-200",
          iconBackground:
            "bg-blue-100 text-blue-700",
        };

      case "lost_found_claim":
        return {
          background:
            "bg-purple-50 border-purple-200",
          iconBackground:
            "bg-purple-100 text-purple-700",
        };

      default:
        return {
          background:
            "bg-muted/30 border-border",
          iconBackground:
            "bg-muted text-muted-foreground",
        };
    }
  }

  const readCount =
    notifications.length - unreadCount;

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Notifications"
          subtitle="PCO item registration alerts and system updates."
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="px-3 py-2 border border-border rounded-md text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            onClick={handleMarkAllRead}
            disabled={
              markingAll ||
              unreadCount === 0
            }
            className="px-3 py-2 bg-primary text-white rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {markingAll
              ? "Marking..."
              : "Mark All as Read"}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label="All Notifications"
          value={String(
            notifications.length
          )}
          icon={
            <FileText size={20} />
          }
          color="#003087"
        />

        <StatCard
          label="Unread"
          value={String(unreadCount)}
          icon={
            <AlertTriangle size={20} />
          }
          color="#f5c200"
        />

        <StatCard
          label="Read"
          value={String(readCount)}
          icon={
            <CheckCircle size={20} />
          }
          color="#2ecc71"
        />
      </div>

      {/* NOTIFICATIONS */}
      <Card title="All Notifications">
        <div className="p-3">
          {loading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Loading notifications...
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle
                size={36}
                className="mx-auto mb-3 text-muted-foreground"
              />

              <p className="text-sm font-semibold text-foreground">
                No notifications
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                New item registration
                requests will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(
                (notification: any) => {
                  const styles =
                    getNotificationStyle(
                      notification.type
                    );

                  const isRead =
                    Boolean(
                      notification.is_read
                    );

                  return (
                    <div
                      key={
                        notification.id
                      }
                      className={`border rounded-lg p-4 transition-colors ${
                        isRead
                          ? "bg-white border-border"
                          : styles.background
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* ICON */}
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            isRead
                              ? "bg-muted text-muted-foreground"
                              : styles.iconBackground
                          }`}
                        >
                          {notification.type ===
                          "new_item_registration" ? (
                            <Clock
                              size={17}
                            />
                          ) : notification.type ===
                            "item_approved" ? (
                            <CheckCircle
                              size={17}
                            />
                          ) : (
                            <FileText
                              size={17}
                            />
                          )}
                        </div>

                        {/* CONTENT */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3
                                  className={`text-sm ${
                                    isRead
                                      ? "font-medium"
                                      : "font-bold"
                                  }`}
                                >
                                  {notification.title ??
                                    "Notification"}
                                </h3>

                                {!isRead && (
                                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                )}
                              </div>

                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                {notification.message}
                              </p>
                            </div>

                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {formatNotificationDate(
                                notification.created_at
                              )}
                            </span>
                          </div>

                          {/* ACTION */}
                          {!isRead && (
                            <div className="mt-3">
                              <button
                                onClick={() =>
                                  handleMarkRead(
                                    notification.id
                                  )
                                }
                                disabled={
                                  processingId ===
                                  notification.id
                                }
                                className="text-xs text-primary font-semibold hover:underline disabled:opacity-50"
                              >
                                {processingId ===
                                notification.id
                                  ? "Marking..."
                                  : "Mark as Read"}
                              </button>
                            </div>
                          )}

                          {isRead &&
                            notification.read_at && (
                              <p className="text-[10px] text-muted-foreground mt-2">
                                Read{" "}
                                {formatNotificationDate(
                                  notification.read_at
                                )}
                              </p>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PAGES
// ══════════════════════════════════════════════════════════════════════════════
function AdminDashboard() {
  const [dashboardData, setDashboardData] =
    useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const data = await getDashboard();

      setDashboardData(data);
    } catch (err) {
      console.error(
        "Failed to load dashboard:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function formatActivityTime(
    dateString: string | null
  ) {
    if (!dateString) return "—";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const stats = dashboardData?.stats ?? {
    total_items: 0,
    active_qr_codes: 0,
    pending_registrations: 0,
    scans_today: 0,
    flagged_incidents: 0,
    lost_found_items: 0,
  };

  const itemTypes =
    dashboardData?.item_types ?? [];

  const recentScans =
    dashboardData?.recent_scans ?? [];

  const recentIncidents =
    dashboardData?.recent_incidents ?? [];

  const maxItemTypeCount = Math.max(
    ...itemTypes.map((item: any) =>
      Number(item.total ?? 0)
    ),
    1
  );

  const recentActivity = [
    ...recentScans.map((scan: any) => ({
      id: `scan-${scan.id}`,
      type: "scan",
      date: scan.scanned_at,
      message: `${
        scan.direction ?? "QR"
      } scan verified for ${
        scan.item?.item_name ?? "registered item"
      } at ${scan.gate ?? "campus gate"}.`,
    })),

    ...recentIncidents.map(
      (incident: any) => ({
        id: `incident-${incident.id}`,
        type: "incident",
        date: incident.reported_at,
        message: `${
          incident.incident_type ??
          "Security incident"
        } reported at ${
          incident.gate ?? "campus gate"
        }${
          incident.scanned_code
            ? ` — ${incident.scanned_code}`
            : ""
        }.`,
      })
    ),
  ]
    .sort(
      (a, b) =>
        new Date(b.date ?? 0).getTime() -
        new Date(a.date ?? 0).getTime()
    )
    .slice(0, 8);

  if (loading && !dashboardData) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Overview Dashboard"
          subtitle="System-wide summary of QRpass operations."
        />

        <div className="bg-white border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          Loading dashboard data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Overview Dashboard"
          subtitle="System-wide summary of QRpass operations."
        />

        <button
          onClick={loadDashboard}
          disabled={loading}
          className="px-3 py-2 border border-border rounded-md text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          {loading
            ? "Refreshing..."
            : "Refresh Dashboard"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* MAIN STATISTICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Total Items"
          value={String(stats.total_items)}
          icon={<Package size={20} />}
          color="#003087"
        />

        <StatCard
          label="Active QR"
          value={String(stats.active_qr_codes)}
          icon={<QrCode size={20} />}
          color="#00aeef"
        />

        <StatCard
          label="Scans Today"
          value={String(stats.scans_today)}
          icon={<ScanLine size={20} />}
          color="#f5c200"
        />

        <StatCard
          label="Flagged Incidents"
          value={String(stats.flagged_incidents)}
          icon={<AlertTriangle size={20} />}
          color="#e8543a"
        />

        <StatCard
          label="Pending"
          value={String(
            stats.pending_registrations
          )}
          icon={<Clock size={20} />}
          color="#8b5cf6"
        />

        <StatCard
          label="Lost & Found"
          value={String(stats.lost_found_items)}
          icon={<Search size={20} />}
          color="#2ecc71"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* ITEM TYPES */}
        <Card title="Registered Items by Type">
          <div className="p-4">
            {itemTypes.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No registered items yet.
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  Item statistics will appear here after
                  students register items.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {itemTypes.map(
                  (item: any, index: number) => {
                    const count = Number(
                      item.total ?? 0
                    );

                    const percentage =
                      (count /
                        maxItemTypeCount) *
                      100;

                    const colors = [
                      "#003087",
                      "#00aeef",
                      "#f5c200",
                      "#2ecc71",
                      "#8b5cf6",
                      "#e8543a",
                    ];

                    const color =
                      colors[
                        index %
                          colors.length
                      ];

                    return (
                      <div
                        key={
                          item.item_type ??
                          index
                        }
                      >
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="text-xs font-medium text-foreground">
                            {item.item_type ||
                              "Other"}
                          </span>

                          <span className="text-xs font-semibold text-muted-foreground">
                            {count}
                          </span>
                        </div>

                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(
                                percentage,
                                3
                              )}%`,
                              backgroundColor:
                                color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </Card>

        {/* RECENT ACTIVITY */}
        <Card title="Recent System Activity">
          {recentActivity.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-foreground">
                No recent activity.
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                QR scans and security incidents will
                appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentActivity.map(
                (activity) => (
                  <div
                    key={activity.id}
                    className="px-4 py-3 flex gap-3"
                  >
                    <div className="mt-0.5">
                      {activity.type ===
                      "incident" ? (
                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                          <AlertTriangle
                            size={15}
                            className="text-red-600"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                          <CheckCircle
                            size={15}
                            className="text-green-600"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">
                        {activity.message}
                      </p>

                      <p className="text-[11px] text-muted-foreground mt-1">
                        {formatActivityTime(
                          activity.date
                        )}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function AdminRecords() {
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total_records: 0,
    this_month: 0,
    flagged: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  async function loadRecords() {
    try {
      setLoading(true);
      setError("");

      const data = await getSystemRecords();

      setRecords(data.records ?? []);

      setSummary(
        data.summary ?? {
          total_records: 0,
          this_month: 0,
          flagged: 0,
        }
      );
    } catch (err) {
      console.error(
        "Failed to load system records:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load system records."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  function formatDate(dateString: string) {
    if (!dateString) return "—";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString();
  }

  function formatTime(dateString: string) {
    if (!dateString) return "—";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const recordTypes = [
    "All",
    "Item Registration",
    "QR Scan",
    "Security Incident",
    "Lost & Found",
  ];

  const filteredRecords = records.filter(
    (record) => {
      const matchesType =
        typeFilter === "All" ||
        record.record_type === typeFilter;

      const query = search
        .trim()
        .toLowerCase();

      if (!matchesType) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        record.record_type,
        record.title,
        record.description,
        record.user_name,
        record.user_id,
        record.status,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      );
    }
  );

  function exportCSV() {
    if (filteredRecords.length === 0) {
      alert(
        "There are no system records to export."
      );
      return;
    }

    const headers = [
      "Date",
      "Time",
      "Record Type",
      "Title",
      "Description",
      "User",
      "User ID",
      "Status",
    ];

    const rows = filteredRecords.map(
      (record) => [
        formatDate(record.date),
        formatTime(record.date),
        record.record_type ?? "",
        record.title ?? "",
        record.description ?? "",
        record.user_name ?? "",
        record.user_id ?? "",
        record.status ?? "",
      ]
    );

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const text = String(
              value ?? ""
            ).replace(/"/g, '""');

            return `"${text}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csvContent],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download = `qrpass-system-records-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function getStatusClasses(status: string) {
    const value = String(
      status ?? ""
    ).toLowerCase();

    if (
      value === "verified" ||
      value === "approved" ||
      value === "claimed" ||
      value === "resolved"
    ) {
      return "bg-green-100 text-green-700";
    }

    if (
      value === "flagged"
    ) {
      return "bg-red-100 text-red-700";
    }

    if (
      value === "pending"
    ) {
      return "bg-yellow-100 text-yellow-700";
    }

    if (
      value === "found"
    ) {
      return "bg-blue-100 text-blue-700";
    }

    return "bg-gray-100 text-gray-700";
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="System Records"
          subtitle="Centralized records for all QRpass transactions."
        />

        <div className="flex gap-2">
          <button
            onClick={loadRecords}
            disabled={loading}
            className="px-3 py-2 border border-border rounded-md text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            onClick={exportCSV}
            className="px-3 py-2 bg-primary text-white rounded-md text-xs font-semibold hover:opacity-90"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total Records"
          value={String(
            summary.total_records
          )}
          icon={<Layers size={20} />}
          color="#003087"
        />

        <StatCard
          label="This Month"
          value={String(
            summary.this_month
          )}
          icon={<FileText size={20} />}
          color="#f5c200"
        />

        <StatCard
          label="Flagged"
          value={String(
            summary.flagged
          )}
          icon={
            <AlertTriangle
              size={20}
            />
          }
          color="#e8543a"
        />
      </div>

      {/* SEARCH AND FILTER */}
      <div className="bg-white border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search records, users, items, status..."
            className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target.value
              )
            }
            className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {recordTypes.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* RECORDS TABLE */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm text-foreground">
                System Transactions
              </h2>

              <p className="text-xs text-muted-foreground mt-0.5">
                Showing{" "}
                {
                  filteredRecords.length
                }{" "}
                record
                {filteredRecords.length !==
                1
                  ? "s"
                  : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-muted/50">
                {[
                  "Date",
                  "Time",
                  "Type",
                  "Record",
                  "Description",
                  "User",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="text-left py-3 px-3 text-xs text-muted-foreground font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    Loading system records...
                  </td>
                </tr>
              ) : filteredRecords.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      No system records
                      found.
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                      Try changing the
                      search or filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(
                  (record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-muted/30"
                    >
                      <td className="py-3 px-3 text-xs text-foreground whitespace-nowrap">
                        {formatDate(
                          record.date
                        )}
                      </td>

                      <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(
                          record.date
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-xs font-semibold text-primary">
                          {record.record_type ??
                            "Record"}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <p className="text-xs font-semibold text-foreground">
                          {record.title ??
                            "—"}
                        </p>

                        {record.user_id && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {
                              record.user_id
                            }
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <p className="text-xs text-foreground max-w-[330px]">
                          {record.description ??
                            "—"}
                        </p>
                      </td>

                      <td className="py-3 px-3 text-xs text-foreground">
                        {record.user_name ??
                          "—"}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStatusClasses(
                            record.status
                          )}`}
                        >
                          {record.status ??
                            "Unknown"}
                        </span>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminAnalytics() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReports() {
    try {
      setLoading(true);
      setError("");

      const data = await getReports();

      setReportData(data);
    } catch (err) {
      console.error("Failed to load reports:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load report data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const summary = reportData?.summary ?? {
    total_registered_items: 0,
    active_qr_codes: 0,
    pending_items: 0,
    scans_today: 0,
    scans_this_month: 0,
    registrations_this_month: 0,
    flagged_incidents: 0,
    resolved_incidents: 0,
    lost_found_available: 0,
    lost_found_claimed: 0,
  };

  const itemTypes =
    reportData?.item_types ?? [];

  const dailyScans =
    reportData?.daily_scans ?? [];

  const monthlyRegistrations =
    reportData?.monthly_registrations ?? [];

  const recentRegistrations =
    reportData?.recent_registrations ?? [];

  const recentIncidents =
    reportData?.recent_incidents ?? [];

  function formatDate(dateString: string) {
    if (!dateString) return "—";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString();
  }

  function formatTime(dateString: string) {
    if (!dateString) return "—";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const maxItemType = Math.max(
    ...itemTypes.map((item: any) =>
      Number(item.total ?? 0)
    ),
    1
  );

  const maxDailyScans = Math.max(
    ...dailyScans.map((item: any) =>
      Number(item.total ?? 0)
    ),
    1
  );

  const maxMonthly = Math.max(
    ...monthlyRegistrations.map((item: any) =>
      Number(item.total ?? 0)
    ),
    1
  );

  // =========================================================
  // DAILY QR SCAN PDF
  // =========================================================

  async function downloadDailyQrScanPDF() {
    try {
      const data = await getScanLogs();

      const allLogs = data.logs ?? [];

      const today = new Date();

      const todayLogs = allLogs.filter(
        (log: any) => {
          if (!log.scanned_at) {
            return false;
          }

          const scanDate = new Date(
            log.scanned_at
          );

          return (
            scanDate.getFullYear() ===
              today.getFullYear() &&
            scanDate.getMonth() ===
              today.getMonth() &&
            scanDate.getDate() ===
              today.getDate()
          );
        }
      );

      if (todayLogs.length === 0) {
        alert(
          "There are no QR scan records for today."
        );

        return;
      }

      const doc = new jsPDF({
        orientation: "landscape",
      });

      const verifiedCount =
        todayLogs.filter(
          (log: any) =>
            String(
              log.result ?? ""
            ).toLowerCase() === "verified"
        ).length;

      const inCount =
        todayLogs.filter(
          (log: any) =>
            String(
              log.direction ?? ""
            ).toUpperCase() === "IN"
        ).length;

      const outCount =
        todayLogs.filter(
          (log: any) =>
            String(
              log.direction ?? ""
            ).toUpperCase() === "OUT"
        ).length;

      doc.setFontSize(18);

      doc.text(
        "QRPass Daily QR Scan Summary",
        14,
        18
      );

      doc.setFontSize(10);

      doc.text(
        "University of Cebu - Main Campus",
        14,
        25
      );

      doc.text(
        `Report Date: ${today.toLocaleDateString()}`,
        14,
        31
      );

      doc.text(
        `Total QR Scans: ${todayLogs.length}`,
        14,
        37
      );

      doc.text(
        `Verified Scans: ${verifiedCount}`,
        14,
        43
      );

      doc.text(
        `Entry Scans: ${inCount}`,
        75,
        37
      );

      doc.text(
        `Exit Scans: ${outCount}`,
        75,
        43
      );

      const tableRows =
        todayLogs.map((log: any) => {
          return [
            formatDate(
              log.scanned_at
            ),

            formatTime(
              log.scanned_at
            ),

            log.item?.user?.name ??
              "Unknown",

            log.item?.user?.username ??
              "—",

            log.item?.item_name ??
              "Unknown Item",

            log.item?.serial_number ??
              "—",

            log.qr_code ?? "—",

            log.gate ?? "—",

            log.direction ?? "—",

            log.result ?? "—",

            log.scanner?.name ?? "—",
          ];
        });

      autoTable(doc, {
        startY: 50,

        head: [
          [
            "Date",
            "Time",
            "Owner",
            "Owner ID",
            "Item",
            "Serial No.",
            "QR Code",
            "Gate",
            "Direction",
            "Result",
            "Scanned By",
          ],
        ],

        body: tableRows,

        styles: {
          fontSize: 7,
          cellPadding: 2,
        },

        headStyles: {
          fillColor: [0, 48, 135],
          textColor: [255, 255, 255],
        },

        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
      });

      const filenameDate = today
        .toISOString()
        .slice(0, 10);

      doc.save(
        `QRPass-Daily-QR-Scan-${filenameDate}.pdf`
      );
    } catch (err) {
      console.error(
        "Failed to generate daily QR scan PDF:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Failed to generate Daily QR Scan PDF."
      );
    }
  }

  // =========================================================
  // MONTHLY ITEM REGISTRATION PDF
  // =========================================================

  async function downloadMonthlyRegistrationPDF() {
    try {
      const data = await getAllItems();

      const allItems = data.items ?? [];

      const now = new Date();

      const monthlyItems =
        allItems.filter(
          (item: any) => {
            if (!item.created_at) {
              return false;
            }

            const created =
              new Date(
                item.created_at
              );

            return (
              created.getFullYear() ===
                now.getFullYear() &&
              created.getMonth() ===
                now.getMonth()
            );
          }
        );

      if (
        monthlyItems.length === 0
      ) {
        alert(
          "There are no item registrations for this month."
        );

        return;
      }

      const doc = new jsPDF({
        orientation: "landscape",
      });

      const monthName =
        now.toLocaleDateString(
          "en-US",
          {
            month: "long",
            year: "numeric",
          }
        );

      const approvedCount =
        monthlyItems.filter(
          (item: any) =>
            String(
              item.status ?? ""
            ).toLowerCase() === "approved"
        ).length;

      const pendingCount =
        monthlyItems.filter(
          (item: any) =>
            String(
              item.status ?? ""
            ).toLowerCase() === "pending"
        ).length;

      doc.setFontSize(18);

      doc.text(
        "QRPass Monthly Item Registration Summary",
        14,
        18
      );

      doc.setFontSize(10);

      doc.text(
        "University of Cebu - Main Campus",
        14,
        25
      );

      doc.text(
        `Reporting Period: ${monthName}`,
        14,
        31
      );

      doc.text(
        `Total Registrations: ${monthlyItems.length}`,
        14,
        37
      );

      doc.text(
        `Approved: ${approvedCount}`,
        75,
        37
      );

      doc.text(
        `Pending: ${pendingCount}`,
        120,
        37
      );

      const tableRows =
        monthlyItems.map(
          (item: any) => {
            return [
              formatDate(
                item.created_at
              ),

              item.user?.name ??
                "Unknown",

              item.user?.username ??
                "—",

              item.item_name ??
                "—",

              item.item_type ??
                "—",

              item.brand_model ??
                "—",

              item.serial_number ??
                "—",

              item.color ??
                "—",

              item.qr_code ??
                "Not issued",

              item.status ??
                "—",
            ];
          }
        );

      autoTable(doc, {
        startY: 45,

        head: [
          [
            "Date",
            "Owner",
            "Owner ID",
            "Item",
            "Type",
            "Brand / Model",
            "Serial No.",
            "Color",
            "QR Code",
            "Status",
          ],
        ],

        body: tableRows,

        styles: {
          fontSize: 7,
          cellPadding: 2,
        },

        headStyles: {
          fillColor: [0, 48, 135],
          textColor: [255, 255, 255],
        },

        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
      });

      const fileMonth =
        `${now.getFullYear()}-${String(
          now.getMonth() + 1
        ).padStart(2, "0")}`;

      doc.save(
        `QRPass-Monthly-Item-Registration-${fileMonth}.pdf`
      );
    } catch (err) {
      console.error(
        "Failed to generate monthly registration PDF:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Failed to generate Monthly Registration PDF."
      );
    }
  }

  // =========================================================
  // SECURITY INCIDENT EXCEL
  // =========================================================

  async function downloadFlaggedIncidentsExcel() {
    try {
      const data =
        await getSecurityIncidents();

      const incidents =
        data.incidents ?? [];

      if (incidents.length === 0) {
        alert(
          "There are no security incident records to export."
        );

        return;
      }

      const flaggedCount =
        incidents.filter(
          (incident: any) =>
            String(
              incident.status ?? ""
            ).toLowerCase() ===
            "flagged"
        ).length;

      const resolvedCount =
        incidents.filter(
          (incident: any) =>
            String(
              incident.status ?? ""
            ).toLowerCase() ===
            "resolved"
        ).length;

      const incidentRows =
        incidents.map(
          (incident: any) => {
            return {
              Date: formatDate(
                incident.reported_at
              ),

              Time: formatTime(
                incident.reported_at
              ),

              "Incident Type":
                incident.incident_type ??
                "Security Incident",

              "Scanned Code":
                incident.scanned_code ??
                "",

              "Item Name":
                incident.item
                  ?.item_name ??
                incident.item_name ??
                "Unknown Item",

              "Serial Number":
                incident.item
                  ?.serial_number ??
                incident.serial_number ??
                "",

              Gate:
                incident.gate ??
                "",

              "Reported By":
                incident.reporter
                  ?.name ??
                "Security Personnel",

              "Reporter ID":
                incident.reporter
                  ?.username ??
                "",

              Status:
                incident.status ??
                "Flagged",

              Description:
                incident.description ??
                "",
            };
          }
        );

      const summaryRows = [
        {
          Metric:
            "Total Security Incidents",

          Value:
            incidents.length,
        },

        {
          Metric:
            "Currently Flagged",

          Value:
            flaggedCount,
        },

        {
          Metric:
            "Resolved Incidents",

          Value:
            resolvedCount,
        },

        {
          Metric:
            "Report Generated",

          Value:
            new Date().toLocaleString(),
        },
      ];

      const workbook =
        XLSX.utils.book_new();

      const summarySheet =
        XLSX.utils.json_to_sheet(
          summaryRows
        );

      const incidentSheet =
        XLSX.utils.json_to_sheet(
          incidentRows
        );

      summarySheet["!cols"] = [
        { wch: 25 },
        { wch: 25 },
      ];

      incidentSheet["!cols"] = [
        { wch: 14 },
        { wch: 12 },
        { wch: 22 },
        { wch: 25 },
        { wch: 25 },
        { wch: 22 },
        { wch: 15 },
        { wch: 25 },
        { wch: 20 },
        { wch: 14 },
        { wch: 45 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        summarySheet,
        "Summary"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        incidentSheet,
        "Security Incidents"
      );

      const today = new Date()
        .toISOString()
        .slice(0, 10);

      XLSX.writeFile(
        workbook,
        `QRPass-Security-Incidents-${today}.xlsx`
      );
    } catch (err) {
      console.error(
        "Failed to generate security incident Excel report:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Failed to generate Security Incident Excel report."
      );
    }
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Reports & Analytics"
          subtitle="Real-time QRpass statistics and downloadable system reports."
        />

        <button
          onClick={loadReports}
          disabled={loading}
          className="px-3 py-2 border border-border rounded-md text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          {loading
            ? "Refreshing..."
            : "Refresh Reports"}
        </button>
      </div>

      {/* DOWNLOADABLE REPORTS */}
      <div className="bg-white border border-border rounded-lg p-4">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-foreground">
            Download Reports
          </h2>

          <p className="text-xs text-muted-foreground mt-1">
            Generate reports using current QRPass database records.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={
              downloadDailyQrScanPDF
            }
            className="px-4 py-2.5 bg-primary text-white rounded-md text-xs font-semibold hover:opacity-90 flex items-center gap-2"
          >
            <Download size={14} />

            Daily QR Scan PDF
          </button>

          <button
            onClick={
              downloadMonthlyRegistrationPDF
            }
            className="px-4 py-2.5 bg-blue-600 text-white rounded-md text-xs font-semibold hover:opacity-90 flex items-center gap-2"
          >
            <Download size={14} />

            Monthly Registration PDF
          </button>

          <button
            onClick={
              downloadFlaggedIncidentsExcel
            }
            className="px-4 py-2.5 bg-green-600 text-white rounded-md text-xs font-semibold hover:opacity-90 flex items-center gap-2"
          >
            <Download size={14} />

            Security Incidents Excel
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* MAIN SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Registered Items"
          value={String(
            summary.total_registered_items
          )}
          icon={
            <Package size={20} />
          }
          color="#003087"
        />

        <StatCard
          label="Active QR"
          value={String(
            summary.active_qr_codes
          )}
          icon={
            <QrCode size={20} />
          }
          color="#00aeef"
        />

        <StatCard
          label="Pending"
          value={String(
            summary.pending_items
          )}
          icon={
            <Clock size={20} />
          }
          color="#8b5cf6"
        />

        <StatCard
          label="Scans Today"
          value={String(
            summary.scans_today
          )}
          icon={
            <ScanLine size={20} />
          }
          color="#f5c200"
        />

        <StatCard
          label="Flagged"
          value={String(
            summary.flagged_incidents
          )}
          icon={
            <AlertTriangle
              size={20}
            />
          }
          color="#e8543a"
        />

        <StatCard
          label="Resolved"
          value={String(
            summary.resolved_incidents
          )}
          icon={
            <CheckCircle
              size={20}
            />
          }
          color="#2ecc71"
        />
      </div>

      {/* SECONDARY SUMMARY */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Scans This Month"
          value={String(
            summary.scans_this_month
          )}
          icon={
            <BarChart2 size={20} />
          }
          color="#003087"
        />

        <StatCard
          label="Registrations This Month"
          value={String(
            summary.registrations_this_month
          )}
          icon={
            <FileText size={20} />
          }
          color="#00aeef"
        />

        <StatCard
          label="Found Items"
          value={String(
            summary.lost_found_available
          )}
          icon={
            <Search size={20} />
          }
          color="#f5c200"
        />

        <StatCard
          label="Claimed Items"
          value={String(
            summary.lost_found_claimed
          )}
          icon={
            <CheckCircle
              size={20}
            />
          }
          color="#2ecc71"
        />
      </div>

      {/* ANALYTICS */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* ITEMS BY TYPE */}
        <Card title="Items by Type">
          <div className="p-4 space-y-4">
            {itemTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No item data available.
              </p>
            ) : (
              itemTypes.map(
                (
                  item: any,
                  index: number
                ) => {
                  const total =
                    Number(
                      item.total ?? 0
                    );

                  const percentage =
                    (total /
                      maxItemType) *
                    100;

                  const colors = [
                    "#003087",
                    "#00aeef",
                    "#f5c200",
                    "#2ecc71",
                    "#8b5cf6",
                    "#e8543a",
                  ];

                  return (
                    <div
                      key={
                        item.item_type ??
                        index
                      }
                    >
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">
                          {item.item_type ||
                            "Other"}
                        </span>

                        <span className="text-muted-foreground">
                          {total}
                        </span>
                      </div>

                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(
                              percentage,
                              3
                            )}%`,

                            backgroundColor:
                              colors[
                                index %
                                  colors.length
                              ],
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </Card>

        {/* LAST 7 DAYS */}
        <Card title="QR Scans - Last 7 Days">
          <div className="p-4 space-y-4">
            {dailyScans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No scan activity recorded.
              </p>
            ) : (
              dailyScans.map(
                (entry: any) => {
                  const total =
                    Number(
                      entry.total ?? 0
                    );

                  return (
                    <div
                      key={
                        entry.date
                      }
                    >
                      <div className="flex justify-between text-xs mb-1">
                        <span>
                          {formatDate(
                            entry.date
                          )}
                        </span>

                        <span className="font-semibold">
                          {total}
                        </span>
                      </div>

                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${Math.max(
                              (total /
                                maxDailyScans) *
                                100,
                              3
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </Card>

        {/* MONTHLY REGISTRATIONS */}
        <Card title="Monthly Registrations">
          <div className="p-4 space-y-4">
            {monthlyRegistrations.length ===
            0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No registration data available.
              </p>
            ) : (
              monthlyRegistrations.map(
                (entry: any) => {
                  const total =
                    Number(
                      entry.total ?? 0
                    );

                  const month =
                    monthNames[
                      Number(
                        entry.month
                      ) - 1
                    ] ??
                    `Month ${entry.month}`;

                  return (
                    <div
                      key={
                        entry.month
                      }
                    >
                      <div className="flex justify-between text-xs mb-1">
                        <span>
                          {month}
                        </span>

                        <span className="font-semibold">
                          {total}
                        </span>
                      </div>

                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(
                              (total /
                                maxMonthly) *
                                100,
                              3
                            )}%`,

                            backgroundColor:
                              "#00aeef",
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </Card>
      </div>

      {/* RECENT REGISTRATIONS */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">
            Recent Item Registrations
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="bg-muted/50">
                {[
                  "Date",
                  "Student",
                  "Item",
                  "Type",
                  "Serial Number",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="text-left px-3 py-3 text-xs text-muted-foreground font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Loading reports...
                  </td>
                </tr>
              ) : recentRegistrations.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No registration records found.
                  </td>
                </tr>
              ) : (
                recentRegistrations.map(
                  (item: any) => (
                    <tr key={item.id}>
                      <td className="px-3 py-3 text-xs">
                        {formatDate(
                          item.created_at
                        )}
                      </td>

                      <td className="px-3 py-3 text-xs">
                        <div className="font-semibold">
                          {item.user?.name ??
                            "Unknown"}
                        </div>

                        <div className="text-muted-foreground">
                          {item.user?.username ??
                            ""}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-xs font-semibold">
                        {item.item_name}
                      </td>

                      <td className="px-3 py-3 text-xs">
                        {item.item_type}
                      </td>

                      <td className="px-3 py-3 text-xs">
                        {item.serial_number}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            String(
                              item.status
                            ).toLowerCase() ===
                            "approved"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECURITY INCIDENTS */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">
            Recent Security Incidents
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="bg-muted/50">
                {[
                  "Date",
                  "Incident",
                  "Code",
                  "Gate",
                  "Reported By",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="text-left px-3 py-3 text-xs text-muted-foreground font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {recentIncidents.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No security incidents found.
                  </td>
                </tr>
              ) : (
                recentIncidents.map(
                  (incident: any) => (
                    <tr
                      key={
                        incident.id
                      }
                    >
                      <td className="px-3 py-3 text-xs">
                        {formatDate(
                          incident.reported_at
                        )}
                      </td>

                      <td className="px-3 py-3 text-xs font-semibold">
                        {incident.incident_type}
                      </td>

                      <td className="px-3 py-3 text-xs font-mono">
                        {incident.scanned_code ||
                          "—"}
                      </td>

                      <td className="px-3 py-3 text-xs">
                        {incident.gate}
                      </td>

                      <td className="px-3 py-3 text-xs">
                        {incident.reporter?.name ??
                          "Security Personnel"}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            String(
                              incident.status
                            ).toLowerCase() ===
                            "resolved"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {incident.status}
                        </span>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
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
  const [users, setUsers] = useState<any[]>([]);

  const [summary, setSummary] = useState<any>({
    total_users: 0,
    active_users: 0,
    inactive_users: 0,
    students: 0,
    security: 0,
    pco: 0,
    system_admins: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const [updatingId, setUpdatingId] =
    useState<number | null>(null);

  const [showAddUser, setShowAddUser] =
    useState(false);

  const [creatingUser, setCreatingUser] =
    useState(false);

  const [savingEdit, setSavingEdit] =
    useState(false);

  const [editUser, setEditUser] =
    useState<any | null>(null);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    username: "",
    role: "student",
    password: "",
  });

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const data = await getUsers();

      setUsers(data.users ?? []);

      setSummary(
        data.summary ?? {
          total_users: 0,
          active_users: 0,
          inactive_users: 0,
          students: 0,
          security: 0,
          pco: 0,
          system_admins: 0,
        }
      );
    } catch (err) {
      console.error(
        "Failed to load users:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load user accounts."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function getRoleLabel(role: string) {
    switch (
      String(role ?? "").toLowerCase()
    ) {
      case "student":
        return "Student";

      case "security":
        return "Security Personnel (CSU)";

      case "pco":
        return "PCO Staff";

      case "sysadmin":
        return "System Administrator";

      default:
        return role || "Unknown";
    }
  }

  function getStatusLabel(status: string) {
    return String(
      status ?? ""
    ).toLowerCase() === "approved"
      ? "Active"
      : "Disabled";
  }

  function formatDate(dateString: string) {
    if (!dateString) {
      return "—";
    }

    const date =
      new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  }

  async function handleAddUser(
    event: any
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !newUser.name.trim() ||
      !newUser.email.trim() ||
      !newUser.username.trim() ||
      !newUser.password.trim()
    ) {
      setError(
        "Please complete all required fields."
      );

      return;
    }

    if (newUser.password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );

      return;
    }

    try {
      setCreatingUser(true);

      const data = await createUser({
        name: newUser.name.trim(),

        email: newUser.email.trim(),

        username:
          newUser.username.trim(),

        role:
          newUser.role as
            | "student"
            | "security"
            | "pco"
            | "sysadmin",

        password: newUser.password,
      });

      setSuccess(
        data.message ??
          "User account created successfully."
      );

      setNewUser({
        name: "",
        email: "",
        username: "",
        role: "student",
        password: "",
      });

      setShowAddUser(false);

      await loadUsers();
    } catch (err) {
      console.error(
        "Failed to create user:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create user account."
      );
    } finally {
      setCreatingUser(false);
    }
  }

  function handleStartEdit(user: any) {
    setError("");
    setSuccess("");
    setShowAddUser(false);

    setEditUser({
      id: user.id,
      name: user.name ?? "",
      email: user.email ?? "",
      username: user.username ?? "",
      role: user.role ?? "student",
    });
  }

  function handleCancelEdit() {
    setEditUser(null);
    setError("");
  }

  async function handleSaveEdit(
    event: any
  ) {
    event.preventDefault();

    if (!editUser) {
      return;
    }

    setError("");
    setSuccess("");

    if (
      !editUser.name.trim() ||
      !editUser.email.trim() ||
      !editUser.username.trim()
    ) {
      setError(
        "Name, email, and username are required."
      );

      return;
    }

    try {
      setSavingEdit(true);

      const data = await updateUser(
        editUser.id,
        {
          name:
            editUser.name.trim(),

          email:
            editUser.email.trim(),

          username:
            editUser.username.trim(),

          role:
            editUser.role as
              | "student"
              | "security"
              | "pco"
              | "sysadmin",
        }
      );

      setSuccess(
        data.message ??
          "User account updated successfully."
      );

      setEditUser(null);

      await loadUsers();
    } catch (err) {
      console.error(
        "Failed to update user:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update user account."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleStatus(
    user: any
  ) {
    const currentStatus =
      String(
        user.status ?? ""
      ).toLowerCase();

    const newStatus =
      currentStatus === "approved"
        ? "inactive"
        : "approved";

    const action =
      newStatus === "inactive"
        ? "disable"
        : "enable";

    const confirmed =
      window.confirm(
        `Are you sure you want to ${action} the account of ${user.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setUpdatingId(user.id);

      setError("");
      setSuccess("");

      const data =
        await updateUserStatus(
          user.id,
          newStatus
        );

      setSuccess(
        data.message ??
          "User account updated successfully."
      );

      await loadUsers();
    } catch (err) {
      console.error(
        "Failed to update user status:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update user status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredUsers =
    users.filter((user: any) => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      if (!keyword) {
        return true;
      }

      const searchableText = [
        user.name,
        user.username,
        user.email,
        getRoleLabel(user.role),
        getStatusLabel(user.status),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        keyword
      );
    });

  const totalPersonnel =
    Number(summary.security ?? 0) +
    Number(summary.pco ?? 0) +
    Number(summary.system_admins ?? 0);

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="User Accounts"
          subtitle="Manage QRpass user accounts and role-based access."
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="px-3 py-2 border border-border rounded-md text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {loading
              ? "Refreshing..."
              : "Refresh Users"}
          </button>

          <button
            onClick={() => {
              setShowAddUser(
                !showAddUser
              );

              setEditUser(null);
              setError("");
              setSuccess("");
            }}
            className="px-3 py-2 bg-primary text-white rounded-md text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
          >
            <Plus size={14} />

            {showAddUser
              ? "Close Form"
              : "Add User"}
          </button>
        </div>
      </div>

      {/* SUCCESS MESSAGE */}
      {success && (
        <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}

      {/* ERROR MESSAGE */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ADD USER FORM */}
      {showAddUser && (
        <Card title="Add New User Account">
          <form
            onSubmit={handleAddUser}
            className="p-4 space-y-4"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Full Name *
                </label>

                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser(
                      (current) => ({
                        ...current,
                        name:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="e.g. Juan Dela Cruz"
                  required
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Email Address *
                </label>

                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser(
                      (current) => ({
                        ...current,
                        email:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="e.g. student@uc.edu.ph"
                  required
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Username / ID *
                </label>

                <input
                  type="text"
                  value={
                    newUser.username
                  }
                  onChange={(e) =>
                    setNewUser(
                      (current) => ({
                        ...current,
                        username:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="e.g. 26-1234"
                  required
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Role *
                </label>

                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser(
                      (current) => ({
                        ...current,
                        role:
                          e.target.value,
                      })
                    )
                  }
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="student">
                    Student
                  </option>

                  <option value="security">
                    Security Personnel
                    (CSU)
                  </option>

                  <option value="pco">
                    PCO Staff
                  </option>

                  <option value="sysadmin">
                    System Administrator
                  </option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1">
                  Temporary Password *
                </label>

                <input
                  type="password"
                  value={
                    newUser.password
                  }
                  onChange={(e) =>
                    setNewUser(
                      (current) => ({
                        ...current,
                        password:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />

                <p className="text-[11px] text-muted-foreground mt-1">
                  The user can use this
                  password when logging
                  into QRpass.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddUser(
                    false
                  );

                  setNewUser({
                    name: "",
                    email: "",
                    username: "",
                    role: "student",
                    password: "",
                  });

                  setError("");
                }}
                disabled={
                  creatingUser
                }
                className="px-4 py-2 border border-border rounded-md text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  creatingUser
                }
                className="px-4 py-2 bg-primary text-white rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {creatingUser
                  ? "Creating..."
                  : "Create User Account"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* EDIT USER FORM */}
      {editUser && (
        <Card title="Edit User Account">
          <form
            onSubmit={handleSaveEdit}
            className="p-4 space-y-4"
          >
            <div className="grid md:grid-cols-2 gap-4">
              {/* EDIT NAME */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Full Name *
                </label>

                <input
                  type="text"
                  value={editUser.name}
                  onChange={(e) =>
                    setEditUser({
                      ...editUser,
                      name:
                        e.target.value,
                    })
                  }
                  required
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* EDIT EMAIL */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Email Address *
                </label>

                <input
                  type="email"
                  value={editUser.email}
                  onChange={(e) =>
                    setEditUser({
                      ...editUser,
                      email:
                        e.target.value,
                    })
                  }
                  required
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* EDIT USERNAME */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Username / ID *
                </label>

                <input
                  type="text"
                  value={
                    editUser.username
                  }
                  onChange={(e) =>
                    setEditUser({
                      ...editUser,
                      username:
                        e.target.value,
                    })
                  }
                  required
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* EDIT ROLE */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Role *
                </label>

                <select
                  value={editUser.role}
                  onChange={(e) =>
                    setEditUser({
                      ...editUser,
                      role:
                        e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="student">
                    Student
                  </option>

                  <option value="security">
                    Security Personnel
                    (CSU)
                  </option>

                  <option value="pco">
                    PCO Staff
                  </option>

                  <option value="sysadmin">
                    System Administrator
                  </option>
                </select>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-700">
              Changing the role changes
              which QRpass modules this
              account is allowed to use.
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={
                  handleCancelEdit
                }
                disabled={savingEdit}
                className="px-4 py-2 border border-border rounded-md text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 bg-primary text-white rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {savingEdit
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Total Users"
          value={String(
            summary.total_users ?? 0
          )}
          icon={<Users size={20} />}
          color="#003087"
        />

        <StatCard
          label="Students"
          value={String(
            summary.students ?? 0
          )}
          icon={<Users size={20} />}
          color="#00aeef"
        />

        <StatCard
          label="Staff / Personnel"
          value={String(
            totalPersonnel
          )}
          icon={<Users size={20} />}
          color="#8b5cf6"
        />

        <StatCard
          label="Active Accounts"
          value={String(
            summary.active_users ?? 0
          )}
          icon={
            <CheckCircle size={20} />
          }
          color="#2ecc71"
        />

        <StatCard
          label="Disabled"
          value={String(
            summary.inactive_users ?? 0
          )}
          icon={<X size={20} />}
          color="#e8543a"
        />

        <StatCard
          label="System Admins"
          value={String(
            summary.system_admins ?? 0
          )}
          icon={<Shield size={20} />}
          color="#f5c200"
        />
      </div>

      {/* ROLE BREAKDOWN */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">
            Students
          </p>

          <p className="text-xl font-bold mt-1">
            {summary.students ?? 0}
          </p>
        </div>

        <div className="bg-white border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">
            Security Personnel
          </p>

          <p className="text-xl font-bold mt-1">
            {summary.security ?? 0}
          </p>
        </div>

        <div className="bg-white border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">
            PCO Staff
          </p>

          <p className="text-xl font-bold mt-1">
            {summary.pco ?? 0}
          </p>
        </div>

        <div className="bg-white border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">
            System Administrators
          </p>

          <p className="text-xl font-bold mt-1">
            {summary.system_admins ??
              0}
          </p>
        </div>
      </div>

      {/* USER LIST */}
      <Card
        title="User List"
        action={
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search users..."
              className="pl-7 pr-3 py-1.5 text-xs border border-border rounded-md bg-muted/50 w-48 md:w-64 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-muted/50">
                {[
                  "Name",
                  "Username / ID",
                  "Email",
                  "Role",
                  "Created",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="text-left py-3 px-3 text-xs text-muted-foreground font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    Loading user
                    accounts...
                  </td>
                </tr>
              ) : filteredUsers.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No user accounts
                    found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(
                  (user: any) => {
                    const isActive =
                      String(
                        user.status ??
                          ""
                      ).toLowerCase() ===
                      "approved";

                    const isUpdating =
                      updatingId ===
                      user.id;

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {/* NAME */}
                        <td className="py-3 px-3">
                          <div className="text-sm font-semibold">
                            {user.name ??
                              "Unknown User"}
                          </div>

                          <div className="text-[11px] text-muted-foreground">
                            User ID:{" "}
                            {user.id}
                          </div>
                        </td>

                        {/* USERNAME */}
                        <td className="py-3 px-3 text-xs font-mono text-muted-foreground">
                          {user.username ??
                            "—"}
                        </td>

                        {/* EMAIL */}
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {user.email ??
                            "—"}
                        </td>

                        {/* ROLE */}
                        <td className="py-3 px-3">
                          <span className="inline-flex px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-[11px] font-semibold">
                            {getRoleLabel(
                              user.role
                            )}
                          </span>
                        </td>

                        {/* CREATED */}
                        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(
                            user.created_at
                          )}
                        </td>

                        {/* STATUS */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {isActive
                              ? "Active"
                              : "Disabled"}
                          </span>
                        </td>

                        {/* ACTIONS */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleStartEdit(
                                  user
                                )
                              }
                              className="text-xs text-primary font-semibold hover:underline"
                            >
                              Edit
                            </button>

                            <span className="text-muted-foreground">
                              |
                            </span>

                            <button
                              onClick={() =>
                                handleToggleStatus(
                                  user
                                )
                              }
                              disabled={
                                isUpdating
                              }
                              className={`text-xs font-semibold hover:underline disabled:opacity-50 ${
                                isActive
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {isUpdating
                                ? "Updating..."
                                : isActive
                                ? "Disable"
                                : "Enable"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        {!loading &&
          users.length > 0 && (
            <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                {filteredUsers.length}{" "}
                of {users.length} user
                accounts
              </p>

              <p className="text-[11px] text-muted-foreground">
                Data loaded from QRpass
                MySQL database
              </p>
            </div>
          )}
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
  pco: [PCOPermitRequests, PCOItemRegistry, PCOReports, PCONotifications],
  sysadmin: [AdminDashboard,AdminRecords,AdminAnalytics,SysAdminUserAccounts,SysAdminSettings,SysAdminAuditLogs,SysAdminPerformance,SysAdminSecurityConfig,],
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
  pco: [
    { icon: <FileText size={16} />, label: "Registration Requests", badge: 8 },
    { icon: <Layers size={16} />, label: "Item Registry" },
    { icon: <BarChart2 size={16} />, label: "Reports" },
    { icon: <Bell size={16} />, label: "Notifications", badge: 2 },
  ],
  sysadmin: [
    {
      icon: <BarChart2 size={16} />,
      label: "Overview Dashboard",
    },
    {
      icon: <Layers size={16} />,
      label: "System Records",
    },
    {
      icon: <FileText size={16} />,
      label: "Reports & Analytics",
    },
    {
      icon: <Users size={16} />,
      label: "User Accounts",
    },
    {
      icon: <Settings size={16} />,
      label: "System Settings",
    },
    {
      icon: <FileText size={16} />,
      label: "Audit Logs",
    },
    {
      icon: <BarChart2 size={16} />,
      label: "Performance",
    },
    {
      icon: <Shield size={16} />,
      label: "Security Config",
    },
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
  pco: [
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
  if (mode === "register") {// ── Register view ─────────────────────────────────────────────────────────
if (mode === "register") {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        fontFamily: "Inter, sans-serif",
        background: "#f4f6fa",
      }}
    >
      {TopBar}
      {NavBar}

      <div className="flex-1 flex flex-col items-center px-4 py-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <QRpassLogo size={72} showText />
        </div>

        <div className="w-full max-w-2xl bg-white rounded-xl border border-border shadow-md overflow-hidden">
          {/* Header */}
          <div className="bg-primary px-6 py-4">
            <h2
              className="text-white font-bold text-base"
              style={{ fontFamily: "Barlow, sans-serif" }}
            >
              Create an Account
            </h2>

            <p className="text-white/70 text-xs mt-0.5">
              Fill in your details to register for QRpass access.
            </p>
          </div>

          {!regSubmitted ? (
            <div className="p-6">
              {/* Step 1 */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">
                  Step 1 — Select your role
                </p>

                <RoleSelector
                  selected={regRole}
                  onSelect={(r) => {
                    setRegRole(r);
                    setRegFields({});
                  }}
                  excludeRoles={["sysadmin"]}
                />
              </div>

              {/* Step 2 */}
              {regRole && (
                <form onSubmit={handleRegister}>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">
                    Step 2 —{" "}
                    {ROLES.find((r) => r.id === regRole)?.label} Information
                  </p>

                  <div className="grid md:grid-cols-2 gap-4">
                    {fields.map((f) => (
                      <div key={f.label}>
                        <label className="block text-xs font-semibold text-foreground mb-1">
                          {f.label}
                        </label>

                        {f.type === "select" ? (
                          <select
                            value={regFields[f.label] ?? ""}
                            onChange={(e) =>
                              setRegFields((prev) => ({
                                ...prev,
                                [f.label]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            <option value="">Select…</option>

                            {f.options?.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.type}
                            placeholder={f.placeholder}
                            value={regFields[f.label] ?? ""}
                            onChange={(e) =>
                              setRegFields((prev) => ({
                                ...prev,
                                [f.label]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800">
                    <strong>Note:</strong> Your account will be reviewed and
                    activated by the System Administrator before you can log in.
                  </div>

                  <div className="flex gap-3 mt-5 justify-end">
                    {/* BACK BUTTON */}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="text-xs px-4 py-2 border border-border rounded-md text-muted-foreground hover:bg-muted transition-colors"
                    >
                      ← Back to Login
                    </button>

                    <button
                      type="submit"
                      className="text-xs bg-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90 transition-opacity"
                    >
                      Submit Registration
                    </button>
                  </div>
                </form>
              )}

              {/* No role selected yet */}
              {!regRole && (
                <div className="pt-2">
                  <div className="text-center text-xs text-muted-foreground py-4">
                    Select a role above to continue with registration.
                  </div>

                  {/* BACK BUTTON IS ALSO VISIBLE BEFORE SELECTING A ROLE */}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="w-full py-2.5 border border-border rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    ← Back to Login
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Success state */
            <div className="p-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle
                  size={32}
                  className="text-green-500"
                />
              </div>

              <div className="text-center">
                <h3
                  className="font-bold text-foreground text-base"
                  style={{ fontFamily: "Barlow, sans-serif" }}
                >
                  Registration Submitted!
                </h3>

                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Your account request has been submitted. The System
                  Administrator will review and activate your account. You will
                  be notified via email.
                </p>
              </div>

              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-xs bg-primary text-white px-5 py-2 rounded-md font-semibold hover:opacity-90"
              >
                ← Back to Login
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          &copy; Copyright 2026 – University of Cebu Main Campus
        </p>
      </div>

      <div className="flex h-2">
        <div
          className="flex-1"
          style={{ backgroundColor: "#003087" }}
        />

        <div
          className="flex-1"
          style={{ backgroundColor: "#f5c200" }}
        />

        <div
          className="flex-1"
          style={{ backgroundColor: "#00aeef" }}
        />

        <div
          className="flex-1"
          style={{ backgroundColor: "#f4f6fa" }}
        />
      </div>
    </div>
  );
}
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
  const [view, setView] =
    useState<View>("login");

  const [role, setRole] =
    useState<Role>("student");

  /*
  |--------------------------------------------------------------------------
  | LOGIN
  |--------------------------------------------------------------------------
  */

  function handleLogin(r: Role) {
    setRole(r);
    setView("dashboard");
  }

  /*
  |--------------------------------------------------------------------------
  | REAL LOGOUT
  |--------------------------------------------------------------------------
  |
  | 1. Ask Laravel to revoke the current Sanctum token.
  | 2. Clear the token from the browser.
  | 3. Return the user to the login page.
  |
  */

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.error(
        "Server logout failed:",
        error
      );
    } finally {
      /*
      |--------------------------------------------------------------------------
      | Clear Local Session
      |--------------------------------------------------------------------------
      */

      localStorage.removeItem(
        "token"
      );

      localStorage.removeItem(
        "user"
      );

      localStorage.removeItem(
        "role"
      );

      /*
      |--------------------------------------------------------------------------
      | Reset QRPass UI
      |--------------------------------------------------------------------------
      */

      setRole("student");

      setView("login");
    }
  }

  /*
  |--------------------------------------------------------------------------
  | PAGE RENDERING
  |--------------------------------------------------------------------------
  */

  if (view === "dashboard") {
    return (
      <Dashboard
        role={role}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <LoginPage
      onLogin={handleLogin}
    />
  );
}
