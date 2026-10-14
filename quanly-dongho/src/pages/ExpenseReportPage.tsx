/**
 * ExpenseReportPage.tsx
 * Báo cáo tiền chi (Quản lý quỹ)
 * Workflow: 4 thẻ thống kê + biểu đồ + sidebar tổng quan chi → Bảng chi tiết phiếu chi
 *           → Bộ lọc nâng cao (Năm/Danh mục/Từ ngày-Đến ngày) → Tabs góc nhìn khác nhau
 *           → Xuất báo cáo (Excel/PDF) cho Ban tài chính.
 */

import React, { useMemo, useState, useEffect } from "react";
import {
  TrendingDown, Package, Flame, ArrowDownCircle, Filter, ChevronDown,
  FileSpreadsheet, Printer, X, Eye, CalendarDays, Plus, CheckCircle,
  AlertCircle, Banknote, CreditCard,
} from "lucide-react";
import {
  FundTransaction, FundCategory, TransactionType,
  UserAccount, UserRole,
} from "../types";

interface ExpenseReportPageProps {
  transactions: FundTransaction[];
  currentAccount: UserAccount;
  onAddTransaction?: (tx: Omit<FundTransaction, "id">) => void | Promise<void>;
}

type ReportTab = "overview" | "detail" | "by_category";

// ── Danh mục chi (EXPENSE) ────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  FundCategory.EVENT_ORGANIZATION,
  FundCategory.TEMPLE_REPAIR,
  FundCategory.CHARITY_STUDY,
  FundCategory.OTHER,
];

const CATEGORY_LABEL: Record<string, string> = {
  [FundCategory.ANNUAL_FEE]: "Niên liễm định mức",
  [FundCategory.VOLUNTARY]: "Tự nguyện / Phát tâm",
  [FundCategory.SPONSORSHIP]: "Tài trợ lớn",
  [FundCategory.EVENT_ORGANIZATION]: "Chi tổ chức sự kiện / Cúng lễ",
  [FundCategory.TEMPLE_REPAIR]: "Chi xây dựng / Sửa sang từ đường",
  [FundCategory.CHARITY_STUDY]: "Chi khuyến học / Mừng thọ / Hiếu hỷ",
  [FundCategory.OTHER]: "Chi khác",
};

const CATEGORY_COLOR: Record<string, string> = {
  [FundCategory.EVENT_ORGANIZATION]: "#f59e0b",
  [FundCategory.TEMPLE_REPAIR]: "#a855f7",
  [FundCategory.CHARITY_STUDY]: "#0ea5e9",
  [FundCategory.OTHER]: "#94a3b8",
  [FundCategory.ANNUAL_FEE]: "#e11d48",
  [FundCategory.VOLUNTARY]: "#10b981",
  [FundCategory.SPONSORSHIP]: "#6366f1",
};

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

// Tách metadata từ description (tương tự IncomeReportPage)
const parseTxMeta = (t: FundTransaction) => {
  const raw = t.description || "";
  const codeMatch = raw.match(/\[([A-Z0-9_]+)\]/);
  const txCode = codeMatch ? codeMatch[1] : t.id;
  const stripped = raw.replace(/^\[.*?\]\s*/, "");
  const parts = stripped.split(" — ").map((s) => s.trim()).filter(Boolean);
  const purpose = parts[0] || CATEGORY_LABEL[t.category] || "—";
  let method = "—";
  let note = "";
  if (parts[1] === "Tiền mặt" || parts[1] === "Chuyển khoản") {
    method = parts[1];
    note = parts.slice(2).join(" — ");
  } else {
    note = parts.slice(1).join(" — ");
  }
  return { txCode, purpose, method, note };
};

