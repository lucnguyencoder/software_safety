/**
 * src/pages/ProfilePage.tsx
 * UC: Quản lý Thông tin Dòng họ
 * Workflow: Xem → Chỉnh sửa → Validate → Lưu → Thông báo
 * BR1: Chỉ LEADER được chỉnh sửa
 * BR2: Validate bắt buộc (trừ currentResidenceArea)
 * BR3: Hiệu lực ngay toàn hệ thống sau khi lưu
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen, MapPin, Landmark, Calendar, ShieldCheck, Edit2,
  X, Save, Compass, History, Clock, User, CheckCircle,
  AlertTriangle, Loader2, Home, ScrollText, FileText,
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

const EMPTY_FORM: ClanInfoData = {
  clanName: "",
  originHistory: "",
  homeTown: "",
  currentResidenceArea: "",
  templeAddress: "",
  ancestorDayLunar: "",
  clanRegulations: "",
};

// ─── Toast helper ─────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning";
interface Toast { msg: string; type: ToastType }

function ToastBar({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: "bg-emerald-600 text-white",
    error:   "bg-rose-600 text-white",
    warning: "bg-amber-500 text-white",
  };
  const Icon = toast.type === "success" ? CheckCircle : toast.type === "warning" ? AlertTriangle : AlertTriangle;

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold ${colors[toast.type]} animate-in fade-in slide-in-from-top-2`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      {toast.msg}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Field component ──────────────────────────────────────────────────────────
function InfoField({ icon: Icon, label, value, accent = "slate" }: {
  icon: any; label: string; value?: string | null; accent?: string;
}) {
  const accents: Record<string, string> = {
    slate:  "text-slate-600",
    rose:   "text-rose-700 font-semibold",
    indigo: "text-indigo-700",
    amber:  "text-amber-700",
    emerald:"text-emerald-700",
  };
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${accents[accent]}`} />
      <div className="text-xs min-w-0">
        <div className="font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</div>
        <div className={`font-sans ${accents[accent] || "text-slate-700"} leading-relaxed break-words`}>
          {value || <span className="text-slate-400 italic">Chưa cập nhật</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface ClanProfileViewProps {
  currentAccount: UserAccount;
}

export default function ClanProfileView({ currentAccount }: ClanProfileViewProps) {
  const isLeader = currentAccount.role === UserRole.LEADER;

  // ── State ──────────────────────────────────────────────────────────────────
  const [data, setData]           = useState<ClanInfoData | null>(null);
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData]   = useState<ClanInfoData>(EMPTY_FORM);
  const [errors, setErrors]       = useState<Partial<Record<keyof ClanInfoData, string>>>({});
  const [toast, setToast]         = useState<Toast | null>(null);

  const showToast = (msg: string, type: ToastType = "success") => setToast({ msg, type });

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [info, hist] = await Promise.all([
        clanInfoApi.get(),
        clanInfoApi.history(),
      ]);
      setData(info);
      setHistory(hist || []);
    } catch {
      showToast("Không thể tải thông tin dòng họ.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Open edit form (bước 3-4) ──────────────────────────────────────────────
  const handleOpenEdit = () => {
    setFormData(data ? { ...data } : { ...EMPTY_FORM });
    setErrors({});
    setIsEditing(true);
  };

  // ── Cancel (Alt Flow 6a) ───────────────────────────────────────────────────
  const handleCancel = () => {
    setIsEditing(false);
    setErrors({});
  };

  // ── Validate (S-1) ────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    const required: Array<[keyof ClanInfoData, string]> = [
      ["clanName",        "Tên dòng họ"],
      ["originHistory",   "Nguồn gốc / Lịch sử dòng họ"],
      ["homeTown",        "Quê quán gốc"],
      ["templeAddress",   "Địa chỉ Từ đường"],
      ["ancestorDayLunar","Ngày Giỗ tổ"],
      ["clanRegulations", "Tộc ước / Quy chế dòng họ"],
    ];
    for (const [field, label] of required) {
      if (!String(formData[field] || "").trim()) {
        newErrors[field] = `"${label}" không được để trống.`;
      }
    }
    // Validate định dạng ngày Âm lịch (dd/mm)
    if (formData.ancestorDayLunar && !/^\d{1,2}\/\d{1,2}$/.test(formData.ancestorDayLunar.trim())) {
      newErrors.ancestorDayLunar = "Định dạng không hợp lệ. Nhập theo dạng Ngày/Tháng, ví dụ: 10/03.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Save (bước 6-9) ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await clanInfoApi.update(formData);
      setData(res.data);
      setIsEditing(false);
      showToast("Cập nhật thông tin dòng họ thành công!", "success");
      // Reload history để hiển thị log mới nhất (BR3)
      const hist = await clanInfoApi.history();
      setHistory(hist || []);
    } catch (err: any) {
      showToast(err?.message || "Hệ thống bận, không thể lưu thông tin dòng họ lúc này. Vui lòng thử lại sau.", "error");
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: keyof ClanInfoData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  // ── Input class helper ────────────────────────────────────────────────────
  const inputCls = (field: keyof ClanInfoData) =>
    `w-full border rounded-lg p-2.5 text-xs bg-slate-50 focus:outline-none transition-colors ${
      errors[field]
        ? "border-rose-400 focus:border-rose-500 bg-rose-50/30"
        : "border-slate-200 focus:border-rose-400"
    }`;

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Đang tải thông tin dòng họ...</span>
      </div>
    );
  }

  const regulations = data?.clanRegulations
    ? data.clanRegulations.split(/\n+/).filter(l => l.trim())
    : [];

  return (
    <>
      {toast && <ToastBar toast={toast} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ═══ CỘT TRÁI: Thông tin tổng quan + Form ════════════════════════ */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* ── Header card ── */}
          <div className="bg-gradient-to-br from-amber-50 to-rose-50 border border-rose-100 rounded-2xl px-6 py-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <Landmark className="w-6 h-6" />
              </span>
              <div>
                <h2 className="font-bold text-slate-900 text-base tracking-wide">
                  {data?.clanName || "Thông tin Dòng họ"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Hồ sơ lịch sử phả hệ & tổ đường dòng tộc</p>
              </div>
            </div>
            {isLeader && !isEditing && (
              <button
                onClick={handleOpenEdit}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 shadow-sm cursor-pointer transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa thông tin
              </button>
            )}
          </div>

          {/* ── Edit Form (bước 4-6) ── */}
          {isEditing ? (
            <div className="bg-white border border-rose-100 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <h3 className="font-semibold text-slate-900 text-sm">Chỉnh sửa Thông tin Dòng họ</h3>
                <button onClick={handleCancel} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tên Dòng họ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.clanName}
                    onChange={e => setField("clanName", e.target.value)}
                    className={inputCls("clanName")}
                    placeholder="Ví dụ: Nguyễn Bá Tộc"
                  />
                  {errors.clanName && <p className="text-rose-500 text-[11px] mt-1">{errors.clanName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Quê quán gốc <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.homeTown}
                    onChange={e => setField("homeTown", e.target.value)}
                    className={inputCls("homeTown")}
                    placeholder="Ví dụ: Làng Cổ Am, Vụ Bản, Nam Định"
                  />
                  {errors.homeTown && <p className="text-rose-500 text-[11px] mt-1">{errors.homeTown}</p>}
                </div>
              </div>

              {/* Row 2 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nguồn gốc / Lịch sử dòng họ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={formData.originHistory}
                  onChange={e => setField("originHistory", e.target.value)}
                  className={`${inputCls("originHistory")} resize-none leading-relaxed`}
                  placeholder="Mô tả lai lịch, lịch sử hình thành và phát triển của dòng họ..."
                />
                {errors.originHistory && <p className="text-rose-500 text-[11px] mt-1">{errors.originHistory}</p>}
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Địa bàn cư trú hiện nay
                    <span className="text-slate-400 font-normal ml-1">(không bắt buộc)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.currentResidenceArea || ""}
                    onChange={e => setField("currentResidenceArea", e.target.value)}
                    className={inputCls("currentResidenceArea")}
                    placeholder="Ví dụ: Hà Nội, TP.HCM, Nam Định"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ngày Giỗ tổ (Âm lịch) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.ancestorDayLunar}
                    onChange={e => setField("ancestorDayLunar", e.target.value)}
                    className={inputCls("ancestorDayLunar")}
                    placeholder="Ngày/Tháng — ví dụ: 10/03"
                    maxLength={5}
                  />
                  <p className="text-slate-400 text-[11px] mt-1">Nhập theo định dạng Ngày/Tháng Âm lịch (dd/mm)</p>
                  {errors.ancestorDayLunar && <p className="text-rose-500 text-[11px] mt-0.5">{errors.ancestorDayLunar}</p>}
                </div>
              </div>

              {/* Row 4 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Địa chỉ Từ đường (Nhà thờ tổ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.templeAddress}
                  onChange={e => setField("templeAddress", e.target.value)}
                  className={inputCls("templeAddress")}
                  placeholder="Địa chỉ đầy đủ của từ đường / nhà thờ tổ"
                />
                {errors.templeAddress && <p className="text-rose-500 text-[11px] mt-1">{errors.templeAddress}</p>}
              </div>

              {/* Row 5 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tộc ước / Quy chế dòng họ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={formData.clanRegulations}
                  onChange={e => setField("clanRegulations", e.target.value)}
                  className={`${inputCls("clanRegulations")} resize-none leading-relaxed font-mono`}
                  placeholder={"Mỗi điều khoản một dòng, ví dụ:\nMột lòng hiếu kính cha mẹ, tôn thờ phụng sự tổ tiên.\nKhuyến học khuyến tài, vinh danh con cháu đỗ đạt."}
                />
                <p className="text-slate-400 text-[11px] mt-1">Mỗi điều khoản xuống một dòng (Enter)</p>
                {errors.clanRegulations && <p className="text-rose-500 text-[11px] mt-0.5">{errors.clanRegulations}</p>}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg cursor-pointer disabled:opacity-70 transition-colors"
                >
                  {saving ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang lưu...</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> Lưu thay đổi</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ── View Mode ── */
            <div className="bg-white border border-rose-100 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
              {/* Block thông tin chính */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoField icon={Compass} label="Quê quán gốc" value={data?.homeTown} accent="amber" />
                <InfoField icon={Calendar} label="Ngày Giỗ tổ (Âm lịch)" value={data?.ancestorDayLunar ? `Ngày ${data.ancestorDayLunar} Âm lịch hằng năm` : null} accent="rose" />
                <InfoField icon={MapPin} label="Địa chỉ Từ đường / Nhà thờ tổ" value={data?.templeAddress} accent="indigo" />
                {data?.currentResidenceArea && (
                  <InfoField icon={Home} label="Địa bàn cư trú hiện nay" value={data.currentResidenceArea} accent="emerald" />
                )}
              </div>

              {/* Lịch sử / Nguồn gốc */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Nguồn gốc & Lịch sử dòng họ</span>
                </div>
                <p className="text-xs p-4 bg-amber-50/40 border border-amber-100 rounded-xl italic text-slate-700 leading-relaxed">
                  {data?.originHistory || <span className="text-slate-400">Chưa có thông tin.</span>}
                </p>
              </div>

              {/* Ảnh từ đường */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Hình ảnh từ đường</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=300",
                    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=300",
                    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=300",
                  ].map((src, i) => (
                    <img key={i} src={src} alt="Từ đường" referrerPolicy="no-referrer"
                      className="rounded-lg h-24 w-full object-cover border" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Tộc ước (view mode) ── */}
          {!isEditing && regulations.length > 0 && (
            <div className="bg-white border border-rose-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                <BookOpen className="w-5 h-5 text-rose-700" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Hương ước & Tộc ước dòng họ</h3>
              </div>
              <div className="flex flex-col gap-2.5">
                {regulations.map((reg, idx) => (
                  <div key={idx} className="p-3 bg-rose-50/30 border border-rose-100 rounded-xl flex items-start gap-2.5">
                    <span className="w-5 h-5 bg-rose-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-slate-700 font-sans font-medium leading-relaxed">{reg}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-slate-50 border rounded-xl p-3 text-[10px] text-slate-400 flex items-start gap-1.5 leading-snug">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Tộc phong gia pháp: Bản tộc ước được thông qua và có hiệu lực trên toàn hệ thống.</span>
              </div>
            </div>
          )}

          {/* Thông báo chưa có dữ liệu (lần đầu thiết lập) */}
          {!isEditing && !data && !loading && isLeader && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
              <ScrollText className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-amber-800">Chưa có thông tin dòng họ</p>
              <p className="text-xs text-amber-700 mt-1 mb-4">Đây là lần đầu thiết lập. Vui lòng nhấn "Chỉnh sửa thông tin" để nhập dữ liệu.</p>
              <button onClick={handleOpenEdit} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg cursor-pointer">
                <Edit2 className="w-3.5 h-3.5 inline mr-1" /> Thiết lập ngay
              </button>
            </div>
          )}
        </div>

        {/* ═══ CỘT PHẢI: Lịch sử cập nhật ══════════════════════════════════ */}
        <div className="xl:col-span-1 flex flex-col gap-5">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col gap-4 sticky top-4">
            <div className="flex items-center gap-2 pb-3 border-b">
              <History className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Lịch sử cập nhật</h3>
            </div>

            {history.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Chưa có lịch sử cập nhật.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
                {history.map((h, idx) => {
                  const dt = new Date(h.createdAt);
                  const dateStr = dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
                  const timeStr = dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={h.id} className={`relative pl-4 pb-3 ${idx < history.length - 1 ? "border-b border-dashed border-slate-100" : ""}`}>
                      {/* Timeline dot */}
                      <span className="absolute left-0 top-0.5 w-2 h-2 rounded-full bg-indigo-400 ring-2 ring-white" />
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                        <User className="w-3 h-3" />
                        <span className="font-semibold text-slate-700">{h.actorName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5">
                        <Clock className="w-3 h-3" />
                        <span>{dateStr} lúc {timeStr}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-2 border border-slate-100">
                        {h.changeNote}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Thời gian cập nhật gần nhất */}
            {data?.updatedAt && (
              <div className="pt-3 border-t text-[11px] text-slate-400 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span>Cập nhật lần cuối: <strong className="text-slate-600">{new Date(data.updatedAt).toLocaleString("vi-VN")}</strong> bởi {data.updatedBy}</span>
              </div>
            )}
          </div>

          {/* BR1 notice cho non-LEADER */}
          {!isLeader && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <span>Chỉ <strong>Trưởng họ</strong> mới có quyền chỉnh sửa thông tin dòng họ.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}