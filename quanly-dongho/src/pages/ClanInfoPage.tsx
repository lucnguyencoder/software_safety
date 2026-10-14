/**
 * src/pages/ClanInfoPage.tsx
 * Quản lý Thông tin Dòng họ — chỉ Trưởng họ truy cập
 * Các trường: Tên dòng họ, Địa chỉ Từ đường, Nguồn gốc lịch sử, Tộc ước
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Edit2, Save, X, Loader2, CheckCircle, AlertTriangle,
  Landmark, MapPin, ScrollText, BookOpen, History,
  Clock, User, FileText, Home, ShieldCheck,
} from "lucide-react";
import { UserAccount, UserRole } from "../types";
import { clanInfoApi } from "../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClanInfoData {
  id?: number;
  clanId?: string;
  clanName: string;
  originHistory: string;
  homeTown: string;
  currentResidenceArea?: string;
  templeAddress: string;
  ancestorDayLunar: string;
  clanRegulations: string;
  updatedAt?: string;
  updatedBy?: string;
}

interface HistoryEntry {
  id: number;
  actorName: string;
  changeNote: string;
  createdAt: string;
}

const EMPTY: ClanInfoData = {
  clanName: "", originHistory: "", homeTown: "",
  currentResidenceArea: "", templeAddress: "",
  ancestorDayLunar: "", clanRegulations: "",
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${type === "success" ? "bg-emerald-600" : "bg-rose-600"}`}>
      {type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ClanInfoPage({ currentAccount }: { currentAccount: UserAccount }) {
  const isLeader = currentAccount.role === UserRole.LEADER;

  const [data, setData]           = useState<ClanInfoData | null>(null);
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm]           = useState<ClanInfoData>(EMPTY);
  const [errors, setErrors]       = useState<Partial<Record<keyof ClanInfoData, string>>>({});
  const [toast, setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => setToast({ msg, type });

  // Load
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [info, hist] = await Promise.all([clanInfoApi.get(), clanInfoApi.history()]);
      setData(info);
      setHistory(hist || []);
    } catch {
      showToast("Không thể tải thông tin dòng họ.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Open edit
  const openEdit = () => {
    setForm(data ? { ...data } : { ...EMPTY });
    setErrors({});
    setIsEditing(true);
  };

  // Cancel
  const cancel = () => { setIsEditing(false); setErrors({}); };

  // Validate
  const validate = (): boolean => {
    const e: typeof errors = {};
    const required: Array<[keyof ClanInfoData, string]> = [
      ["clanName",        "Tên dòng họ"],
      ["originHistory",   "Nguồn gốc / Lịch sử dòng họ"],
      ["homeTown",        "Quê quán gốc"],
      ["templeAddress",   "Địa chỉ Từ đường"],
      ["ancestorDayLunar","Ngày Giỗ tổ"],
      ["clanRegulations", "Tộc ước / Quy chế"],
    ];
    for (const [f, label] of required) {
      if (!String(form[f] || "").trim()) e[f] = `"${label}" không được để trống.`;
    }
    if (form.ancestorDayLunar && !/^\d{1,2}\/\d{1,2}$/.test(form.ancestorDayLunar.trim())) {
      e.ancestorDayLunar = "Nhập theo định dạng Ngày/Tháng, ví dụ: 10/03";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Save
  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await clanInfoApi.update(form);
      setData(res.data);
      setIsEditing(false);
      showToast("Cập nhật thông tin dòng họ thành công!");
      const hist = await clanInfoApi.history();
      setHistory(hist || []);
    } catch (err: any) {
      showToast(err?.message || "Hệ thống bận, không thể lưu lúc này. Vui lòng thử lại sau.", "error");
    } finally {
      setSaving(false);
    }
  };

  const set = (f: keyof ClanInfoData, v: string) => {
    setForm(p => ({ ...p, [f]: v }));
    if (errors[f]) setErrors(p => ({ ...p, [f]: undefined }));
  };

  const inp = (f: keyof ClanInfoData) =>
    `w-full border rounded-lg p-2.5 text-xs bg-slate-50 focus:outline-none transition-colors ${
      errors[f] ? "border-rose-400 bg-rose-50/30" : "border-slate-200 focus:border-amber-400"
    }`;

  const regulations = data?.clanRegulations
    ? data.clanRegulations.split(/\n+/).filter(l => l.trim())
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Đang tải thông tin dòng họ...</span>
      </div>
    );
  }

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-lg">Thông tin Dòng họ</h1>
            <p className="text-xs text-slate-500">Quản lý hồ sơ cơ bản của dòng tộc</p>
          </div>
        </div>
        {isLeader && !isEditing && (
          <button onClick={openEdit}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow cursor-pointer transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa thông tin
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ═══ CỘT TRÁI ═════════════════════════════════════════════════════ */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {isEditing ? (
            /* ── FORM CHỈNH SỬA ── */
            <div className="bg-white border border-amber-100 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
              <div className="flex justify-between items-center pb-3 border-b">
                <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  Chỉnh sửa Thông tin Dòng họ
                </h2>
                <button onClick={cancel} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Tên dòng họ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tên Dòng họ <span className="text-rose-500">*</span>
                </label>
                <input type="text" value={form.clanName} onChange={e => set("clanName", e.target.value)}
                  className={inp("clanName")} placeholder="Ví dụ: Nguyễn Bá Tộc" />
                {errors.clanName && <p className="text-rose-500 text-[11px] mt-1">{errors.clanName}</p>}
              </div>

              {/* Địa chỉ Từ đường */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Địa chỉ Từ đường (Nhà thờ tổ) <span className="text-rose-500">*</span>
                </label>
                <input type="text" value={form.templeAddress} onChange={e => set("templeAddress", e.target.value)}
                  className={inp("templeAddress")} placeholder="Địa chỉ đầy đủ của từ đường / nhà thờ tổ" />
                {errors.templeAddress && <p className="text-rose-500 text-[11px] mt-1">{errors.templeAddress}</p>}
              </div>

              {/* Quê quán + Ngày giỗ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Quê quán gốc <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" value={form.homeTown} onChange={e => set("homeTown", e.target.value)}
                    className={inp("homeTown")} placeholder="Ví dụ: Làng Cổ Am, Vụ Bản, Nam Định" />
                  {errors.homeTown && <p className="text-rose-500 text-[11px] mt-1">{errors.homeTown}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ngày Giỗ tổ (Âm lịch) <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" value={form.ancestorDayLunar} onChange={e => set("ancestorDayLunar", e.target.value)}
                    className={inp("ancestorDayLunar")} placeholder="Ngày/Tháng — ví dụ: 10/03" maxLength={5} />
                  <p className="text-slate-400 text-[11px] mt-1">Định dạng dd/mm Âm lịch</p>
                  {errors.ancestorDayLunar && <p className="text-rose-500 text-[11px] mt-0.5">{errors.ancestorDayLunar}</p>}
                </div>
              </div>

              {/* Địa bàn cư trú (không bắt buộc) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Địa bàn cư trú hiện nay
                  <span className="text-slate-400 font-normal ml-1">(không bắt buộc)</span>
                </label>
                <input type="text" value={form.currentResidenceArea || ""} onChange={e => set("currentResidenceArea", e.target.value)}
                  className={inp("currentResidenceArea")} placeholder="Ví dụ: Hà Nội, TP.HCM, Nam Định" />
              </div>

              {/* Nguồn gốc / Lịch sử */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nguồn gốc / Lịch sử dòng họ <span className="text-rose-500">*</span>
                </label>
                <textarea rows={5} value={form.originHistory} onChange={e => set("originHistory", e.target.value)}
                  className={`${inp("originHistory")} resize-none leading-relaxed`}
                  placeholder="Mô tả lai lịch, lịch sử hình thành và phát triển của dòng họ..." />
                {errors.originHistory && <p className="text-rose-500 text-[11px] mt-1">{errors.originHistory}</p>}
              </div>

              {/* Tộc ước */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tộc ước / Quy chế dòng họ <span className="text-rose-500">*</span>
                </label>
                <textarea rows={6} value={form.clanRegulations} onChange={e => set("clanRegulations", e.target.value)}
                  className={`${inp("clanRegulations")} resize-none leading-relaxed font-mono`}
                  placeholder={"Mỗi điều khoản một dòng, ví dụ:\nMột lòng hiếu kính cha mẹ, tôn thờ tổ tiên.\nKhuyến học khuyến tài, vinh danh con cháu."} />
                <p className="text-slate-400 text-[11px] mt-1">Mỗi điều khoản xuống một dòng (Enter)</p>
                {errors.clanRegulations && <p className="text-rose-500 text-[11px] mt-0.5">{errors.clanRegulations}</p>}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button onClick={cancel} disabled={saving}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-50">
                  Hủy
                </button>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-70 transition-colors">
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang lưu...</> : <><Save className="w-3.5 h-3.5" /> Lưu thay đổi</>}
                </button>
              </div>
            </div>
          ) : (
            /* ── VIEW MODE ── */
            <>
              {/* Thông tin cơ bản */}
              <div className="bg-white border border-amber-100 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wide border-b pb-3 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-amber-700" />
                  {data?.clanName || <span className="text-slate-400 italic">Chưa có tên dòng họ</span>}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Địa chỉ từ đường */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold text-slate-500 uppercase tracking-wider mb-1">Địa chỉ Từ đường</div>
                      <div className="text-slate-700 font-medium leading-relaxed">
                        {data?.templeAddress || <span className="text-slate-400 italic">Chưa cập nhật</span>}
                      </div>
                    </div>
                  </div>

                  {/* Ngày giỗ tổ */}
                  <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-xl flex items-start gap-3">
                    <Clock className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold text-slate-500 uppercase tracking-wider mb-1">Ngày Giỗ tổ (Âm lịch)</div>
                      <div className="text-rose-700 font-semibold">
                        {data?.ancestorDayLunar
                          ? `Ngày ${data.ancestorDayLunar} Âm lịch hằng năm`
                          : <span className="text-slate-400 italic font-normal">Chưa cập nhật</span>}
                      </div>
                    </div>
                  </div>

                  {/* Quê quán */}
                  <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-xl flex items-start gap-3">
                    <Home className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold text-slate-500 uppercase tracking-wider mb-1">Quê quán gốc</div>
                      <div className="text-slate-700">
                        {data?.homeTown || <span className="text-slate-400 italic">Chưa cập nhật</span>}
                      </div>
                    </div>
                  </div>

                  {/* Địa bàn cư trú */}
                  {data?.currentResidenceArea && (
                    <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <div className="font-bold text-slate-500 uppercase tracking-wider mb-1">Địa bàn cư trú</div>
                        <div className="text-slate-700">{data.currentResidenceArea}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Nguồn gốc lịch sử */}
              <div className="bg-white border border-amber-100 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                  <ScrollText className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Nguồn gốc & Lịch sử dòng họ</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-700 p-4 bg-amber-50/30 border border-amber-100 rounded-xl italic">
                  {data?.originHistory || <span className="text-slate-400">Chưa có thông tin lịch sử.</span>}
                </p>
              </div>

              {/* Tộc ước */}
              {regulations.length > 0 && (
                <div className="bg-white border border-amber-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                    <BookOpen className="w-4 h-4 text-rose-700" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Tộc ước & Quy chế dòng họ</h3>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {regulations.map((reg, idx) => (
                      <div key={idx} className="p-3 bg-rose-50/30 border border-rose-100 rounded-xl flex items-start gap-2.5">
                        <span className="w-5 h-5 bg-rose-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed">{reg}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 bg-slate-50 border rounded-xl p-3 text-[10px] text-slate-400 flex items-start gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>Tộc phong gia pháp: Bản tộc ước có hiệu lực trên toàn hệ thống sau khi lưu.</span>
                  </div>
                </div>
              )}

              {/* Banner chưa có dữ liệu */}
              {!data && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
                  <Landmark className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-amber-800 mb-1">Chưa có thông tin dòng họ</p>
                  <p className="text-xs text-amber-700 mb-4">Nhấn "Chỉnh sửa thông tin" để nhập dữ liệu lần đầu.</p>
                  <button onClick={openEdit}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg cursor-pointer">
                    <Edit2 className="w-3.5 h-3.5 inline mr-1" /> Thiết lập ngay
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ CỘT PHẢI: Lịch sử cập nhật ══════════════════════════════════ */}
        <div className="xl:col-span-1">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm sticky top-4">
            <div className="flex items-center gap-2 pb-3 border-b mb-4">
              <History className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Lịch sử cập nhật</h3>
            </div>

            {history.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Chưa có lịch sử cập nhật.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
                {history.map((h, idx) => {
                  const dt = new Date(h.createdAt);
                  return (
                    <div key={h.id} className={`relative pl-4 pb-3 ${idx < history.length - 1 ? "border-b border-dashed border-slate-100" : ""}`}>
                      <span className="absolute left-0 top-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white" />
                      <div className="flex items-center gap-1 text-[11px] text-slate-700 font-semibold mb-0.5">
                        <User className="w-3 h-3 text-slate-400" />
                        {h.actorName}
                      </div>
                      <div className="text-[11px] text-slate-400 mb-1.5">
                        {dt.toLocaleDateString("vi-VN")} lúc {dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <p className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100 leading-relaxed">
                        {h.changeNote}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {data?.updatedAt && (
              <div className="pt-3 mt-2 border-t text-[11px] text-slate-400 flex items-start gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Cập nhật cuối: <strong className="text-slate-600">{new Date(data.updatedAt).toLocaleString("vi-VN")}</strong> bởi {data.updatedBy}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}