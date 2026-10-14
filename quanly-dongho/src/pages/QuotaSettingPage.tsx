/**
 * QuotaSettingPage.tsx
 * Màn hình Thiết lập định mức thu hằng năm
 * Workflow: Ban tài chính → Xem danh sách → Thêm/Chỉnh sửa → Lưu
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings, Plus, Edit2, CheckCircle, Clock, AlertCircle,
  BookOpen, X, Save, Info, TrendingUp, Calendar, FileText,
} from "lucide-react";
import { AnnualQuota, UserRole, UserAccount } from "../types";
import { financeApi } from "../services/api";

interface QuotaSettingPageProps {
  currentAccount: UserAccount;
  annualQuota: AnnualQuota; // Định mức năm hiện tại (từ AppContext)
  onUpdateQuota: (q: AnnualQuota) => Promise<void>;
}

const formatVND = (num: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);

const formatDateTime = (ts?: string) => {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return ts;
  }
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

// ─── SubFlow S-1: Validate dữ liệu ──────────────────────────────────────────
function validateQuotaForm(form: {
  year: number; amountPerMember: number; description: string; notes: string;
}): string | null {
  if (!form.year || form.year < 2000 || form.year > CURRENT_YEAR + 10)
    return `Năm áp dụng phải nằm trong khoảng 2000 – ${CURRENT_YEAR + 10}.`;
  if (!form.amountPerMember || form.amountPerMember <= 0)
    return "Định mức thu phải lớn hơn 0 VNĐ.";
  if (form.amountPerMember > 100_000_000)
    return "Định mức thu không được vượt quá 100,000,000 VNĐ.";
  return null;
}

// ─── Component Modal Form ──────────────────────────────────────────────────
interface QuotaFormModalProps {
  mode: "add" | "edit";
  initialYear?: number;
  initialAmount?: number;
  initialDescription?: string;
  initialNotes?: string;
  existingYears: number[];
  onSave: (data: { year: number; amountPerMember: number; description: string; notes: string }) => Promise<void>;
  onClose: () => void;
}

function QuotaFormModal({
  mode, initialYear, initialAmount, initialDescription, initialNotes,
  existingYears, onSave, onClose,
}: QuotaFormModalProps) {
  const [form, setForm] = useState({
    year: initialYear ?? CURRENT_YEAR,
    amountPerMember: initialAmount ?? 200000,
    description: initialDescription ?? "",
    notes: initialNotes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const err = validateQuotaForm(form);
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (e: any) {
      setError(e?.message ?? "Có lỗi xảy ra khi lưu.");
      setSaving(false);
    }
  };

  // Năm có thể chọn: nếu thêm mới → chỉ những năm chưa tồn tại; nếu sửa → chỉ năm đó
  const availableYears = mode === "add"
    ? YEAR_OPTIONS.filter(y => !existingYears.includes(y))
    : YEAR_OPTIONS;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-rose-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-100 rounded-lg">
              {mode === "add"
                ? <Plus className="w-4 h-4 text-rose-600" />
                : <Edit2 className="w-4 h-4 text-rose-600" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {mode === "add" ? "Thêm mức thu mới" : `Chỉnh sửa định mức năm ${initialYear}`}
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">
                {mode === "add" ? "Dành cho năm chưa thiết lập" : "Cập nhật thông tin định mức"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form body */}
        <div className="px-6 py-5 flex flex-col gap-4 text-xs font-sans">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Năm áp dụng */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Năm áp dụng <span className="text-red-500">*</span>
            </label>
            {mode === "edit" ? (
              <div className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-slate-500 font-mono font-bold">
                {form.year}
              </div>
            ) : (
              <select
                value={form.year}
                onChange={e => setForm({ ...form, year: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                {availableYears.length === 0 ? (
                  <option disabled>Tất cả năm đã được thiết lập</option>
                ) : (
                  availableYears.map(y => (
                    <option key={y} value={y}>
                      {y}{y === CURRENT_YEAR ? " (Năm hiện tại)" : ""}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Định mức thu */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Định mức thu (VNĐ/người) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                step={10000}
                value={form.amountPerMember}
                onChange={e => setForm({ ...form, amountPerMember: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">VNĐ</span>
            </div>
            {form.amountPerMember > 0 && (
              <p className="text-[10px] text-rose-600 mt-1 font-medium">
                ≈ {formatVND(form.amountPerMember)}
              </p>
            )}
          </div>

          {/* Ghi chú / Tiêu chí thu */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Ghi chú / Tiêu chí thu
            </label>
            <textarea
              rows={3}
              placeholder='Ví dụ: "Thu quỹ đinh hằng năm, miễn giảm cho người trên 70 tuổi"'
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-200 rounded-xl p-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* Ghi chú nội bộ */}
          <div>
            <label className="block font-medium text-slate-600 mb-1.5">
              Ghi chú nội bộ (tùy chọn)
            </label>
            <input
              type="text"
              placeholder="Ghi chú bổ sung cho ban tài chính..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-slate-200 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Lưu thiết lập
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function QuotaSettingPage({
  currentAccount, annualQuota, onUpdateQuota,
}: QuotaSettingPageProps) {
  const [quotaList, setQuotaList] = useState<AnnualQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    mode: "add" | "edit";
    target?: AnnualQuota;
  }>({ open: false, mode: "add" });

  const isTreasurer = currentAccount.role === UserRole.TREASURER;

  // ── Load danh sách định mức ──────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.quotaList();
      // Merge: nếu năm hiện tại chưa có trong DB, thêm từ annualQuota prop
      const list: AnnualQuota[] = res?.data ?? [];
      const hasCurrentYear = list.some(q => q.year === CURRENT_YEAR);
      if (!hasCurrentYear && annualQuota) {
        list.unshift({ ...annualQuota, year: CURRENT_YEAR });
      }
      setQuotaList(list);
    } catch {
      // Fallback: dùng annualQuota prop
      setQuotaList(annualQuota ? [annualQuota] : []);
    } finally {
      setLoading(false);
    }
  }, [annualQuota]);

  useEffect(() => { loadList(); }, [loadList]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Lưu định mức ───────────────────────────────────────────────────────
  const handleSave = async (data: {
    year: number; amountPerMember: number; description: string; notes: string;
  }) => {
    await onUpdateQuota({
      year: data.year,
      amountPerMember: data.amountPerMember,
      description: data.description,
      notes: data.notes,
    });
    setModal({ open: false, mode: "add" });
    setToast({ msg: `Thiết lập mức thu năm ${data.year} thành công!`, ok: true });
    await loadList();
  };

  const existingYears = quotaList.map(q => q.year);
  const currentYearQuota = quotaList.find(q => q.year === CURRENT_YEAR);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Toast thông báo ── */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
            ${toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
        >
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-xl">
            <Settings className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base">Thiết lập định mức thu hằng năm</h2>
            <p className="text-xs text-slate-500 mt-0.5">Quản lý mức thu niên liễm theo từng năm tài chính</p>
          </div>
        </div>
        {isTreasurer && (
          <button
            onClick={() => setModal({ open: true, mode: "add" })}
            disabled={existingYears.length >= YEAR_OPTIONS.length}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm mức thu mới
          </button>
        )}
      </div>

      {/* ── Bảng danh sách định mức ── */}
      <div className="bg-white border border-rose-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-rose-500" />
          <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
            Danh sách định mức thu hằng năm
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
            <span className="w-4 h-4 border-2 border-rose-300 border-t-transparent rounded-full animate-spin" />
            Đang tải dữ liệu...
          </div>
        ) : quotaList.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            <Settings className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Chưa có định mức nào được thiết lập.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-sans border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-3 text-left">Năm áp dụng</th>
                  <th className="px-5 py-3 text-right">Định mức thu</th>
                  <th className="px-5 py-3 text-left">Ghi chú / Tiêu chí</th>
                  <th className="px-5 py-3 text-center">Trạng thái</th>
                  <th className="px-5 py-3 text-left">Cập nhật lần cuối</th>
                  {isTreasurer && <th className="px-5 py-3 text-center">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {quotaList.map(q => {
                  const isCurrent = q.year === CURRENT_YEAR;
                  const isPast = q.year < CURRENT_YEAR;
                  return (
                    <tr
                      key={q.year}
                      className={`hover:bg-rose-50/30 transition-colors ${isCurrent ? "bg-rose-50/20" : ""}`}
                    >
                      {/* Năm */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Calendar className={`w-3.5 h-3.5 ${isCurrent ? "text-rose-500" : "text-slate-300"}`} />
                          <span className={`font-mono font-bold ${isCurrent ? "text-rose-700" : "text-slate-700"}`}>
                            {q.year}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded font-bold">
                              NĂM NAY
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Định mức */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {formatVND(q.amountPerMember)}
                        </span>
                      </td>

                      {/* Ghi chú */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <p className="text-slate-600 truncate" title={q.description}>
                          {q.description || <span className="text-slate-300 italic">Chưa có ghi chú</span>}
                        </p>
                        {q.notes && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5 truncate">{q.notes}</p>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-5 py-3.5 text-center">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                            <CheckCircle className="w-3 h-3" /> Hiện tại
                          </span>
                        ) : isPast ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-full font-medium">
                            <Clock className="w-3 h-3" /> Đã áp dụng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded-full font-medium">
                            <TrendingUp className="w-3 h-3" /> Sắp áp dụng
                          </span>
                        )}
                      </td>

                      {/* Cập nhật */}
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[10px]">
                        {formatDateTime(q.updatedAt)}
                      </td>

                      {/* Thao tác */}
                      {isTreasurer && (
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => setModal({ open: true, mode: "edit", target: q })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <Edit2 className="w-3 h-3" /> Chỉnh sửa
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Hướng dẫn thao tác ── */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-blue-800 text-xs uppercase tracking-wider">
            Hướng dẫn thao tác
          </span>
        </div>
        <ul className="text-xs text-blue-700 space-y-1.5 font-sans">
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-bold text-[9px] mt-0.5 shrink-0">1</span>
            <span>Nhấn <strong>"Thêm mức thu mới"</strong> để thiết lập định mức cho năm chưa có trong danh sách.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-bold text-[9px] mt-0.5 shrink-0">2</span>
            <span>Nhấn <strong>"Chỉnh sửa"</strong> ở hàng tương ứng để cập nhật định mức đã thiết lập.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-bold text-[9px] mt-0.5 shrink-0">3</span>
            <span>Nhập <strong>số tiền định mức</strong> và <strong>ghi chú tiêu chí thu</strong>, sau đó nhấn "Lưu thiết lập".</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-bold text-[9px] mt-0.5 shrink-0">4</span>
            <span>Hệ thống xác thực dữ liệu và cập nhật danh sách ngay sau khi lưu thành công.</span>
          </li>
        </ul>
      </div>

      {/* ── Tóm tắt nhanh năm hiện tại ── */}
      {currentYearQuota && (
        <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-rose-500" />
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Tóm tắt nhanh — Mức thu năm {CURRENT_YEAR}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-rose-50 rounded-xl p-4 text-center">
              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mb-1">Định mức / người</p>
              <p className="text-xl font-mono font-bold text-rose-700">{formatVND(currentYearQuota.amountPerMember)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Năm áp dụng</p>
              <p className="text-xl font-mono font-bold text-slate-700">{currentYearQuota.year}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Trạng thái</p>
              <p className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-1 mt-1">
                <CheckCircle className="w-4 h-4" /> Đang áp dụng
              </p>
            </div>
          </div>
          {currentYearQuota.description && (
            <p className="mt-3 text-xs text-slate-500 italic border-t border-slate-100 pt-3">
              📌 {currentYearQuota.description}
            </p>
          )}
        </div>
      )}

      {/* ── Modal form ── */}
      {modal.open && (
        <QuotaFormModal
          mode={modal.mode}
          initialYear={modal.target?.year}
          initialAmount={modal.target?.amountPerMember}
          initialDescription={modal.target?.description}
          initialNotes={modal.target?.notes}
          existingYears={existingYears}
          onSave={handleSave}
          onClose={() => setModal({ open: false, mode: "add" })}
        />
      )}
    </div>
  );
}