// ── Mini horizontal bar chart ────────────────────────────────────────────────
function MiniBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-44 truncate text-slate-600 shrink-0">{d.label}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
            />
          </div>
          <span className="w-24 text-right font-mono font-bold text-slate-700 text-[10px]">
            {formatVND(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

type PayMethod = "CASH" | "TRANSFER";

const genExpenseTxCode = () => {
  const yy = String(new Date().getFullYear()).slice(2);
  const num = String(Math.floor(Math.random() * 900) + 100);
  return `CHI${yy}_${num}`;
};

// ─── Modal "Thêm khoản chi" — cho phép Thủ quỹ ghi nhận nhanh một phiếu chi
//    ngay tại trang báo cáo, đồng bộ vào chung tbl_transactions nên mọi nơi
//    tổng hợp (báo cáo, trang chủ quản lý quỹ) đều tự động cập nhật. ──────────
interface AddExpenseModalProps {
  onSave: (data: {
    category: FundCategory; amount: number; date: string;
    payerName: string; purpose: string; method: PayMethod; note: string;
  }) => Promise<void>;
  onClose: () => void;
}

function AddExpenseModal({ onSave, onClose }: AddExpenseModalProps) {
  const TODAY = new Date().toISOString().split("T")[0];
  const [category, setCategory] = useState<FundCategory>(FundCategory.EVENT_ORGANIZATION);
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(TODAY);
  const [payerName, setPayerName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!payerName.trim()) { setError("Vui lòng nhập tên người chi / nhận."); return; }
    if (!amount || Number(amount) <= 0) { setError("Số tiền phải lớn hơn 0 VNĐ."); return; }
    if (!purpose.trim()) { setError("Vui lòng nhập lý do chi."); return; }
    if (!date) { setError("Vui lòng chọn ngày chi."); return; }
    if (note.length > 200) { setError("Ghi chú không được vượt quá 200 ký tự."); return; }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        category, amount: Number(amount), date,
        payerName: payerName.trim(), purpose: purpose.trim(),
        method, note: note.trim(),
      });
    } catch (e: any) {
      setError(e?.message ?? "Có lỗi xảy ra, vui lòng thử lại.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-orange-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-orange-100 rounded-lg"><Plus className="w-4 h-4 text-orange-600" /></div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Thêm danh mục chi</h3>
              <p className="text-[10px] text-slate-400">Ghi nhận phiếu chi xuất quỹ dòng họ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4 text-xs font-sans">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
            </div>
          )}

          {/* Danh mục chi */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Danh mục chi</label>
            <div className="grid grid-cols-2 gap-2">
              {EXPENSE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-xl border-2 text-[10px] font-bold text-left transition-all cursor-pointer ${
                    category === cat
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {CATEGORY_LABEL[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Số tiền */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Số tiền (VNĐ) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number" min={1} step={10000}
                value={amount}
                onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Nhập số tiền..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">VNĐ</span>
            </div>
            {amount !== "" && Number(amount) > 0 && (
              <p className="text-[10px] text-orange-600 mt-1 font-medium">≈ {formatVND(Number(amount))}</p>
            )}
          </div>

          {/* Người chi / nhận */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Người chi / Đơn vị nhận <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={payerName}
              onChange={e => setPayerName(e.target.value)}
              placeholder="VD: Ban tổ chức sự kiện, nhà thầu sửa từ đường..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Lý do chi */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Lý do chi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="VD: Mua sắm vật phẩm cúng giỗ, sửa chữa từ đường..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Hình thức chi */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Hình thức chi</label>
            <div className="grid grid-cols-2 gap-2">
              {(["CASH", "TRANSFER"] as PayMethod[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                    method === m
                      ? m === "CASH"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  {m === "CASH" ? <><Banknote className="w-4 h-4" />Tiền mặt</> : <><CreditCard className="w-4 h-4" />Chuyển khoản</>}
                </button>
              ))}
            </div>
          </div>

          {/* Ngày chi */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Ngày chi <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="date" value={date} max={TODAY}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Ghi chú / chứng từ */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="font-medium text-slate-600">Ghi chú / Chứng từ (tùy chọn)</label>
              <span className={`text-[10px] ${note.length > 180 ? "text-red-500" : "text-slate-400"}`}>
                {note.length}/200
              </span>
            </div>
            <textarea
              rows={2} maxLength={200}
              placeholder="Ghi chú thêm nếu có..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl sticky bottom-0">
          <button onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 cursor-pointer">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
            {saving
              ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CheckCircle className="w-3.5 h-3.5" />}
            Lưu khoản chi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExpenseReportPage({ transactions, currentAccount, onAddTransaction }: ExpenseReportPageProps) {
  const isFinanceBoard =
    currentAccount.role === UserRole.TREASURER || currentAccount.role === UserRole.LEADER;
  const isTreasurer = currentAccount.role === UserRole.TREASURER;

  const expenseTxs = useMemo(
    () => transactions.filter((t) => t.type === TransactionType.EXPENSE),
    [transactions]
  );

  // ── Thêm khoản chi trực tiếp từ trang báo cáo ────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSaveExpense = async (data: {
    category: FundCategory; amount: number; date: string;
    payerName: string; purpose: string; method: PayMethod; note: string;
  }) => {
    if (!onAddTransaction) return;
    const methodLabel = data.method === "CASH" ? "Tiền mặt" : "Chuyển khoản";
    const desc = `[${genExpenseTxCode()}] ${data.purpose} — ${methodLabel}${data.note ? ` — ${data.note}` : ""}`;

    await onAddTransaction({
      type: TransactionType.EXPENSE,
      category: data.category,
      amount: data.amount,
      date: data.date,
      payerOrReceiver: data.payerName,
      description: desc,
      recordedBy: currentAccount.fullName,
      createdAt: new Date().toISOString().split("T")[0],
    });

    setShowAddModal(false);
    setToast("Ghi nhận khoản chi thành công! Đã cập nhật báo cáo và tổng hợp quỹ.");
  };

  // ── Bộ lọc nâng cao (Step 6) ─────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    expenseTxs.forEach((t) => set.add(new Date(t.date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [expenseTxs]);

  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterCategory, setFilterCategory] = useState<FundCategory | "ALL">("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("overview");
  const [detailTx, setDetailTx] = useState<FundTransaction | null>(null);

  // ── Step 7: Lọc lại tức thời mỗi khi bộ lọc thay đổi ────────────────────
  const filteredExpenseTxs = useMemo(() => {
    return expenseTxs
      .filter((t) => {
        const matchYear = new Date(t.date).getFullYear() === filterYear;
        const matchCat = filterCategory === "ALL" || t.category === filterCategory;
        const matchFrom = !fromDate || t.date >= fromDate;
        const matchTo = !toDate || t.date <= toDate;
        return matchYear && matchCat && matchFrom && matchTo;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenseTxs, filterYear, filterCategory, fromDate, toDate]);

  // ── Step 3: 4 thẻ thống kê nhanh ─────────────────────────────────────────
  const quickStats = useMemo(() => {
    if (filteredExpenseTxs.length === 0) {
      return { total: 0, txCount: 0, topCategory: "—", largest: 0 };
    }
    const total = filteredExpenseTxs.reduce((s, t) => s + t.amount, 0);
    const txCount = filteredExpenseTxs.length;

    // Hạng mục chi nhiều nhất
    const catMap: Record<string, number> = {};
    filteredExpenseTxs.forEach((t) => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });
    const topCatKey = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const topCategory = CATEGORY_LABEL[topCatKey] || topCatKey;

    // Khoản chi lớn nhất
    const largest = Math.max(...filteredExpenseTxs.map((t) => t.amount));

    return { total, txCount, topCategory, largest };
  }, [filteredExpenseTxs]);

  // ── Step 4 / SubFlow S-1: Biểu đồ chi theo tháng ─────────────────────────
  const monthlyChart = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({ month: `T${i + 1}`, value: 0 }));
    filteredExpenseTxs.forEach((t) => {
      const m = new Date(t.date).getMonth();
      if (m >= 0 && m < 12) months[m].value += t.amount;
    });
    return months;
  }, [filteredExpenseTxs]);

  // ── Phân bổ theo danh mục chi ─────────────────────────────────────────────
  const byCategoryBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredExpenseTxs.forEach((t) => {
      if (!map[t.category]) map[t.category] = { total: 0, count: 0 };
      map[t.category].total += t.amount;
      map[t.category].count += 1;
    });
    const grand = Object.values(map).reduce((s, v) => s + v.total, 0);
    return EXPENSE_CATEGORIES.filter((cat) => map[cat])
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABEL[cat],
        color: CATEGORY_COLOR[cat],
        total: map[cat].total,
        count: map[cat].count,
        percent: grand > 0 ? Math.round((map[cat].total / grand) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenseTxs]);

  // ── Sidebar: tổng quan chi theo từng danh mục ─────────────────────────────
  const sidebarBreakdown = useMemo(() => {
    return byCategoryBreakdown.map((b) => ({
      label: b.label,
      color: b.color,
      total: b.total,
      percent: b.percent,
    }));
  }, [byCategoryBreakdown]);

  // ── Step 8: Xuất Excel (CSV) ──────────────────────────────────────────────
  const handleExportExcel = () => {
    const header = [
      "Mã phiếu chi", "Ngày chi", "Danh mục chi", "Lý do chi",
      "Số tiền (VNĐ)", "Người chi", "Hình thức", "Ghi chú", "Người ghi sổ",
    ];
    const rows = filteredExpenseTxs.map((t) => {
      const meta = parseTxMeta(t);
      return [
        meta.txCode, t.date, CATEGORY_LABEL[t.category] || t.category,
        meta.purpose, String(t.amount), t.payerOrReceiver,
        meta.method, meta.note, t.recordedBy || "",
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-tien-chi-${filterYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    setActiveReportTab("detail");
    window.setTimeout(() => window.print(), 80);
  };

  const tabBtnClass = (tab: ReportTab) =>
    `flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
      activeReportTab === tab
        ? "bg-white text-orange-700 shadow-sm"
        : "text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header + bộ lọc nâng cao (Step 6) ── */}
      <div className="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Báo cáo tiền chi</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tổng hợp toàn bộ phiếu chi của quỹ dòng họ.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isTreasurer && onAddTransaction && (
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Thêm danh mục chi
              </button>
            )}
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            {/* Năm báo cáo */}
            <div className="relative">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-7 appearance-none focus:outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            {/* Danh mục chi */}
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as FundCategory | "ALL")}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-7 appearance-none focus:outline-none cursor-pointer"
              >
                <option value="ALL">Mọi danh mục chi</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABEL[cat]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            {/* Khoảng ngày */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="text-xs bg-transparent focus:outline-none w-[110px]"
              />
              <span className="text-slate-300">—</span>
              <input
                type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="text-xs bg-transparent focus:outline-none w-[110px]"
              />
            </div>
            {(fromDate || toDate || filterCategory !== "ALL") && (
              <button
                onClick={() => { setFromDate(""); setToDate(""); setFilterCategory("ALL"); }}
                className="text-[10px] text-orange-600 font-bold hover:underline cursor-pointer"
              >
                Xóa lọc
              </button>
            )}
            {/* Xuất báo cáo — chỉ Ban tài chính (Step 8) */}
            {isFinanceBoard && (
              <div className="flex gap-1 ml-1">
                <button
                  onClick={handleExportExcel}
                  title="Xuất báo cáo Excel"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  title="Xuất báo cáo PDF"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Step 3: 4 thẻ thống kê nhanh ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Tổng tiền đã chi */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-orange-400 font-bold uppercase">
                Tổng tiền đã chi
              </p>
              <h2 className="text-xl font-bold mt-1 text-orange-400">{formatVND(quickStats.total)}</h2>
            </div>
            <span className="p-2.5 bg-slate-800 rounded-xl text-orange-400 border border-slate-700">
              <TrendingDown className="w-5 h-5" />
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-4">
            Năm {filterYear}{filterCategory !== "ALL" ? ` — ${CATEGORY_LABEL[filterCategory]}` : ""}
          </p>
        </div>
        {/* Số giao dịch chi */}
        <div className="bg-white border rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-orange-600 font-semibold uppercase">
                Số giao dịch chi
              </p>
              <h2 className="text-xl font-bold mt-1 text-slate-900">{quickStats.txCount}</h2>
            </div>
            <span className="p-2.5 bg-orange-50 rounded-xl text-orange-700">
              <ArrowDownCircle className="w-5 h-5" />
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-4">Số phiếu chi đã ghi nhận.</p>
        </div>
        {/* Hạng mục chi nhiều nhất */}
        <div className="bg-white border rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-purple-600 font-semibold uppercase">
                Hạng mục chi nhiều nhất
              </p>
              <h2 className="text-sm font-bold mt-1 text-slate-900 leading-tight">
                {quickStats.topCategory}
              </h2>
            </div>
            <span className="p-2.5 bg-purple-50 rounded-xl text-purple-700">
              <Flame className="w-5 h-5" />
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-4">Danh mục có tổng chi cao nhất.</p>
        </div>
        {/* Khoản chi lớn nhất */}
        <div className="bg-white border rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-sky-600 font-semibold uppercase">
                Khoản chi lớn nhất
              </p>
              <h2 className="text-xl font-bold mt-1 text-slate-900">
                {quickStats.largest > 0 ? formatVND(quickStats.largest) : "—"}
              </h2>
            </div>
            <span className="p-2.5 bg-sky-50 rounded-xl text-sky-700">
              <Package className="w-5 h-5" />
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-4">Giá trị phiếu chi đơn lẻ cao nhất.</p>
        </div>
      </div>

      {/* ── Step 4: Biểu đồ + Sidebar ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Khu vực chính: Tabs + biểu đồ/bảng */}
        <div className="xl:col-span-2 flex flex-col gap-5">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit print:hidden">
            <button onClick={() => setActiveReportTab("overview")} className={tabBtnClass("overview")}>
              Tổng quan
            </button>
            <button onClick={() => setActiveReportTab("detail")} className={tabBtnClass("detail")}>
              Chi tiết phiếu chi
            </button>
            <button onClick={() => setActiveReportTab("by_category")} className={tabBtnClass("by_category")}>
              Theo danh mục
            </button>
          </div>

          {/* ── Tab Tổng quan: biểu đồ cột tháng + phân bổ danh mục ── */}
          {activeReportTab === "overview" && (
            <>
              {/* Biểu đồ chi theo tháng (SubFlow S-1) */}
              <div className="bg-white border border-orange-100 rounded-2xl p-6 shadow-xs">
                <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-4">
                  Chi theo tháng — Năm {filterYear} (đơn vị: VNĐ)
                </h3>
                <div className="w-full overflow-x-auto">
                  <svg viewBox="0 0 600 190" className="w-full min-w-[560px] h-[190px]">
                    {(() => {
                      const max = Math.max(...monthlyChart.map((m) => m.value), 1);
                      const barW = 38, gap = 9, baseY = 160;
                      return monthlyChart.map((m, i) => {
                        const h = (m.value / max) * 120;
                        const x = 16 + i * (barW + gap);
                        return (
                          <g key={m.month}>
                            <rect
                              x={x} y={baseY - h} width={barW} height={h} rx="4"
                              fill="#f97316" opacity={m.value > 0 ? 0.82 : 0.1}
                            />
                            <text
                              x={x + barW / 2} y={baseY + 16}
                              textAnchor="middle"
                              className="text-[9px] font-bold fill-slate-500"
                            >
                              {m.month}
                            </text>
                            {m.value > 0 && (
                              <text
                                x={x + barW / 2} y={baseY - h - 6}
                                textAnchor="middle"
                                className="text-[8px] font-bold fill-orange-700"
                              >
                                {(m.value / 1000000).toFixed(1)}Tr
                              </text>
                            )}
                          </g>
                        );
                      });
                    })()}
                    <line x1="10" y1="160" x2="590" y2="160" stroke="#e2e8f0" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>

              {/* Cơ cấu theo danh mục */}
              <div className="bg-white border border-orange-100 rounded-2xl p-6 shadow-xs">
                <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-4">
                  Phân bổ theo danh mục chi
                </h3>
                {byCategoryBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Chưa có dữ liệu phù hợp với bộ lọc hiện tại.
                  </p>
                ) : (
                  <MiniBarChart
                    data={byCategoryBreakdown.map((b) => ({
                      label: b.label,
                      value: b.total,
                      color: b.color,
                    }))}
                  />
                )}
              </div>
            </>
          )}

          {/* ── Tab: Chi tiết phiếu chi (Step 5) ── */}
          {activeReportTab === "detail" && (
            <div className="bg-white border border-orange-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-orange-50 flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                  Danh sách phiếu chi
                </span>
                <span className="text-[11px] text-slate-400">{filteredExpenseTxs.length} phiếu chi</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="px-3 py-3 text-left">Mã phiếu chi</th>
                      <th className="px-3 py-3 text-left">Ngày chi</th>
                      <th className="px-3 py-3 text-left">Danh mục chi</th>
                      <th className="px-3 py-3 text-left">Lý do chi</th>
                      <th className="px-3 py-3 text-right">Số tiền (VNĐ)</th>
                      <th className="px-3 py-3 text-left">Người chi</th>
                      <th className="px-3 py-3 text-left">Chứng từ</th>
                      <th className="px-3 py-3 text-center print:hidden">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredExpenseTxs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400 italic">
                          Không có phiếu chi nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenseTxs.map((t) => {
                        const meta = parseTxMeta(t);
                        return (
                          <tr key={t.id} className="hover:bg-orange-50/20">
                            <td className="px-3 py-3 font-mono text-[10px] font-bold text-orange-600">
                              {meta.txCode}
                            </td>
                            <td className="px-3 py-3 text-slate-600 font-mono">{t.date}</td>
                            <td className="px-3 py-3">
                              <span
                                className="inline-block text-[9px] px-2 py-0.5 rounded-full font-bold text-white"
                                style={{ backgroundColor: CATEGORY_COLOR[t.category] }}
                              >
                                {CATEGORY_LABEL[t.category] || t.category}
                              </span>
                            </td>
                            <td
                              className="px-3 py-3 text-slate-600 max-w-[160px] truncate"
                              title={meta.purpose}
                            >
                              {meta.purpose}
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-bold text-orange-700">
                              -{formatVND(t.amount)}
                            </td>
                            <td className="px-3 py-3 font-semibold text-slate-800">
                              {t.payerOrReceiver}
                            </td>
                            {/* Chứng từ: hiển thị ảnh thu nhỏ nếu có URL trong note, else placeholder */}
                            <td className="px-3 py-3">
                              {meta.note && meta.note.startsWith("http") ? (
                                <img
                                  src={meta.note}
                                  alt="chứng từ"
                                  className="w-8 h-8 object-cover rounded border border-slate-200 cursor-pointer"
                                  onClick={() => window.open(meta.note, "_blank")}
                                />
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  {meta.note ? meta.note.slice(0, 20) + (meta.note.length > 20 ? "…" : "") : "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center print:hidden">
                              <button
                                onClick={() => setDetailTx(t)}
                                className="p-1.5 hover:bg-orange-50 rounded-lg text-orange-600 cursor-pointer"
                                title="Xem chi tiết"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab: Theo danh mục ── */}
          {activeReportTab === "by_category" && (
            <div className="bg-white border border-orange-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-orange-50">
                <span className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                  Tổng hợp theo danh mục chi
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="px-4 py-3 text-left">Danh mục chi</th>
                      <th className="px-4 py-3 text-center">Số phiếu</th>
                      <th className="px-4 py-3 text-right">Tổng tiền</th>
                      <th className="px-4 py-3 text-right">% tổng chi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {byCategoryBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-slate-400 italic">
                          Không có dữ liệu phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      byCategoryBreakdown.map((b) => (
                        <tr key={b.category} className="hover:bg-orange-50/20">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                              {b.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">{b.count}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-orange-700">
                            {formatVND(b.total)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">{b.percent}%</td>
                        </tr>
                      ))
                    )}
                    {byCategoryBreakdown.length > 0 && (
                      <tr className="bg-slate-50 font-bold border-t border-slate-200">
                        <td className="px-4 py-3 text-slate-700">Tổng cộng</td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {byCategoryBreakdown.reduce((s, b) => s + b.count, 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-orange-800">
                          {formatVND(byCategoryBreakdown.reduce((s, b) => s + b.total, 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">100%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Step 4: Sidebar "Tổng quan chi" + "Phân bổ chi tiêu" ── */}
        <div className="flex flex-col gap-4 print:hidden">
          {/* Tổng quan chi */}
          <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-4">
              Tổng quan chi — {filterYear}
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tổng tiền đã chi</span>
                <span className="font-mono font-bold text-orange-600">{formatVND(quickStats.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Số phiếu chi</span>
                <span className="font-mono font-bold text-slate-900">{quickStats.txCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Khoản chi lớn nhất</span>
                <span className="font-mono font-bold text-slate-900">
                  {quickStats.largest > 0 ? formatVND(quickStats.largest) : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                <span className="font-bold text-slate-700">Chi trung bình/giao dịch</span>
                <span className="font-mono font-bold text-orange-700">
                  {quickStats.txCount > 0
                    ? formatVND(Math.round(quickStats.total / quickStats.txCount))
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Phân bổ chi tiêu (danh sách với thanh %) */}
          <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-4">
              Phân bổ chi tiêu
            </h3>
            {sidebarBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có dữ liệu chi trong năm này.</p>
            ) : (
              <div className="space-y-3">
                {sidebarBreakdown.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-slate-600 flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-orange-700">
                        {item.percent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 text-right">
                      {formatVND(item.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Toast thông báo ── */}
      {toast && (
        <div className="fixed top-5 right-5 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg bg-orange-600 text-white text-sm font-medium print:hidden">
          <CheckCircle className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* ── Modal: Thêm khoản chi ── */}
      {showAddModal && (
        <AddExpenseModal
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveExpense}
        />
      )}

      {/* ── Modal: Xem chi tiết phiếu chi ── */}
      {detailTx &&
        (() => {
          const meta = parseTxMeta(detailTx);
          return (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
              <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-sm">
                <div className="flex justify-between items-center pb-3 border-b mb-4">
                  <h3 className="font-semibold text-slate-900 text-sm">Chi tiết phiếu chi</h3>
                  <button
                    onClick={() => setDetailTx(null)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mã phiếu chi</span>
                    <span className="font-mono font-bold text-orange-600">{meta.txCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ngày chi</span>
                    <span className="font-medium text-slate-800">{detailTx.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Người chi</span>
                    <span className="font-medium text-slate-800">{detailTx.payerOrReceiver}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Danh mục chi</span>
                    <span
                      className="inline-block text-[9px] px-2 py-0.5 rounded-full font-bold text-white"
                      style={{ backgroundColor: CATEGORY_COLOR[detailTx.category] }}
                    >
                      {CATEGORY_LABEL[detailTx.category] || detailTx.category}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lý do chi</span>
                    <span className="font-medium text-slate-800 text-right max-w-[180px]">
                      {meta.purpose}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hình thức</span>
                    <span className="font-medium text-slate-800">{meta.method}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2.5">
                    <span className="font-bold text-slate-700">Số tiền</span>
                    <span className="font-mono font-bold text-orange-700">
                      -{formatVND(detailTx.amount)}
                    </span>
                  </div>
                  {meta.note && (
                    <div className="bg-slate-50 rounded-lg p-2.5 text-slate-600 italic">
                      Chứng từ / Ghi chú: {meta.note}
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                    <span>Người ghi sổ</span>
                    <span>{detailTx.recordedBy}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}