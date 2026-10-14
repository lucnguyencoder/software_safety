/**
 * IncomeReportPage.tsx
 * Báo cáo tiền thu (Quản lý quỹ)
 * Workflow: 4 thẻ thống kê + biểu đồ + sidebar tổng quan quỹ → Bảng chi tiết giao dịch
 *           → Bộ lọc nâng cao (Năm/Loại khoản thu/Từ ngày-Đến ngày) → Tabs góc nhìn khác nhau
 *           → Xuất báo cáo (Excel/PDF) cho Ban tài chính.
 */

import React, { useMemo, useState, useEffect } from "react";
import {
  TrendingUp, Users, Wallet, Percent, Filter, ChevronDown, Download,
  FileSpreadsheet, Printer, X, Eye, CalendarDays, Plus, CheckCircle,
  AlertCircle, Banknote, CreditCard,
} from "lucide-react";
import {
  ClanMember, FundTransaction, FundCategory, TransactionType,
  UserAccount, UserRole, AnnualQuota, LivingStatus,
} from "../types";

interface IncomeReportPageProps {
  members: ClanMember[];
  transactions: FundTransaction[];
  annualQuota: AnnualQuota;
  currentAccount: UserAccount;
  onAddTransaction?: (tx: Omit<FundTransaction, "id">) => void | Promise<void>;
}

type ReportTab = "overview" | "detail" | "by_member" | "by_purpose";

const CATEGORY_LABEL: Record<string, string> = {
  [FundCategory.ANNUAL_FEE]: "Niên liễm định mức",
  [FundCategory.VOLUNTARY]: "Tự nguyện / Phát tâm",
  [FundCategory.SPONSORSHIP]: "Tài trợ lớn",
  [FundCategory.CHARITY_STUDY]: "Khuyến học / Mừng thọ / Hiếu hỷ",
  [FundCategory.EVENT_ORGANIZATION]: "Hương hỏa / Tế lễ",
  [FundCategory.TEMPLE_REPAIR]: "Xây dựng từ đường",
  [FundCategory.OTHER]: "Khác",
};
const CATEGORY_COLOR: Record<string, string> = {
  [FundCategory.ANNUAL_FEE]: "#e11d48",
  [FundCategory.VOLUNTARY]: "#10b981",
  [FundCategory.SPONSORSHIP]: "#6366f1",
  [FundCategory.CHARITY_STUDY]: "#f59e0b",
  [FundCategory.EVENT_ORGANIZATION]: "#0ea5e9",
  [FundCategory.TEMPLE_REPAIR]: "#a855f7",
  [FundCategory.OTHER]: "#94a3b8",
};
// Chỉ những danh mục có thể phát sinh khi type = INCOME (loại khoản thu)
const INCOME_CATEGORIES = [
  FundCategory.ANNUAL_FEE, FundCategory.VOLUNTARY, FundCategory.SPONSORSHIP,
  FundCategory.CHARITY_STUDY, FundCategory.OTHER,
];

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

