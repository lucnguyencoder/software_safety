/**
 * AnnualFeeCollectionPage.tsx
 * Thu quỹ định mức hằng năm
 * Workflow: Xem danh sách thành viên → Ghi nhận thu → Cập nhật trạng thái
 */

import React, { useState, useMemo } from "react";
import {
  Search, CheckCircle, Clock, Plus, X, Banknote,
  CreditCard, CalendarDays, TrendingUp, Users, AlertCircle,
  Filter, ChevronDown,
} from "lucide-react";
import { ClanMember, FundTransaction, FundCategory, TransactionType, UserAccount, AnnualQuota, UserRole, LivingStatus } from "../types";

interface AnnualFeeCollectionProps {
  members: ClanMember[];
  transactions: FundTransaction[];
  annualQuota: AnnualQuota;
  currentAccount: UserAccount;
  onAddTransaction: (tx: Omit<FundTransaction, "id">) => void;
}

type PayStatus = "PAID" | "UNPAID" | "ALL";
type PayMethod = "CASH" | "TRANSFER";

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const TODAY = new Date().toISOString().split("T")[0];
const CURRENT_YEAR = new Date().getFullYear();

// ─── Hộp thoại Ghi nhận thu tiền (SubFlow S-1) ──────────────────────────────
interface CollectDialogProps {
  member: ClanMember;
  quota: number;
  alreadyPaid: number;
  onConfirm: (data: { method: PayMethod; date: string; note: string }) => Promise<void>;
  onClose: () => void;
}

