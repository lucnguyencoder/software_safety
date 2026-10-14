/**
 * ExtraContributionPage.tsx
 * Đóng góp ngoài định mức (tự nguyện / tài trợ / khác)
 * Workflow: Dashboard KPI + Biểu đồ cơ cấu + Bảng giao dịch → Thêm khoản thu mới
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  Plus, X, Search, CheckCircle, AlertCircle, Banknote,
  CreditCard, CalendarDays, Filter, ChevronDown, BarChart3,
  TrendingUp, DollarSign, Users, FileText, Tag, Pencil,
} from "lucide-react";
import {
  ClanMember, FundTransaction, FundCategory,
  TransactionType, UserAccount, UserRole, LivingStatus,
} from "../types";

// ─── Mục đích đóng góp mặc định ─────────────────────────────────────────────
const DEFAULT_PURPOSES = [
  "Phát tâm xây dựng từ đường",
  "Tài trợ sự kiện dòng họ",
  "Quỹ khuyến học",
  "Ủng hộ tang lễ / hiếu hỷ",
  "Đóng góp tự nguyện",
  "Tài trợ cúng lễ",
  "Mừng thọ",
];

const EXTRA_CATEGORIES = [
  FundCategory.VOLUNTARY,
  FundCategory.SPONSORSHIP,
  FundCategory.CHARITY_STUDY,
  FundCategory.OTHER,
];

const CATEGORY_LABEL: Record<string, string> = {
  [FundCategory.VOLUNTARY]: "Tự nguyện / Phát tâm",
  [FundCategory.SPONSORSHIP]: "Tài trợ lớn",
  [FundCategory.CHARITY_STUDY]: "Khuyến học / Mừng thọ / Hiếu hỷ",
  [FundCategory.OTHER]: "Khác",
};

const CATEGORY_COLOR: Record<string, string> = {
  [FundCategory.VOLUNTARY]: "#10b981",
  [FundCategory.SPONSORSHIP]: "#6366f1",
  [FundCategory.CHARITY_STUDY]: "#f59e0b",
  [FundCategory.OTHER]: "#94a3b8",
};

type PayMethod = "CASH" | "TRANSFER";
const TODAY = new Date().toISOString().split("T")[0];
const CURRENT_YEAR = new Date().getFullYear();

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const genTxCode = () => {
  const yy = String(CURRENT_YEAR).slice(2);
  const num = String(Math.floor(Math.random() * 900) + 100);
  return `DON${yy}_${num}`;
};

interface ExtraContributionPageProps {
  members: ClanMember[];
  transactions: FundTransaction[];
  currentAccount: UserAccount;
  onAddTransaction: (tx: Omit<FundTransaction, "id">) => void | Promise<void>;
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-32 truncate text-slate-600 shrink-0">{d.label}</span>
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

// ─── Form modal ──────────────────────────────────────────────────────────────
interface AddContributionModalProps {
  members: ClanMember[];
  purposes: string[];
  onSave: (data: {
    memberId: string; memberName: string; amount: number;
    purpose: string; category: FundCategory;
    method: PayMethod; date: string; note: string; txCode: string;
  }) => Promise<void>;
  onClose: () => void;
  onAddPurpose: (p: string) => void;
}

function AddContributionModal({ members, purposes, onSave, onClose, onAddPurpose }: AddContributionModalProps) {
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<ClanMember | null>(null);
  const [amount, setAmount] = useState<number | "">("");
  const [purpose, setPurpose] = useState(purposes[0] ?? "");
  const [category, setCategory] = useState<FundCategory>(FundCategory.VOLUNTARY);
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewPurpose, setShowNewPurpose] = useState(false);
  const [newPurpose, setNewPurpose] = useState("");

  const aliveMmbers = useMemo(
    () => members.filter(m => m.livingStatus !== LivingStatus.DECEASED),
    [members]
  );

  const filteredMembers = useMemo(() =>
    aliveMmbers.filter(m =>
      m.fullName.toLowerCase().includes(memberSearch.toLowerCase())
    ).slice(0, 8),
    [aliveMmbers, memberSearch]
  );

  const handleAddPurpose = () => {
    if (!newPurpose.trim()) return;
    onAddPurpose(newPurpose.trim());
    setPurpose(newPurpose.trim());
    setNewPurpose("");
    setShowNewPurpose(false);
  };

  const handleSave = async () => {
    if (!selectedMember) { setError("Vui lòng chọn thành viên đóng góp."); return; }
    if (!amount || Number(amount) <= 0) { setError("Số tiền phải lớn hơn 0 VNĐ."); return; }
    if (!purpose.trim()) { setError("Vui lòng chọn mục đích đóng góp."); return; }
    if (!date) { setError("Vui lòng chọn ngày ghi nhận."); return; }
    if (note.length > 200) { setError("Ghi chú không được vượt quá 200 ký tự."); return; }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        memberId: selectedMember.id,
        memberName: selectedMember.fullName,
        amount: Number(amount),
        purpose,
        category,
        method,
        date,
        note,
        txCode: genTxCode(),
      });
    } catch (e: any) {
      setError(e?.message ?? "Có lỗi xảy ra.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-indigo-100 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded-lg">
              <Plus className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Thêm khoản thu mới</h3>
              <p className="text-[10px] text-slate-400">Đóng góp ngoài định mức</p>
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

          {/* SubFlow S-1: Tìm kiếm thành viên */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Thành viên đóng góp <span className="text-red-500">*</span>
            </label>
            {selectedMember ? (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                    {selectedMember.fullName.charAt(selectedMember.fullName.lastIndexOf(" ") + 1)}
                  </div>
                  <span className="font-bold text-indigo-800">{selectedMember.fullName}</span>
                  <span className="text-[10px] text-indigo-400">Đời {selectedMember.generation}</span>
                </div>
                <button onClick={() => { setSelectedMember(null); setMemberSearch(""); }}
                  className="text-indigo-400 hover:text-indigo-600 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo họ tên thành viên..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {memberSearch && filteredMembers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                    {filteredMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedMember(m); setMemberSearch(""); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 text-left cursor-pointer"
                      >
                        <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[9px] shrink-0">
                          {m.fullName.charAt(m.fullName.lastIndexOf(" ") + 1)}
                        </div>
                        <span className="font-medium text-slate-800">{m.fullName}</span>
                        <span className="text-slate-400 text-[10px] ml-auto">Đời {m.generation}</span>
                      </button>
                    ))}
                  </div>
                )}
                {memberSearch && filteredMembers.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 px-3 py-3 text-slate-400 italic">
                    Không tìm thấy thành viên.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Số tiền */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Số tiền đóng góp (VNĐ) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number" min={1} step={10000}
                value={amount}
                onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Nhập số tiền..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">VNĐ</span>
            </div>
            {amount && Number(amount) > 0 && (
              <p className="text-[10px] text-indigo-600 mt-1 font-medium">≈ {formatVND(Number(amount))}</p>
            )}
          </div>

          {/* Mục đích đóng góp */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">
                Mục đích đóng góp <span className="text-red-500">*</span>
              </label>
              <button
                onClick={() => setShowNewPurpose(!showNewPurpose)}
                className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Thêm mục đích mới
              </button>
            </div>

            {showNewPurpose && (
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Nhập mục đích mới..."
                  value={newPurpose}
                  onChange={e => setNewPurpose(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddPurpose()}
                  className="flex-1 border border-indigo-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button onClick={handleAddPurpose}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer hover:bg-indigo-700">
                  Thêm
                </button>
              </div>
            )}

            <select
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {purposes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Danh mục */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Danh mục</label>
            <div className="grid grid-cols-2 gap-2">
              {EXTRA_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-xl border-2 text-[10px] font-bold text-left transition-all cursor-pointer ${
                    category === cat
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {CATEGORY_LABEL[cat]}
                </button>
              ))}
            </div>
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
              <input type="date" value={date} max={TODAY}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ExtraContributionPage({
  members, transactions, currentAccount, onAddTransaction,
}: ExtraContributionPageProps) {
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number | "ALL">(CURRENT_YEAR);
  const [filterCat, setFilterCat] = useState<FundCategory | "ALL">("ALL");
  const [purposes, setPurposes] = useState<string[]>(DEFAULT_PURPOSES);

  const isTreasurer = currentAccount.role === UserRole.TREASURER;

  // Chỉ lấy giao dịch đóng góp ngoài định mức (không phải ANNUAL_FEE, không phải chi)
  const extraTxs = useMemo(() =>
    transactions.filter(t =>
      t.type === TransactionType.INCOME &&
      t.category !== FundCategory.ANNUAL_FEE
    ), [transactions]);

  // Lọc theo năm và danh mục
  const filtered = useMemo(() => {
    return extraTxs.filter(t => {
      // Parse year từ string "YYYY-MM-DD" trực tiếp để tránh timezone shift
      const year = parseInt((t.date ?? "").split("-")[0], 10);
      const matchYear = filterYear === "ALL" || year === filterYear;
      const matchCat = filterCat === "ALL" || t.category === filterCat;
      return matchYear && matchCat;
    }).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [extraTxs, filterYear, filterCat]);

  // KPI
  const stats = useMemo(() => {
    const total = filtered.reduce((s, t) => s + t.amount, 0);
    const count = filtered.length;
    const uniqueMembers = new Set(filtered.map(t => t.memberId).filter(Boolean)).size;
    const avgAmount = count > 0 ? total / count : 0;
    return { total, count, uniqueMembers, avgAmount };
  }, [filtered]);

  // Biểu đồ cơ cấu nguồn thu theo danh mục
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(t => {
      map[t.category] = (map[t.category] ?? 0) + t.amount;
    });
    return EXTRA_CATEGORIES
      .filter(cat => map[cat])
      .map(cat => ({ label: CATEGORY_LABEL[cat], value: map[cat], color: CATEGORY_COLOR[cat] }));
  }, [filtered]);

  // Auto-dismiss toast
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = useCallback(async (data: {
    memberId: string; memberName: string; amount: number;
    purpose: string; category: FundCategory;
    method: PayMethod; date: string; note: string; txCode: string;
  }) => {
    const methodLabel = data.method === "CASH" ? "Tiền mặt" : "Chuyển khoản";
    const desc = `[${data.txCode}] ${data.purpose} — ${methodLabel}${data.note ? ` — ${data.note}` : ""}`;

    await onAddTransaction({
      type: TransactionType.INCOME,
      category: data.category,
      amount: data.amount,
      date: data.date,
      payerOrReceiver: data.memberName,
      memberId: data.memberId,
      description: desc,
      recordedBy: currentAccount.fullName,
      createdAt: TODAY,
    });

    setShowModal(false);
    setToast("Ghi nhận khoản đóng góp thành công!");
  }, [onAddTransaction, currentAccount.fullName]);

  const years = useMemo(() => {
    const set = new Set(extraTxs.map(t => parseInt((t.date ?? "").split("-")[0], 10)).filter(Boolean));
    set.add(CURRENT_YEAR);
    return Array.from(set).sort((a, b) => b - a);
  }, [extraTxs]);

  return (
    <div className="flex flex-col gap-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg bg-indigo-600 text-white text-sm font-medium">
          <CheckCircle className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900 text-base">Đóng góp ngoài định mức</h2>
          <p className="text-xs text-slate-500 mt-0.5">Ghi nhận các khoản đóng góp tự nguyện, tài trợ và phát tâm</p>
        </div>
        {isTreasurer && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm khoản thu
          </button>
        )}
      </div>

      {/* Dashboard: KPI + Biểu đồ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* KPI cards — chiếm 2/3 */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          <div className="bg-white border rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-2">Tổng đóng góp</p>
            <p className="text-xl font-mono font-bold text-indigo-700">{formatVND(stats.total)}</p>
            <p className="text-[10px] text-slate-400 mt-1">{stats.count} khoản ghi nhận</p>
          </div>
          <div className="bg-white border rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">Số lượt đóng góp</p>
            <p className="text-xl font-mono font-bold text-slate-900">{stats.count}</p>
            <p className="text-[10px] text-slate-400 mt-1">{stats.uniqueMembers} thành viên tham gia</p>
          </div>
          <div className="bg-white border rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2">Trung bình / lượt</p>
            <p className="text-xl font-mono font-bold text-slate-900">{formatVND(stats.avgAmount)}</p>
          </div>
          <div className="bg-white border rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Thành viên đóng góp</p>
            <p className="text-xl font-mono font-bold text-slate-900">{stats.uniqueMembers}</p>
            <p className="text-[10px] text-slate-400 mt-1">người tham gia</p>
          </div>
        </div>

        {/* Biểu đồ cơ cấu nguồn thu — chiếm 1/3 */}
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span className="font-bold text-slate-700 text-xs uppercase tracking-wider">Cơ cấu nguồn thu</span>
          </div>
          {chartData.length === 0 ? (
            <p className="text-slate-400 text-xs italic text-center py-4">Chưa có dữ liệu</p>
          ) : (
            <MiniBarChart data={chartData} />
          )}
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-3.5 h-3.5 text-slate-400" />

          {/* Lọc năm */}
          <div className="relative">
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 appearance-none pr-7 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả năm</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Lọc danh mục */}
          <div className="relative">
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value as FundCategory | "ALL")}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 appearance-none pr-7 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả danh mục</option>
              {EXTRA_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABEL[cat]}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          <span className="text-xs text-slate-400 ml-auto">{filtered.length} giao dịch</span>
        </div>
      </div>

      {/* Bảng danh sách giao dịch */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-slate-700 text-xs uppercase tracking-wider">Danh sách khoản đóng góp</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-sans border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-4 py-3 text-left">Mã GD</th>
                <th className="px-4 py-3 text-left">Thành viên</th>
                <th className="px-4 py-3 text-left">Mục đích</th>
                <th className="px-4 py-3 text-center">Danh mục</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
                <th className="px-4 py-3 text-center">Ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 italic">
                    Chưa có khoản đóng góp nào được ghi nhận.
                  </td>
                </tr>
              ) : filtered.map(t => {
                // Trích mã giao dịch từ description [DON26_xxx]
                const codeMatch = t.description?.match(/\[([A-Z0-9_]+)\]/);
                const txCode = codeMatch ? codeMatch[1] : "—";
                // Trích mục đích (phần trước " — ")
                const purposeText = t.description?.split(" — ")[0]?.replace(/\[.*?\]\s*/, "") || t.description;

                return (
                  <tr key={t.id} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                        {txCode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[9px] shrink-0">
                          {t.payerOrReceiver?.charAt(t.payerOrReceiver.lastIndexOf(" ") + 1)}
                        </div>
                        <span className="font-medium text-slate-800">{t.payerOrReceiver}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[180px]">
                      <p className="truncate" title={purposeText}>{purposeText}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-block text-[9px] px-2 py-0.5 rounded-full font-bold text-white"
                        style={{ backgroundColor: CATEGORY_COLOR[t.category] ?? "#94a3b8" }}
                      >
                        {CATEGORY_LABEL[t.category] ?? t.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-700">
                      {formatVND(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 font-mono">
                      {t.date}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <AddContributionModal
          members={members}
          purposes={purposes}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          onAddPurpose={p => setPurposes(prev => [...prev, p])}
        />
      )}
    </div>
  );
}