// Mọi nơi ghi nhận thu trong hệ thống (Thu định mức / Đóng góp thêm / Ghi tay) đều theo cùng
// quy ước description: "[MÃ_GD] Mục đích — Hình thức — Ghi chú". Hàm này tách ngược lại để
// hiển thị đúng các cột báo cáo mà không cần đổi cấu trúc dữ liệu FundTransaction hiện có.
const parseTxMeta = (t: FundTransaction) => {
  const raw = t.description || "";
  const codeMatch = raw.match(/\[([A-Z0-9_]+)\]/);
  const txCode = codeMatch ? codeMatch[1] : t.id;
  const stripped = raw.replace(/^\[.*?\]\s*/, "");
  const parts = stripped.split(" — ").map(s => s.trim()).filter(Boolean);
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

// ─── Mini bar chart ngang (tái dùng phong cách đã có ở trang Đóng góp ngoài định mức) ──────
function MiniBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-32 truncate text-slate-600 shrink-0">{d.label}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }} />
          </div>
          <span className="w-24 text-right font-mono font-bold text-slate-700 text-[10px]">{formatVND(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Biểu đồ vành khuyên tỷ lệ đóng quỹ (SVG thuần, không phụ thuộc thư viện ngoài) ─────────
function DonutRate({ rate }: { rate: number }) {
  const clamped = Math.max(0, Math.min(100, rate));
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 90 90" className="w-24 h-24">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      <circle
        cx="45" cy="45" r={r} fill="none" stroke="#10b981" strokeWidth="10"
        strokeDasharray={`${(clamped / 100) * c} ${c}`}
        strokeLinecap="round" transform="rotate(-90 45 45)"
      />
      <text x="45" y="49" textAnchor="middle" className="text-[15px] font-bold fill-slate-800">{rate}%</text>
    </svg>
  );
}

type PayMethod = "CASH" | "TRANSFER";

const genIncomeTxCode = () => {
  const yy = String(new Date().getFullYear()).slice(2);
  const num = String(Math.floor(Math.random() * 900) + 100);
  return `THU${yy}_${num}`;
};

// ─── Modal "Thêm khoản thu" — cho phép Thủ quỹ ghi nhận nhanh một khoản thu
//    bất kỳ (niên liễm, tự nguyện, tài trợ...) ngay tại trang báo cáo, đồng bộ
//    dữ liệu vào chung tbl_transactions nên mọi nơi tổng hợp (báo cáo, trang chủ
//    quản lý quỹ) đều tự động cập nhật. ──────────────────────────────────────────
interface AddIncomeModalProps {
  members: ClanMember[];
  onSave: (data: {
    category: FundCategory; amount: number; date: string;
    payerName: string; memberId?: string; purpose: string;
    method: PayMethod; note: string;
  }) => Promise<void>;
  onClose: () => void;
}

function AddIncomeModal({ members, onSave, onClose }: AddIncomeModalProps) {
  const TODAY = new Date().toISOString().split("T")[0];
  const [category, setCategory] = useState<FundCategory>(FundCategory.VOLUNTARY);
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(TODAY);
  const [payerName, setPayerName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const livingMembers = useMemo(
    () => members.filter(m => m.livingStatus !== LivingStatus.DECEASED),
    [members]
  );

  const handleMemberSelect = (id: string) => {
    setMemberId(id);
    const m = members.find(x => x.id === id);
    if (m) setPayerName(m.fullName);
  };

  const handleSave = async () => {
    if (!payerName.trim()) { setError("Vui lòng nhập tên người nộp."); return; }
    if (!amount || Number(amount) <= 0) { setError("Số tiền phải lớn hơn 0 VNĐ."); return; }
    if (!purpose.trim()) { setError("Vui lòng nhập mục đích khoản thu."); return; }
    if (!date) { setError("Vui lòng chọn ngày ghi nhận."); return; }
    if (note.length > 200) { setError("Ghi chú không được vượt quá 200 ký tự."); return; }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        category, amount: Number(amount), date,
        payerName: payerName.trim(), memberId: memberId || undefined,
        purpose: purpose.trim(), method, note: note.trim(),
      });
    } catch (e: any) {
      setError(e?.message ?? "Có lỗi xảy ra, vui lòng thử lại.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-rose-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-100 rounded-lg"><Plus className="w-4 h-4 text-rose-600" /></div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Thêm danh mục thu</h3>
              <p className="text-[10px] text-slate-400">Ghi nhận giao dịch thu vào quỹ dòng họ</p>
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

          {/* Loại khoản thu */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Loại khoản thu</label>
            <div className="grid grid-cols-2 gap-2">
              {INCOME_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-xl border-2 text-[10px] font-bold text-left transition-all cursor-pointer ${
                    category === cat
                      ? "border-rose-500 bg-rose-50 text-rose-700"
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
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-400 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">VNĐ</span>
            </div>
            {amount !== "" && Number(amount) > 0 && (
              <p className="text-[10px] text-rose-600 mt-1 font-medium">≈ {formatVND(Number(amount))}</p>
            )}
          </div>

          {/* Người nộp */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Người nộp <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={payerName}
              onChange={e => { setPayerName(e.target.value); setMemberId(""); }}
              placeholder="Nhập tên người nộp tiền..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Liên kết thành viên (tùy chọn) */}
          <div>
            <label className="block font-medium text-slate-600 mb-1.5">Liên kết thành viên (tùy chọn)</label>
            <select
              value={memberId}
              onChange={e => handleMemberSelect(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
            >
              <option value="">— Khách / Vô danh công đức —</option>
              {livingMembers.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
            </select>
          </div>

          {/* Mục đích */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Mục đích khoản thu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="VD: Phát tâm xây dựng từ đường, đóng niên liễm..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Hình thức thu */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Hình thức thu</label>
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

          {/* Ngày ghi nhận */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Ngày ghi nhận <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="date" value={date} max={TODAY}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="font-medium text-slate-600">Ghi chú (tùy chọn)</label>
              <span className={`text-[10px] ${note.length > 180 ? "text-red-500" : "text-slate-400"}`}>
                {note.length}/200
              </span>
            </div>
            <textarea
              rows={2} maxLength={200}
              placeholder="Ghi chú thêm nếu có..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
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
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
            {saving
              ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CheckCircle className="w-3.5 h-3.5" />}
            Lưu khoản thu
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IncomeReportPage({ members, transactions, annualQuota, currentAccount, onAddTransaction }: IncomeReportPageProps) {
  const isFinanceBoard = currentAccount.role === UserRole.TREASURER || currentAccount.role === UserRole.LEADER;
  const isTreasurer = currentAccount.role === UserRole.TREASURER;
  const livingMembers = useMemo(() => members.filter(m => m.livingStatus !== LivingStatus.DECEASED), [members]);
  const incomeTxs = useMemo(() => transactions.filter(t => t.type === TransactionType.INCOME), [transactions]);

  // ── Thêm khoản thu trực tiếp từ trang báo cáo ────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSaveIncome = async (data: {
    category: FundCategory; amount: number; date: string;
    payerName: string; memberId?: string; purpose: string;
    method: PayMethod; note: string;
  }) => {
    if (!onAddTransaction) return;
    const methodLabel = data.method === "CASH" ? "Tiền mặt" : "Chuyển khoản";
    const desc = `[${genIncomeTxCode()}] ${data.purpose} — ${methodLabel}${data.note ? ` — ${data.note}` : ""}`;

    await onAddTransaction({
      type: TransactionType.INCOME,
      category: data.category,
      amount: data.amount,
      date: data.date,
      payerOrReceiver: data.payerName,
      memberId: data.memberId,
      description: desc,
      recordedBy: currentAccount.fullName,
      createdAt: new Date().toISOString().split("T")[0],
    });

    setShowAddModal(false);
    setToast("Ghi nhận khoản thu thành công! Đã cập nhật báo cáo và tổng hợp quỹ.");
  };

  // ── Bộ lọc nâng cao (Step 6) ─────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const set = new Set<number>([annualQuota.year, new Date().getFullYear()]);
    incomeTxs.forEach(t => set.add(new Date(t.date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [incomeTxs, annualQuota.year]);

  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterCategory, setFilterCategory] = useState<FundCategory | "ALL">("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("overview");
  const [detailTx, setDetailTx] = useState<FundTransaction | null>(null);

  // ── Step 7: lọc lại dữ liệu tức thời mỗi khi bộ lọc thay đổi ─────────────
  const filteredIncomeTxs = useMemo(() => {
    return incomeTxs.filter(t => {
      const matchYear = new Date(t.date).getFullYear() === filterYear;
      const matchCat = filterCategory === "ALL" || t.category === filterCategory;
      const matchFrom = !fromDate || t.date >= fromDate;
      const matchTo = !toDate || t.date <= toDate;
      return matchYear && matchCat && matchFrom && matchTo;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [incomeTxs, filterYear, filterCategory, fromDate, toDate]);

  // ── Step 3: 4 thẻ thống kê nhanh ─────────────────────────────────────────
  const quickStats = useMemo(() => {
    const total = filteredIncomeTxs.reduce((s, t) => s + t.amount, 0);
    const quotaTotal = filteredIncomeTxs.filter(t => t.category === FundCategory.ANNUAL_FEE).reduce((s, t) => s + t.amount, 0);
    const extraTotal = total - quotaTotal;
    const payerIds = new Set<string>();
    filteredIncomeTxs.forEach(t => payerIds.add(t.memberId || `name:${t.payerOrReceiver}`));
    const payerCount = payerIds.size;
    const payerRate = livingMembers.length > 0 ? Math.round((payerCount / livingMembers.length) * 100) : 0;
    return { total, quotaTotal, extraTotal, payerCount, payerRate };
  }, [filteredIncomeTxs, livingMembers]);

  // ── Sidebar "Tổng quan quỹ" — luôn theo Năm báo cáo, không phụ thuộc Loại khoản thu/Khoảng
  //    ngày vì đây là chỉ số cố định về tiến độ thu định mức của cả năm, không phải dữ liệu đã lọc. ──
  const quotaOverview = useMemo(() => {
    const expected = livingMembers.length * annualQuota.amountPerMember;
    const collected = incomeTxs
      .filter(t => t.category === FundCategory.ANNUAL_FEE && new Date(t.date).getFullYear() === filterYear)
      .reduce((s, t) => s + t.amount, 0);
    const remaining = Math.max(0, expected - collected);
    const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    return { expected, collected, remaining, rate };
  }, [incomeTxs, livingMembers, annualQuota.amountPerMember, filterYear]);

  // ── Step 4 / SubFlow S-1: Biểu đồ thu theo tháng + cơ cấu theo loại khoản thu ────────────
  const monthlyChart = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({ month: `T${i + 1}`, value: 0 }));
    filteredIncomeTxs.forEach(t => {
      const m = new Date(t.date).getMonth();
      if (m >= 0 && m < 12) months[m].value += t.amount;
    });
    return months;
  }, [filteredIncomeTxs]);

  const byPurposeBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredIncomeTxs.forEach(t => {
      if (!map[t.category]) map[t.category] = { total: 0, count: 0 };
      map[t.category].total += t.amount;
      map[t.category].count += 1;
    });
    const grand = Object.values(map).reduce((s, v) => s + v.total, 0);
    return INCOME_CATEGORIES
      .filter(cat => map[cat])
      .map(cat => ({
        category: cat,
        label: CATEGORY_LABEL[cat],
        color: CATEGORY_COLOR[cat],
        total: map[cat].total,
        count: map[cat].count,
        percent: grand > 0 ? Math.round((map[cat].total / grand) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredIncomeTxs]);

  // ── Tab "Theo thành viên": tổng hợp số tiền đã đóng theo từng người ──────
  const byMemberBreakdown = useMemo(() => {
    const map: Record<string, { name: string; branch: string; total: number; count: number }> = {};
    filteredIncomeTxs.forEach(t => {
      const member = t.memberId ? members.find(m => m.id === t.memberId) : undefined;
      const key = t.memberId || `name:${t.payerOrReceiver}`;
      const branch = member ? (member.representativeRole || `Đời ${member.generation}`) : "—";
      if (!map[key]) map[key] = { name: t.payerOrReceiver, branch, total: 0, count: 0 };
      map[key].total += t.amount;
      map[key].count += 1;
    });
    const grand = Object.values(map).reduce((s, v) => s + v.total, 0);
    return Object.values(map)
      .map(v => ({ ...v, percent: grand > 0 ? Math.round((v.total / grand) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filteredIncomeTxs, members]);

  const getBranch = (t: FundTransaction) => {
    const member = t.memberId ? members.find(m => m.id === t.memberId) : undefined;
    return member ? (member.representativeRole || `Đời ${member.generation}`) : "—";
  };

  // ── Step 8: Xuất báo cáo Excel (CSV mở được trực tiếp bằng Excel) ────────
  const handleExportExcel = () => {
    const header = ["Mã giao dịch", "Ngày ghi nhận", "Người nộp", "Chi/Nhánh", "Loại khoản thu", "Mục đích đóng góp", "Số tiền (VNĐ)", "Hình thức", "Ghi chú"];
    const rows = filteredIncomeTxs.map(t => {
      const meta = parseTxMeta(t);
      return [meta.txCode, t.date, t.payerOrReceiver, getBranch(t), CATEGORY_LABEL[t.category] || t.category, meta.purpose, String(t.amount), meta.method, meta.note];
    });
    const csv = [header, ...rows].map(r => r.map(c => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-tien-thu-${filterYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Step 8: Xuất PDF — dùng tính năng in của trình duyệt (Lưu thành PDF), hiển thị đúng
  //    tab báo cáo (Chi tiết giao dịch) đang xem, ẩn bộ lọc/tab/nút bấm khi in. ─────────────
  const handleExportPDF = () => {
    setActiveReportTab("detail");
    window.setTimeout(() => window.print(), 80);
  };

  const tabBtnClass = (tab: ReportTab) =>
    `flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
      activeReportTab === tab ? "bg-white text-rose-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header + bộ lọc nâng cao ── */}
      <div id="income-report-filters" className="bg-white border border-rose-100 rounded-2xl p-4 shadow-sm print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Báo cáo tiền thu</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Tổng hợp toàn bộ giao dịch thu của quỹ dòng họ.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isTreasurer && onAddTransaction && (
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Thêm danh mục thu
              </button>
            )}
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <div className="relative">
              <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-7 appearance-none focus:outline-none cursor-pointer">
                {availableYears.map(y => <option key={y} value={y}>Năm {y}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as FundCategory | "ALL")}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-7 appearance-none focus:outline-none cursor-pointer">
                <option value="ALL">Mọi loại khoản thu</option>
                {INCOME_CATEGORIES.map(cat => <option key={cat} value={cat}>{CATEGORY_LABEL[cat]}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="text-xs bg-transparent focus:outline-none w-[110px]" />
              <span className="text-slate-300">—</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="text-xs bg-transparent focus:outline-none w-[110px]" />
            </div>
            {(fromDate || toDate || filterCategory !== "ALL") && (
              <button onClick={() => { setFromDate(""); setToDate(""); setFilterCategory("ALL"); }}
                className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer">Xóa lọc</button>
            )}
            {isFinanceBoard && (
              <div className="flex gap-1 ml-1">
                <button onClick={handleExportExcel} title="Xuất báo cáo Excel"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </button>
                <button onClick={handleExportPDF} title="Xuất báo cáo PDF"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold cursor-pointer">
                  <Printer className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Step 3: 4 thẻ thống kê nhanh ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-emerald-400 font-bold uppercase">Tổng tiền đã thu</p>
              <h2 className="text-xl font-bold mt-1 text-emerald-400">{formatVND(quickStats.total)}</h2>
            </div>
            <span className="p-2.5 bg-slate-800 rounded-xl text-emerald-400 border border-slate-700"><TrendingUp className="w-5 h-5" /></span>
          </div>
          <p className="text-[10px] text-slate-400 mt-4">Năm {filterYear}{filterCategory !== "ALL" ? ` — ${CATEGORY_LABEL[filterCategory]}` : ""}</p>
        </div>
        <div className="bg-white border rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-rose-600 font-semibold uppercase">Tổng thu định mức</p>
              <h2 className="text-xl font-bold mt-1 text-slate-900">{formatVND(quickStats.quotaTotal)}</h2>
            </div>
            <span className="p-2.5 bg-rose-50 rounded-xl text-rose-700"><Percent className="w-5 h-5" /></span>
          </div>
          <p className="text-[10px] text-slate-400 mt-4">Niên liễm cố định đã ghi nhận.</p>
        </div>
        <div className="bg-white border rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-indigo-600 font-semibold uppercase">Tổng thu đóng góp thêm</p>
              <h2 className="text-xl font-bold mt-1 text-slate-900">{formatVND(quickStats.extraTotal)}</h2>
            </div>
            <span className="p-2.5 bg-indigo-50 rounded-xl text-indigo-700"><Wallet className="w-5 h-5" /></span>
          </div>
          <p className="text-[10px] text-slate-400 mt-4">Tự nguyện, tài trợ, khuyến học...</p>
        </div>
        <div className="bg-white border rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-emerald-600 font-semibold uppercase">Thành viên đã đóng</p>
              <h2 className="text-xl font-bold mt-1 text-slate-900">{quickStats.payerCount} <span className="text-xs text-slate-400 font-normal">/ {livingMembers.length}</span></h2>
            </div>
            <span className="p-2.5 bg-emerald-50 rounded-xl text-emerald-700"><Users className="w-5 h-5" /></span>
          </div>
          <p className="text-[10px] text-slate-400 mt-4">Tỷ lệ {quickStats.payerRate}% thành viên còn sống.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Khu vực chính: Tabs + biểu đồ/bảng ── */}
        <div className="xl:col-span-2 flex flex-col gap-5">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit print:hidden">
            <button onClick={() => setActiveReportTab("overview")} className={tabBtnClass("overview")}>Tổng quan</button>
            <button onClick={() => setActiveReportTab("detail")} className={tabBtnClass("detail")}>Chi tiết giao dịch</button>
            <button onClick={() => setActiveReportTab("by_member")} className={tabBtnClass("by_member")}>Theo thành viên</button>
            <button onClick={() => setActiveReportTab("by_purpose")} className={tabBtnClass("by_purpose")}>Theo mục đích</button>
          </div>

          {/* ── Tab: Tổng quan (SubFlow S-1: vẽ biểu đồ) ── */}
          {activeReportTab === "overview" && (
            <>
              <div className="bg-white border border-rose-100 rounded-2xl p-6 shadow-xs">
                <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-4">Thu theo tháng — Năm {filterYear} (đơn vị: VNĐ)</h3>
                <div className="w-full overflow-x-auto">
                  <svg viewBox="0 0 600 190" className="w-full min-w-[560px] h-[190px]">
                    {(() => {
                      const max = Math.max(...monthlyChart.map(m => m.value), 1);
                      const barW = 38, gap = 9, baseY = 160;
                      return monthlyChart.map((m, i) => {
                        const h = (m.value / max) * 120;
                        const x = 16 + i * (barW + gap);
                        return (
                          <g key={m.month}>
                            <rect x={x} y={baseY - h} width={barW} height={h} rx="4" fill="#e11d48" opacity={m.value > 0 ? 0.85 : 0.12} />
                            <text x={x + barW / 2} y={baseY + 16} textAnchor="middle" className="text-[9px] font-bold fill-slate-500">{m.month}</text>
                            {m.value > 0 && (
                              <text x={x + barW / 2} y={baseY - h - 6} textAnchor="middle" className="text-[8px] font-bold fill-rose-700">
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

              <div className="bg-white border border-rose-100 rounded-2xl p-6 shadow-xs">
                <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-4">Cơ cấu theo loại khoản thu</h3>
                {byPurposeBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Chưa có dữ liệu phù hợp với bộ lọc hiện tại.</p>
                ) : (
                  <MiniBarChart data={byPurposeBreakdown.map(b => ({ label: b.label, value: b.total, color: b.color }))} />
                )}
              </div>
            </>
          )}

          {/* ── Tab: Chi tiết giao dịch (Step 5) ── */}
          {activeReportTab === "detail" && (
            <div className="bg-white border border-rose-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-rose-50 flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-xs uppercase tracking-wider">Danh sách giao dịch thu</span>
                <span className="text-[11px] text-slate-400">{filteredIncomeTxs.length} giao dịch</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="px-3 py-3 text-left">Mã GD</th>
                      <th className="px-3 py-3 text-left">Ngày</th>
                      <th className="px-3 py-3 text-left">Người nộp</th>
                      <th className="px-3 py-3 text-left">Chi/Nhánh</th>
                      <th className="px-3 py-3 text-left">Loại khoản thu</th>
                      <th className="px-3 py-3 text-left">Mục đích</th>
                      <th className="px-3 py-3 text-right">Số tiền (VNĐ)</th>
                      <th className="px-3 py-3 text-left">Hình thức</th>
                      <th className="px-3 py-3 text-left">Ghi chú</th>
                      <th className="px-3 py-3 text-center print:hidden">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredIncomeTxs.length === 0 ? (
                      <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400 italic">Không có giao dịch thu nào phù hợp với bộ lọc.</td></tr>
                    ) : filteredIncomeTxs.map(t => {
                      const meta = parseTxMeta(t);
                      return (
                        <tr key={t.id} className="hover:bg-rose-50/20">
                          <td className="px-3 py-3 font-mono text-[10px] font-bold text-rose-600">{meta.txCode}</td>
                          <td className="px-3 py-3 text-slate-600 font-mono">{t.date}</td>
                          <td className="px-3 py-3 font-semibold text-slate-800">{t.payerOrReceiver}</td>
                          <td className="px-3 py-3 text-slate-500">{getBranch(t)}</td>
                          <td className="px-3 py-3">
                            <span className="inline-block text-[9px] px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: CATEGORY_COLOR[t.category] }}>
                              {CATEGORY_LABEL[t.category] || t.category}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-600 max-w-[160px] truncate" title={meta.purpose}>{meta.purpose}</td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">+{formatVND(t.amount)}</td>
                          <td className="px-3 py-3 text-slate-500">{meta.method}</td>
                          <td className="px-3 py-3 text-slate-400 italic max-w-[140px] truncate" title={meta.note}>{meta.note || "—"}</td>
                          <td className="px-3 py-3 text-center print:hidden">
                            <button onClick={() => setDetailTx(t)} className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 cursor-pointer" title="Xem chi tiết">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab: Theo thành viên ── */}
          {activeReportTab === "by_member" && (
            <div className="bg-white border border-rose-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-rose-50">
                <span className="font-semibold text-slate-900 text-xs uppercase tracking-wider">Tổng hợp theo thành viên đóng góp</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="px-4 py-3 text-left">Họ tên</th>
                      <th className="px-4 py-3 text-left">Chi/Nhánh</th>
                      <th className="px-4 py-3 text-center">Số lượt đóng</th>
                      <th className="px-4 py-3 text-right">Tổng đã đóng</th>
                      <th className="px-4 py-3 text-right">% tổng thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {byMemberBreakdown.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400 italic">Chưa có ai đóng góp phù hợp với bộ lọc.</td></tr>
                    ) : byMemberBreakdown.map(m => (
                      <tr key={m.name + m.branch} className="hover:bg-rose-50/20">
                        <td className="px-4 py-3 font-semibold text-slate-800">{m.name}</td>
                        <td className="px-4 py-3 text-slate-500">{m.branch}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{m.count}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{formatVND(m.total)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{m.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab: Theo mục đích (theo loại khoản thu) ── */}
          {activeReportTab === "by_purpose" && (
            <div className="bg-white border border-rose-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-rose-50">
                <span className="font-semibold text-slate-900 text-xs uppercase tracking-wider">Tổng hợp theo mục đích / loại khoản thu</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="px-4 py-3 text-left">Loại khoản thu</th>
                      <th className="px-4 py-3 text-center">Số giao dịch</th>
                      <th className="px-4 py-3 text-right">Tổng tiền</th>
                      <th className="px-4 py-3 text-right">% tổng thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {byPurposeBreakdown.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400 italic">Không có dữ liệu phù hợp với bộ lọc.</td></tr>
                    ) : byPurposeBreakdown.map(b => (
                      <tr key={b.category} className="hover:bg-rose-50/20">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} /> {b.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">{b.count}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{formatVND(b.total)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{b.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Step 4: Sidebar "Tổng quan quỹ" + "Tỷ lệ đóng quỹ" ── */}
        <div className="flex flex-col gap-4 print:hidden">
          <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-4">Tổng quan quỹ định mức — {filterYear}</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tổng số thu dự kiến</span>
                <span className="font-mono font-bold text-slate-900">{formatVND(quotaOverview.expected)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Đã thu</span>
                <span className="font-mono font-bold text-emerald-600">{formatVND(quotaOverview.collected)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                <span className="font-bold text-slate-700">Còn thiếu</span>
                <span className="font-mono font-bold text-red-600">{formatVND(quotaOverview.remaining)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-sm flex flex-col items-center">
            <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-3 self-start">Tỷ lệ đóng quỹ</h3>
            <DonutRate rate={quotaOverview.rate} />
            <p className="text-[10px] text-slate-400 mt-2 text-center">{formatVND(quotaOverview.collected)} / {formatVND(quotaOverview.expected)}</p>
          </div>
        </div>
      </div>

      {/* ── Toast thông báo ── */}
      {toast && (
        <div className="fixed top-5 right-5 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg bg-rose-600 text-white text-sm font-medium print:hidden">
          <CheckCircle className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* ── Modal: Thêm khoản thu ── */}
      {showAddModal && (
        <AddIncomeModal
          members={members}
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveIncome}
        />
      )}

      {/* ── Modal: Thao tác xem chi tiết giao dịch ── */}
      {detailTx && (() => {
        const meta = parseTxMeta(detailTx);
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
            <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-sm">
              <div className="flex justify-between items-center pb-3 border-b mb-4">
                <h3 className="font-semibold text-slate-900 text-sm">Chi tiết giao dịch thu</h3>
                <button onClick={() => setDetailTx(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Mã giao dịch</span><span className="font-mono font-bold text-rose-600">{meta.txCode}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Ngày ghi nhận</span><span className="font-medium text-slate-800">{detailTx.date}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Người nộp</span><span className="font-medium text-slate-800">{detailTx.payerOrReceiver}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Chi/Nhánh</span><span className="font-medium text-slate-800">{getBranch(detailTx)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Loại khoản thu</span><span className="font-medium text-slate-800">{CATEGORY_LABEL[detailTx.category]}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Mục đích</span><span className="font-medium text-slate-800 text-right max-w-[180px]">{meta.purpose}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Hình thức</span><span className="font-medium text-slate-800">{meta.method}</span></div>
                <div className="flex justify-between border-t pt-2.5"><span className="font-bold text-slate-700">Số tiền</span><span className="font-mono font-bold text-emerald-700">{formatVND(detailTx.amount)}</span></div>
                {meta.note && <div className="bg-slate-50 rounded-lg p-2.5 text-slate-600 italic">Ghi chú: {meta.note}</div>}
                <div className="flex justify-between text-[10px] text-slate-400 pt-1"><span>Người ghi sổ</span><span>{detailTx.recordedBy}</span></div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}