function CollectDialog({ member, quota, alreadyPaid, onConfirm, onClose }: CollectDialogProps) {
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = quota - alreadyPaid;

  const handleConfirm = async () => {
    if (!date) { setError("Vui lòng chọn ngày ghi nhận."); return; }
    setSaving(true);
    setError(null);
    try {
      await onConfirm({ method, date, note });
    } catch (e: any) {
      setError(e?.message ?? "Có lỗi xảy ra.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-emerald-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <Banknote className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Ghi nhận thu tiền</h3>
              <p className="text-[10px] text-slate-400">{member.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4 text-xs font-sans">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Thông tin số tiền */}
          <div className="bg-emerald-50 rounded-xl p-3 flex flex-col gap-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Định mức phải đóng:</span>
              <span className="font-mono font-bold text-slate-900">{formatVND(quota)}</span>
            </div>
            {alreadyPaid > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Đã đóng trước:</span>
                <span className="font-mono font-bold text-emerald-600">{formatVND(alreadyPaid)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-emerald-200 pt-1.5 mt-0.5">
              <span className="font-bold text-slate-700">Số tiền thu lần này:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">{formatVND(remaining)}</span>
            </div>
          </div>

          {/* Hình thức đóng */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Hình thức đóng</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMethod("CASH")}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                  method === "CASH"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <Banknote className="w-4 h-4" /> Tiền mặt
              </button>
              <button
                onClick={() => setMethod("TRANSFER")}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                  method === "TRANSFER"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <CreditCard className="w-4 h-4" /> Chuyển khoản
              </button>
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
                type="date"
                value={date}
                max={TODAY}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block font-medium text-slate-600 mb-1.5">Ghi chú (tùy chọn)</label>
            <input
              type="text"
              placeholder="Ghi chú thêm nếu có..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {saving
              ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CheckCircle className="w-3.5 h-3.5" />}
            Xác nhận thu
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AnnualFeeCollectionPage({
  members, transactions, annualQuota, currentAccount, onAddTransaction,
}: AnnualFeeCollectionProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PayStatus>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [collectTarget, setCollectTarget] = useState<ClanMember | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isTreasurer = currentAccount.role === UserRole.TREASURER;

  const quota = annualQuota.amountPerMember;
  const year = annualQuota.year ?? CURRENT_YEAR;

  // ── Tính toán số tiền đã đóng của từng thành viên trong năm ──────────────
  const paidByMember = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      if (
        t.type === TransactionType.INCOME &&
        t.category === FundCategory.ANNUAL_FEE &&
        t.memberId &&
        new Date(t.date).getFullYear() === year
      ) {
        map[t.memberId] = (map[t.memberId] ?? 0) + t.amount;
      }
    });
    return map;
  }, [transactions, year]);

  // ── Danh sách chi/nhánh từ representativeRole hoặc generation ───────────
  const branches = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      const branch = m.representativeRole
        ? m.representativeRole.replace(/(Trưởng|thành viên|thư ký)/gi, "").trim()
        : `Đời ${m.generation}`;
      if (branch) set.add(branch);
    });
    return Array.from(set).sort();
  }, [members]);

  // ── Danh sách thành viên với trạng thái đóng quỹ ────────────────────────
  const memberRows = useMemo(() => {
    return members
      .filter(m => m.livingStatus !== LivingStatus.DECEASED)
      .map(m => {
        const paid = paidByMember[m.id] ?? 0;
        const isPaid = paid >= quota;
        const branch = m.representativeRole || `Đời ${m.generation}`;
        return { ...m, paid, isPaid, branch };
      });
  }, [members, paidByMember, quota]);

  // ── Thống kê tổng quan ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = memberRows.length;
    const paid = memberRows.filter(m => m.isPaid).length;
    const totalCollected = memberRows.reduce((s, m) => s + m.paid, 0);
    const totalExpected = total * quota;
    const remaining = totalExpected - totalCollected;
    const rate = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total, paid, unpaid: total - paid, totalCollected, totalExpected, remaining, rate };
  }, [memberRows, quota]);

  // ── Lọc danh sách ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return memberRows.filter(m => {
      const matchSearch = m.fullName.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "ALL" ? true :
        statusFilter === "PAID" ? m.isPaid : !m.isPaid;
      const matchBranch = branchFilter === "ALL" || m.branch === branchFilter;
      return matchSearch && matchStatus && matchBranch;
    });
  }, [memberRows, search, statusFilter, branchFilter]);

  // ── Auto-dismiss toast ────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Xử lý ghi nhận thu ──────────────────────────────────────────────────
  const handleCollect = async (data: { method: PayMethod; date: string; note: string }) => {
    if (!collectTarget) return;
    const alreadyPaid = paidByMember[collectTarget.id] ?? 0;
    const amount = quota - alreadyPaid;

    const methodLabel = data.method === "CASH" ? "Tiền mặt" : "Chuyển khoản";
    const desc = `Thu quỹ định mức năm ${year} — ${methodLabel}${data.note ? ` — ${data.note}` : ""}`;

    onAddTransaction({
      type: TransactionType.INCOME,
      category: FundCategory.ANNUAL_FEE,
      amount,
      date: data.date,
      payerOrReceiver: collectTarget.fullName,
      memberId: collectTarget.id,
      description: desc,
      recordedBy: currentAccount.fullName,
      createdAt: TODAY,
    });

    setCollectTarget(null);
    setToast(`Ghi nhận thu quỹ định mức thành công!`);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg bg-emerald-600 text-white text-sm font-medium">
          <CheckCircle className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div>
        <h2 className="font-bold text-slate-900 text-base">Thu quỹ định mức — Năm {year}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Định mức: <span className="font-bold text-rose-600">{formatVND(quota)}/người</span>
          {annualQuota.description && <span className="ml-2 italic text-slate-400">— {annualQuota.description}</span>}
        </p>
      </div>

      {/* ── Thẻ thống kê tổng quan ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Tỷ lệ đóng quỹ */}
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Tỷ lệ đóng quỹ</p>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-slate-900">{stats.rate}%</span>
            <span className="text-xs text-slate-400 mb-0.5">{stats.paid}/{stats.total} người</span>
          </div>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${stats.rate}%` }}
            />
          </div>
        </div>

        {/* Tổng thu đã ghi nhận */}
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">Tổng thu đã ghi nhận</p>
          <p className="text-lg font-mono font-bold text-emerald-700">{formatVND(stats.totalCollected)}</p>
          <p className="text-[10px] text-slate-400 mt-1">/ {formatVND(stats.totalExpected)} kế hoạch</p>
        </div>

        {/* Còn thiếu */}
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2">Còn thiếu</p>
          <p className="text-lg font-mono font-bold text-red-600">{formatVND(stats.remaining)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{stats.unpaid} thành viên chưa đóng</p>
        </div>

        {/* Đã đóng đủ */}
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Đã đóng đủ</p>
          <p className="text-lg font-mono font-bold text-slate-900">{stats.paid} người</p>
          <p className="text-[10px] text-slate-400 mt-1">Chưa đóng: {stats.unpaid} người</p>
        </div>
      </div>

      {/* ── Bộ lọc & tìm kiếm ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Tìm kiếm */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo họ tên..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {/* Lọc chi/nhánh */}
          <div className="relative">
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 appearance-none pr-7 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
            >
              <option value="ALL">Tất cả chi/nhánh</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Lọc trạng thái */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(["ALL", "UNPAID", "PAID"] as PayStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === s
                    ? s === "PAID" ? "bg-emerald-600 text-white"
                      : s === "UNPAID" ? "bg-red-500 text-white"
                      : "bg-white text-slate-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {s === "ALL" ? "Tất cả" : s === "PAID" ? "Đã đóng" : "Chưa đóng"}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 ml-auto">{filtered.length} thành viên</span>
        </div>
      </div>

      {/* ── Danh sách thu quỹ ── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-sans border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-4 py-3 text-left">Họ tên</th>
                <th className="px-4 py-3 text-left">Chi/Nhánh</th>
                <th className="px-4 py-3 text-right">Định mức phải đóng</th>
                <th className="px-4 py-3 text-right">Đã đóng</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                {isTreasurer && <th className="px-4 py-3 text-center">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 italic">
                    Không tìm thấy thành viên nào.
                  </td>
                </tr>
              ) : filtered.map(m => (
                <tr
                  key={m.id}
                  className={`transition-colors ${
                    m.isPaid
                      ? "bg-emerald-50/40 hover:bg-emerald-50/70"
                      : "hover:bg-slate-50/60"
                  }`}
                >
                  {/* Họ tên */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        m.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {m.fullName.charAt(m.fullName.lastIndexOf(" ") + 1)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{m.fullName}</p>
                        <p className="text-[10px] text-slate-400">Đời {m.generation}</p>
                      </div>
                    </div>
                  </td>

                  {/* Chi/Nhánh */}
                  <td className="px-4 py-3 text-slate-500">
                    {m.branch || `Đời ${m.generation}`}
                  </td>

                  {/* Định mức phải đóng */}
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                    {formatVND(quota)}
                  </td>

                  {/* Đã đóng */}
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    <span className={m.paid > 0 ? "text-emerald-600" : "text-slate-300"}>
                      {m.paid > 0 ? formatVND(m.paid) : "—"}
                    </span>
                  </td>

                  {/* Trạng thái */}
                  <td className="px-4 py-3 text-center">
                    {m.isPaid ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                        <CheckCircle className="w-3 h-3" /> Đã đóng
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-red-50 text-red-600 rounded-full font-medium">
                        <Clock className="w-3 h-3" /> Chưa đóng
                      </span>
                    )}
                  </td>

                  {/* Thao tác */}
                  {isTreasurer && (
                    <td className="px-4 py-3 text-center">
                      {!m.isPaid ? (
                        <button
                          onClick={() => setCollectTarget(m)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Ghi nhận
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-medium flex items-center justify-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Hoàn thành
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Hộp thoại ghi nhận ── */}
      {collectTarget && (
        <CollectDialog
          member={collectTarget}
          quota={quota}
          alreadyPaid={paidByMember[collectTarget.id] ?? 0}
          onConfirm={handleCollect}
          onClose={() => setCollectTarget(null)}
        />
      )}
    </div>
  );
}