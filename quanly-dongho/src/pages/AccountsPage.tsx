/**
 * src/pages/AccountsPage.tsx
 * Quản lý tài khoản theo đúng phân quyền:
 * - ADMIN: duyệt kỹ thuật, tạo TK Trưởng họ, duyệt/từ chối yêu cầu xóa, khóa/mở khóa
 * - LEADER: phê duyệt vào dòng họ, phân quyền, sửa, vô hiệu hóa, yêu cầu xóa
 */
import React, { useState, useEffect } from "react";
import {
  Shield, UserCheck, Users, FileText, Plus, Check, X,
  Lock, Unlock, Edit2, Trash2, CheckCircle2, AlertTriangle,
  Eye, Key, Copy, RefreshCw
} from "lucide-react";
import { UserAccount, AccountStatus, UserRole, AuditLog, ClanMember } from "../types";
import { inviteCodesApi, accountsApi, authApi } from "../services/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const roleLabel: Record<string, string> = {
  ADMIN: "Quản trị viên", LEADER: "Trưởng họ",
  TREASURER: "Ban tài chính", MEMBER: "Thành viên", GUEST: "Khách vãng lai",
};

function StatusBadge({ status }: { status: AccountStatus }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING_ADMIN:  { label: "Chờ Admin duyệt",     cls: "bg-amber-100 text-amber-800" },
    PENDING_LEADER: { label: "Chờ Trưởng họ duyệt", cls: "bg-blue-100 text-blue-800" },
    ACTIVE:         { label: "Hoạt động",            cls: "bg-emerald-100 text-emerald-800" },
    BLOCKED:        { label: "Đã khóa",              cls: "bg-red-100 text-red-800" },
    REJECTED:       { label: "Đã từ chối",           cls: "bg-slate-100 text-slate-600" },
    PENDING_DELETE: { label: "Chờ Admin duyệt xóa",  cls: "bg-orange-100 text-orange-800" },
  };
  const s = map[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

// ─── Card hồ sơ tài khoản ─────────────────────────────────────────────────────
function ProfileCard({ acc }: { acc: UserAccount }) {
  return (
    <div className="space-y-1 text-xs">
      <p className="font-bold text-slate-800">{acc.fullName}</p>
      <p className="text-slate-500">📞 {acc.phone}{acc.email ? ` · ✉️ ${acc.email}` : ""}</p>
      {acc.birthDate && <p className="text-slate-500">🎂 {acc.birthDate ? new Date(acc.birthDate).toLocaleDateString("vi-VN") : ""} · {acc.gender === "MALE" ? "Nam" : "Nữ"}</p>}
      {acc.hometown && <p className="text-slate-500">🏡 {acc.hometown}</p>}
      {acc.address && <p className="text-slate-500">📍 {acc.address}</p>}
      <p className="font-mono text-[10px] text-[#8c4f2b] font-bold">Mã mời: {acc.inviteCode}</p>
      {acc.notes && (
        <p className="italic text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1 mt-1">"{acc.notes}"</p>
      )}
      {acc.rejectionReason && (
        <p className="text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 text-[10px]">⚠️ {acc.rejectionReason}</p>
      )}
    </div>
  );
}

// ─── Modal tạo tài khoản Trưởng họ ───────────────────────────────────────────
function CreateLeaderModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", password: "", confirmPassword: "", clanName: "", clanOrigin: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState(0);

  const calcStrength = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === "password") setStrength(calcStrength(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.password) return setError("Vui lòng điền đủ các trường bắt buộc.");
    if (form.password.length < 8 || !/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password))
      return setError("Mật khẩu phải ≥8 ký tự, gồm chữ và số.");
    if (form.password !== form.confirmPassword) return setError("Mật khẩu xác nhận không khớp.");
    setLoading(true);
    try { await onSubmit(form); } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const sColor = ["", "bg-red-400", "bg-amber-400", "bg-blue-500", "bg-emerald-500"][strength];
  const sLabel = ["", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"][strength];
  const sText  = ["", "text-red-500", "text-amber-500", "text-blue-500", "text-emerald-500"][strength];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-slate-800 text-sm">Tạo tài khoản Trưởng họ</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3 leading-relaxed">
            Tài khoản Trưởng họ được cấp <strong>toàn quyền quản lý dòng họ</strong> ngay sau khi tạo. Mỗi Trưởng họ quản lý một dòng họ riêng biệt.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tên dòng họ *</label>
            <input type="text" placeholder="VD: Nguyễn Bá Tộc, Trần Văn Tộc..." value={form.clanName}
              onChange={e => set("clanName", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Quê quán / Nguồn gốc</label>
            <input type="text" placeholder="VD: Làng X, huyện Y, tỉnh Z" value={form.clanOrigin}
              onChange={e => set("clanOrigin", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          {[
            { label: "Họ và tên *", key: "fullName", type: "text", placeholder: "Nguyễn Bá ..." },
            { label: "Số điện thoại *", key: "phone", type: "tel", placeholder: "09xxxxxxxx" },
            { label: "Email", key: "email", type: "email", placeholder: "email@gmail.com" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={(form as any)[f.key]}
                onChange={e => set(f.key, e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Mật khẩu *</label>
            <input type="password" value={form.password} onChange={e => set("password", e.target.value)}
              placeholder="≥8 ký tự, gồm chữ + số"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            {form.password && (
              <div className="mt-1.5">
                <div className="flex gap-1 h-1.5">
                  {[1,2,3,4].map(i => <div key={i} className={`flex-1 rounded-full ${i <= strength ? sColor : "bg-slate-100"}`} />)}
                </div>
                <p className={`text-[10px] mt-0.5 font-semibold ${sText}`}>{sLabel}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Xác nhận mật khẩu *</label>
            <input type="password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)}
              placeholder="Nhập lại mật khẩu"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Hủy</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer">
              {loading ? "Đang tạo..." : "Khởi tạo tài khoản"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal phê duyệt Trưởng họ (UC1.3) ───────────────────────────────────────
function LeaderApproveModal({ account, onClose, onApprove, onReject }: {
  account: UserAccount;
  onClose: () => void;
  onApprove: (role: UserRole) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.MEMBER);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-slate-800 text-sm">Phê duyệt & Phân quyền</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4"><ProfileCard acc={account} /></div>

          {!rejectMode ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Phân quyền nghiệp vụ <span className="text-slate-400 font-normal">(mặc định: Thành viên)</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { role: UserRole.MEMBER,    label: "Thành viên",    desc: "Xem, tra cứu" },
                    { role: UserRole.TREASURER, label: "Ban tài chính", desc: "Quản lý quỹ" },
                  ] as { role: UserRole; label: string; desc: string }[]).map(r => (
                    <div key={r.role} onClick={() => setSelectedRole(r.role)}
                      className={`p-3 border-2 rounded-xl cursor-pointer transition-colors ${selectedRole === r.role ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <p className="text-xs font-bold text-slate-800">{r.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{r.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setRejectMode(true)}
                  className="flex-1 py-2.5 border-2 border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 cursor-pointer">
                  Từ chối
                </button>
                <button onClick={async () => { setLoading(true); await onApprove(selectedRole); setLoading(false); }}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" /> {loading ? "Đang duyệt..." : "Phê duyệt & Phân quyền"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lý do từ chối <span className="text-red-500">*</span></label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Nhập lý do từ chối rõ ràng..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 h-24 resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setRejectMode(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Quay lại</button>
                <button onClick={async () => { if (!reason.trim()) return; setLoading(true); await onReject(reason); setLoading(false); }}
                  disabled={!reason.trim() || loading}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer">
                  {loading ? "Đang gửi..." : "Xác nhận từ chối"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal sửa thông tin tài khoản (Trưởng họ) ───────────────────────────────
function EditAccountModal({ account, onClose, onSave }: {
  account: UserAccount;
  onClose: () => void;
  onSave: (data: Partial<UserAccount>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    fullName: account.fullName, phone: account.phone, email: account.email || "",
    birthDate: account.birthDate || "", gender: account.gender || "MALE",
    hometown: account.hometown || "", address: account.address || "",
    notes: account.notes || "", role: account.role || UserRole.MEMBER,
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Sửa thông tin tài khoản</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{account.fullName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Họ và tên *</label>
              <input value={form.fullName} onChange={e => set("fullName", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30" />
            </div>

            {/* Đổi vai trò — chỉ cho phép đổi giữa MEMBER và TREASURER, không đổi thành LEADER */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Vai trò</label>
              {account.role === UserRole.LEADER ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-sm font-semibold text-slate-700">Trưởng họ</span>
                  <span className="text-[11px] text-slate-400">— Toàn quyền · Không thể thay đổi</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { role: UserRole.MEMBER,    label: "Thành viên",    desc: "Xem, tra cứu" },
                    { role: UserRole.TREASURER, label: "Ban tài chính", desc: "Quản lý quỹ" },
                  ] as { role: UserRole; label: string; desc: string }[]).map(r => (
                    <div key={r.role} onClick={() => set("role", r.role)}
                      className={`p-2.5 border-2 rounded-xl cursor-pointer transition-colors ${form.role === r.role ? "border-[#8c4f2b] bg-amber-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <p className="text-xs font-bold text-slate-800">{r.label}</p>
                      <p className="text-[10px] text-slate-500">{r.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">SĐT</label>
              <input value={form.phone} onChange={e => set("phone", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
              <input value={form.email} onChange={e => set("email", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày sinh</label>
              <input type="date" value={form.birthDate} onChange={e => set("birthDate", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Giới tính</label>
              <select value={form.gender} onChange={e => set("gender", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Quê quán</label>
              <input value={form.hometown} onChange={e => set("hometown", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Địa chỉ hiện tại</label>
              <input value={form.address} onChange={e => set("address", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ghi chú</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none h-16 resize-none" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Hủy</button>
            <button onClick={async () => { setLoading(true); await onSave(form as any); setLoading(false); onClose(); }}
              disabled={loading}
              className="flex-1 py-2 bg-[#8c4f2b] hover:bg-[#7a4425] disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer">
              {loading ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal yêu cầu xóa (Trưởng họ) ───────────────────────────────────────────
function RequestDeleteModal({ account, onClose, onConfirm }: {
  account: UserAccount;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-slate-800 text-sm">Yêu cầu xóa tài khoản</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700 leading-relaxed">
              Yêu cầu xóa sẽ được gửi tới <strong>Admin</strong> để xét duyệt. Admin sẽ xóa tài khoản khỏi gia phả và database nếu đồng ý.
            </p>
          </div>
          <div className="bg-slate-50 border rounded-xl p-3 text-xs">
            <p className="font-bold text-slate-800">{account.fullName}</p>
            <p className="text-slate-500">{account.phone} · {roleLabel[account.role]}</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lý do yêu cầu xóa <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Vd: Tài khoản trùng lặp, sai thông tin, yêu cầu rời dòng họ..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 h-20 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Hủy</button>
            <button onClick={async () => { if (!reason.trim()) return; setLoading(true); await onConfirm(reason); setLoading(false); onClose(); }}
              disabled={!reason.trim() || loading}
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer">
              {loading ? "Đang gửi..." : "Gửi yêu cầu xóa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal hiển thị mật khẩu tạm thời sau khi Admin cấp lại (Flow D - D5) ────
function TempPasswordResultModal({ fullName, tempPassword, onClose }: {
  fullName: string; tempPassword: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-600" /> Đã cấp mật khẩu tạm thời
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600">
            Mật khẩu tạm thời cho tài khoản <strong>{fullName}</strong>. Hệ thống chỉ hiển thị <strong>một lần duy nhất</strong> —
            hãy thông báo ngay cho người dùng qua kênh liên hệ ngoài hệ thống (gọi điện, tin nhắn...).
          </p>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <code className="flex-1 font-mono font-bold text-emerald-800 text-base tracking-wide">{tempPassword}</code>
            <button onClick={handleCopy} className="p-2 hover:bg-emerald-100 rounded-lg text-emerald-700 cursor-pointer" title="Sao chép">
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Người dùng sẽ bị bắt buộc đổi mật khẩu ngay trong lần đăng nhập kế tiếp.
            </p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer">
            Đã thông báo cho người dùng, đóng lại
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface AccountManagerProps {
  accounts: UserAccount[];
  members: ClanMember[];
  currentAccount: UserAccount;
  auditLogs: AuditLog[];
  onApproveByAdmin: (id: string) => Promise<void>;
  onRejectByAdmin: (id: string, reason: string) => Promise<void>;
  onToggleBlockAccount: (id: string, isBlocking: boolean, reason?: string) => Promise<void>;
  onAddGuestAccount: (data: any) => Promise<any>;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  refreshAccounts?: () => Promise<void>;
  onApproveByLeader?: (id: string, role: UserRole, memberId?: string) => Promise<void>;
  onRequestDeleteAccount?: (id: string, reason: string) => Promise<void>;
  onApproveDeleteAccount?: (id: string) => Promise<void>;
  onRejectDeleteAccount?: (id: string, reason: string) => Promise<void>;
  onEditAccount?: (id: string, data: Partial<UserAccount>) => Promise<void>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AccountManager({
  accounts, members, currentAccount, auditLogs,
  onApproveByAdmin, onRejectByAdmin, onToggleBlockAccount,
  onAddGuestAccount, onApproveByLeader,
  onRequestDeleteAccount, onApproveDeleteAccount, onRejectDeleteAccount, onEditAccount,
  refreshAccounts,
}: AccountManagerProps) {
  const isAdmin  = currentAccount.role === UserRole.ADMIN;
  const isLeader = currentAccount.role === UserRole.LEADER;

  const [showCreateLeader, setShowCreateLeader] = useState(false);
  const [approveTarget, setApproveTarget]       = useState<UserAccount | null>(null);
  const [editTarget, setEditTarget]             = useState<UserAccount | null>(null);
  const [deleteTarget, setDeleteTarget]         = useState<UserAccount | null>(null);
  const [toast, setToast]                       = useState("");

  // Mã mời
  const [inviteCodes, setInviteCodes]           = useState<any[]>([]);
  const [showInvitePanel, setShowInvitePanel]   = useState(false);
  const [newCodeNote, setNewCodeNote]           = useState("");
  const [creatingCode, setCreatingCode]         = useState(false);
  const [copiedCode, setCopiedCode]             = useState("");

  // Yêu cầu cấp lại mật khẩu (Flow D — quên mật khẩu)
  const [resetRequests, setResetRequests]       = useState<any[]>([]);
  const [loadingResets, setLoadingResets]       = useState(false);
  const [processingResetId, setProcessingResetId] = useState<string | number | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<{ fullName: string; tempPassword: string } | null>(null);

  const loadResetRequests = async () => {
    setLoadingResets(true);
    try {
      const data = await authApi.getPasswordResetRequests();
      setResetRequests(data);
    } catch {
      // Không chặn UI nếu tải thất bại — Admin có thể bấm làm mới lại
    }
    setLoadingResets(false);
  };

  useEffect(() => {
    if (isAdmin) loadResetRequests();
  }, [isAdmin]);

  const handleProcessReset = async (req: any) => {
    if (!window.confirm(`Cấp mật khẩu tạm thời mới cho "${req.fullName}"? Mật khẩu hiện tại của họ sẽ không còn dùng được.`)) return;
    setProcessingResetId(req.id);
    try {
      const res = await authApi.processPasswordReset(req.id);
      setTempPasswordResult({ fullName: req.fullName, tempPassword: res.tempPassword });
      await loadResetRequests();
    } catch (e: any) {
      showToast(`❌ ${e.message}`);
    }
    setProcessingResetId(null);
  };

  const handleRejectReset = async (req: any) => {
    const reason = window.prompt(`Lý do từ chối yêu cầu cấp lại mật khẩu của "${req.fullName}":`);
    if (!reason) return;
    try {
      await authApi.rejectPasswordReset(req.id, reason);
      await loadResetRequests();
      showToast(`Đã từ chối yêu cầu cấp lại mật khẩu của ${req.fullName}`);
    } catch (e: any) {
      showToast(`❌ ${e.message}`);
    }
  };

  const pendingResetRequests = resetRequests.filter(r => r.status === "PENDING");

  useEffect(() => {
    if ((isLeader || isAdmin) && showInvitePanel) {
      inviteCodesApi.list().then(setInviteCodes).catch(() => {});
    }
  }, [showInvitePanel, isLeader, isAdmin]);

  const handleCreateCode = async () => {
    setCreatingCode(true);
    try {
      const res = await inviteCodesApi.create(newCodeNote || undefined);
      setNewCodeNote("");
      const updated = await inviteCodesApi.list();
      setInviteCodes(updated);
      showToast(`✅ Tạo mã mời thành công: ${res.code}`);
    } catch (e: any) {
      showToast(`❌ ${e.message}`);
    }
    setCreatingCode(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  const handleDeactivateCode = async (code: string) => {
    if (!window.confirm(`Tạm khóa mã "${code}"? Mã sẽ không dùng được nhưng chưa bị xóa.`)) return;
    await inviteCodesApi.deactivate(code);
    const updated = await inviteCodesApi.list();
    setInviteCodes(updated);
    showToast(`Đã tạm khóa mã ${code}`);
  };

  const handleReactivateCode = async (code: string) => {
    await inviteCodesApi.reactivate(code);
    const updated = await inviteCodesApi.list();
    setInviteCodes(updated);
    showToast(`✅ Đã kích hoạt lại mã ${code}`);
  };

  const handleDeleteCode = async (code: string) => {
    if (!window.confirm(`Xóa VĨNH VIỄN mã "${code}"? Hành động này không thể hoàn tác.`)) return;
    await inviteCodesApi.deleteCode(code);
    const updated = await inviteCodesApi.list();
    setInviteCodes(updated);
    showToast(`Đã xóa vĩnh viễn mã ${code}`);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  // Nhóm tài khoản
  const pendingAdmin  = accounts.filter(a => a.status === AccountStatus.PENDING_ADMIN);
  const pendingLeader = accounts.filter(a => a.status === AccountStatus.PENDING_LEADER);
  const pendingDelete = accounts.filter(a => a.status === AccountStatus.PENDING_DELETE);
  const allOthers     = accounts.filter(a =>
    ![AccountStatus.PENDING_ADMIN, AccountStatus.PENDING_LEADER, AccountStatus.PENDING_DELETE].includes(a.status as AccountStatus)
  );
  const memberIds     = new Set(members.map(m => m.id));
  const clanAccounts  = allOthers.filter(a =>
    a.role !== UserRole.ADMIN &&
    [AccountStatus.ACTIVE, AccountStatus.BLOCKED, AccountStatus.PENDING_DELETE].includes(a.status as AccountStatus)
  );
  const unlinkedActive = allOthers.filter(a =>
    a.status === AccountStatus.ACTIVE &&
    !a.mappedMemberId &&
    a.role !== UserRole.ADMIN &&
    a.role !== UserRole.GUEST
  );

  // Admin: nhóm tài khoản theo từng dòng họ (clanId) — mỗi dòng họ 1 khối riêng
  type ClanGroup = { clanId: string; clanName: string; accounts: UserAccount[] };
  const clanGroups: ClanGroup[] = (() => {
    if (!isAdmin) return [];
    const map = new Map<string, ClanGroup>();
    for (const acc of clanAccounts) {
      const key = acc.clanId || "_unknown";
      if (!map.has(key)) {
        const leaderInGroup = clanAccounts.find(a => a.clanId === acc.clanId && a.role === UserRole.LEADER);
        const fallbackName = key === "_unknown"
          ? "Chưa gán dòng họ"
          : (leaderInGroup ? `Dòng họ ${leaderInGroup.fullName}` : `Dòng họ (${key})`);
        map.set(key, { clanId: key, clanName: acc.clanName || fallbackName, accounts: [] });
      }
      map.get(key)!.accounts.push(acc);
    }
    return Array.from(map.values()).sort((a, b) => a.clanName.localeCompare(b.clanName, "vi"));
  })();

  // ── Xử lý ─────────────────────────────────────────────────────────────────
  const handleCreateLeader = async (form: any) => {
    await accountsApi.createLeader(form.fullName, form.phone, form.email || "", form.password, form.clanName, form.clanOrigin);
    setShowCreateLeader(false);
    showToast(`✅ Tạo Trưởng họ "${form.fullName}" — Dòng họ "${form.clanName}" thành công!`);
    await refreshAccounts?.();
  };

  const handleLeaderApprove = async (role: UserRole) => {
    if (!approveTarget || !onApproveByLeader) return;
    await onApproveByLeader(approveTarget.id, role);
    setApproveTarget(null);
    showToast(`✅ Đã phê duyệt tài khoản ${approveTarget.fullName} với vai ${roleLabel[role]}`);
  };

  const handleSyncClanMember = async (acc: UserAccount) => {
    if (!onApproveByLeader || !isLeader) return;
    const role = [UserRole.MEMBER, UserRole.TREASURER].includes(acc.role)
      ? acc.role
      : UserRole.MEMBER;
    await onApproveByLeader(acc.id, role);
    showToast(`✅ Đã thêm ${acc.fullName} vào gia phả và danh sách thành viên`);
  };

  const handleLeaderReject = async (reason: string) => {
    if (!approveTarget) return;
    await onRejectByAdmin(approveTarget.id, reason);
    setApproveTarget(null);
    showToast(`Đã từ chối tài khoản ${approveTarget.fullName}`);
  };

  const handleAdminApprove = async (acc: UserAccount) => {
    await onApproveByAdmin(acc.id);
    showToast(`✅ Đã phê duyệt kỹ thuật tài khoản ${acc.fullName}`);
  };

  const handleAdminReject = async (acc: UserAccount) => {
    const reason = window.prompt(`Lý do từ chối hồ sơ của ${acc.fullName}:`);
    if (!reason) return;
    await onRejectByAdmin(acc.id, reason);
    showToast(`Đã từ chối hồ sơ ${acc.fullName}`);
  };

  const handleBlock = async (acc: UserAccount) => {
    await onToggleBlockAccount(acc.id, true, "Vô hiệu hóa bởi Trưởng họ");
    showToast(`Đã vô hiệu hóa tài khoản ${acc.fullName}`);
  };

  const handleUnblock = async (acc: UserAccount) => {
    if (!window.confirm(`Mở khóa tài khoản ${acc.fullName}?`)) return;
    await onToggleBlockAccount(acc.id, false);
    showToast(`✅ Đã mở khóa tài khoản ${acc.fullName}`);
  };

  const handleApproveDelete = async (acc: UserAccount) => {
    if (!window.confirm(`Xác nhận XÓA VĨNH VIỄN tài khoản ${acc.fullName}? Hành động này không thể hoàn tác.`)) return;
    await onApproveDeleteAccount?.(acc.id);
    showToast(`Đã xóa tài khoản ${acc.fullName}`);
  };

  const handleRejectDelete = async (acc: UserAccount) => {
    const reason = window.prompt(`Lý do không duyệt xóa tài khoản ${acc.fullName}:`);
    if (!reason) return;
    await onRejectDeleteAccount?.(acc.id, reason);
    showToast(`✅ Đã từ chối yêu cầu xóa, tài khoản ${acc.fullName} được phục hồi`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-sm rounded-xl px-4 py-3 shadow-xl">
          {toast}
        </div>
      )}

      {/* Modals */}
      {showCreateLeader && <CreateLeaderModal onClose={() => setShowCreateLeader(false)} onSubmit={handleCreateLeader} />}
      {approveTarget && (
        <LeaderApproveModal account={approveTarget} onClose={() => setApproveTarget(null)}
          onApprove={handleLeaderApprove} onReject={handleLeaderReject} />
      )}
      {editTarget && onEditAccount && (
        <EditAccountModal account={editTarget} onClose={() => setEditTarget(null)}
          onSave={async (data) => { await onEditAccount(editTarget.id, data); showToast(`✅ Đã cập nhật thông tin ${editTarget.fullName}`); }} />
      )}
      {deleteTarget && onRequestDeleteAccount && (
        <RequestDeleteModal account={deleteTarget} onClose={() => setDeleteTarget(null)}
          onConfirm={async (reason) => { await onRequestDeleteAccount(deleteTarget.id, reason); showToast(`Đã gửi yêu cầu xóa ${deleteTarget.fullName} tới Admin`); }} />
      )}
      {tempPasswordResult && (
        <TempPasswordResultModal
          fullName={tempPasswordResult.fullName}
          tempPassword={tempPasswordResult.tempPassword}
          onClose={() => setTempPasswordResult(null)}
        />
      )}

      {/* ── ADMIN: Phê duyệt kỹ thuật ──────────────────────────────────────── */}
      {isAdmin && (
        <div className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-amber-50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 rounded-lg"><Shield className="w-5 h-5 text-amber-600" /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Phê duyệt tài khoản cá nhân</h3>
                <p className="text-[11px] text-slate-500">Kiểm tra tính hợp lệ hồ sơ đăng ký · {pendingAdmin.length} chờ xử lý</p>
              </div>
            </div>
            <button onClick={() => setShowCreateLeader(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Tạo TK Trưởng họ
            </button>
          </div>

          {pendingAdmin.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">✅ Không có hồ sơ chờ duyệt</p>
          ) : (
            <div className="space-y-3">
              {pendingAdmin.map(acc => (
                <div key={acc.id} className="border border-amber-100 bg-amber-50/20 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1"><ProfileCard acc={acc} /></div>
                  <div className="flex sm:flex-col gap-2 justify-end flex-shrink-0">
                    <button onClick={() => handleAdminApprove(acc)}
                      className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer">
                      <Check className="w-3.5 h-3.5" /> Phê duyệt
                    </button>
                    <button onClick={() => handleAdminReject(acc)}
                      className="flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold cursor-pointer">
                      <X className="w-3.5 h-3.5" /> Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN: Yêu cầu cấp lại mật khẩu (Flow D — Quên mật khẩu) ───────── */}
      {isAdmin && (
        <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 rounded-lg"><Key className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Yêu cầu cấp lại mật khẩu</h3>
                <p className="text-[11px] text-slate-500">Người dùng quên mật khẩu gửi tới · {pendingResetRequests.length} chờ xử lý</p>
              </div>
            </div>
            <button onClick={loadResetRequests} disabled={loadingResets}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingResets ? "animate-spin" : ""}`} /> Làm mới
            </button>
          </div>

          {pendingResetRequests.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              {loadingResets ? "Đang tải..." : "✅ Không có yêu cầu cấp lại mật khẩu nào chờ xử lý"}
            </p>
          ) : (
            <div className="space-y-3">
              {pendingResetRequests.map(req => (
                <div key={req.id} className="border border-emerald-100 bg-emerald-50/20 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-1 text-xs">
                    <p className="font-bold text-slate-800">{req.fullName}</p>
                    <p className="text-slate-500">🔑 Định danh đã nhập: {req.phoneOrEmail}</p>
                    <p className="text-slate-400">
                      Gửi lúc: {req.requestedAt ? new Date(req.requestedAt).toLocaleString("vi-VN") : "—"}
                    </p>
                  </div>
                  <div className="flex sm:flex-col gap-2 justify-end flex-shrink-0">
                    <button onClick={() => handleProcessReset(req)} disabled={processingResetId === req.id}
                      className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50">
                      <Key className="w-3.5 h-3.5" /> {processingResetId === req.id ? "Đang cấp..." : "Cấp mật khẩu tạm thời"}
                    </button>
                    <button onClick={() => handleRejectReset(req)} disabled={processingResetId === req.id}
                      className="flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50">
                      <X className="w-3.5 h-3.5" /> Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lịch sử xử lý gần đây — phục vụ minh bạch/đối soát, không cần hành động thêm */}
          {resetRequests.some(r => r.status !== "PENDING") && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Lịch sử đã xử lý</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {resetRequests.filter(r => r.status !== "PENDING").map(r => (
                  <div key={r.id} className="flex items-center justify-between text-[11px] text-slate-500 px-2 py-1.5 hover:bg-slate-50 rounded-lg">
                    <span className="truncate">{r.fullName} · {r.phoneOrEmail}</span>
                    <span className={`flex-shrink-0 font-bold px-2 py-0.5 rounded-full ${r.status === "PROCESSED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {r.status === "PROCESSED" ? "Đã cấp lại" : "Đã từ chối"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN: Duyệt yêu cầu xóa từ Trưởng họ ──────────────────────────── */}
      {isAdmin && pendingDelete.length > 0 && (
        <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-orange-50">
            <div className="p-1.5 bg-orange-50 rounded-lg"><Trash2 className="w-5 h-5 text-orange-600" /></div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Duyệt yêu cầu xóa tài khoản</h3>
              <p className="text-[11px] text-slate-500">Yêu cầu từ Trưởng họ · {pendingDelete.length} yêu cầu</p>
            </div>
          </div>
          <div className="space-y-3">
            {pendingDelete.map(acc => (
              <div key={acc.id} className="border border-orange-100 bg-orange-50/20 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <ProfileCard acc={acc} />
                  {acc.blockReason && (
                    <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800">
                      <strong>Lý do Trưởng họ yêu cầu xóa:</strong> {acc.blockReason}
                    </div>
                  )}
                </div>
                <div className="flex sm:flex-col gap-2 flex-shrink-0">
                  <button onClick={() => handleApproveDelete(acc)}
                    className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" /> Duyệt xóa
                  </button>
                  <button onClick={() => handleRejectDelete(acc)}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer">
                    <X className="w-3.5 h-3.5" /> Không duyệt
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TRƯỞNG HỌ: Phê duyệt vào dòng họ & phân quyền ──────────────────── */}
      {(isLeader) && (
        <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-blue-50">
            <div className="p-1.5 bg-blue-50 rounded-lg"><UserCheck className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Phê duyệt tham gia dòng họ & Phân quyền</h3>
              <p className="text-[11px] text-slate-500">Xác minh lai lịch, gán chức vụ · {pendingLeader.length} chờ xử lý</p>
            </div>
          </div>
          {pendingLeader.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">✅ Không có tài khoản chờ phê duyệt</p>
          ) : (
            <div className="space-y-3">
              {pendingLeader.map(acc => (
                <div key={acc.id} className="border border-blue-100 bg-blue-50/20 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1"><ProfileCard acc={acc} /></div>
                  <div className="flex-shrink-0">
                    <button onClick={() => setApproveTarget(acc)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer">
                      <Eye className="w-3.5 h-3.5" /> Xem & Phê duyệt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TRƯỞNG HỌ / ADMIN: Tài khoản thành viên trong gia phả ─────────── */}
      {(isLeader || isAdmin) && (
        <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b">
            <div className="p-1.5 bg-rose-50 rounded-lg"><Users className="w-5 h-5 text-rose-600" /></div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Quản lý tài khoản thành viên</h3>
              <p className="text-[11px] text-slate-500">
                {isAdmin
                  ? `${clanGroups.length} dòng họ · ${clanAccounts.length} tài khoản`
                  : `Tài khoản thành viên trong dòng họ · ${clanAccounts.length} tài khoản`}
              </p>
            </div>
          </div>

          {(() => {
            const renderTable = (list: UserAccount[]) => (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-500 font-bold text-[11px] uppercase tracking-wide">
                    <th className="p-3">Họ tên</th>
                    <th className="p-3">Liên hệ</th>
                    <th className="p-3">Vai trò</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map(acc => (
                    <tr key={acc.id} className="hover:bg-slate-50/50 text-slate-700">
                      <td className="p-3 font-semibold text-slate-900">{acc.fullName}</td>
                      <td className="p-3 text-slate-500">
                        <div>{acc.phone}</div>
                        {acc.email && <div className="text-[10px] text-slate-400">{acc.email}</div>}
                      </td>
                      <td className="p-3 text-[11px] font-semibold text-slate-700">{roleLabel[acc.role] || acc.role}</td>
                      <td className="p-3"><StatusBadge status={acc.status as AccountStatus} /></td>
                      <td className="p-3">
                        {acc.id === currentAccount.id ? (
                          <span className="text-[10px] text-slate-400 italic">Tài khoản của bạn</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">

                            {/* Sửa thông tin — Trưởng họ*/}
                            {isLeader && onEditAccount && (
                              <button onClick={() => setEditTarget(acc)}
                                title="Sửa thông tin thành viên"
                                className="flex items-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-[10px] font-bold cursor-pointer">
                                <Edit2 className="w-3 h-3" /> Sửa
                              </button>
                            )}

                            {/* Khóa / Mở khóa — Trưởng họ & Admin */}
                            {(isLeader || isAdmin) && acc.status === AccountStatus.ACTIVE && (
                              <button onClick={() => handleBlock(acc)}
                                title="Khóa tài khoản"
                                className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold cursor-pointer">
                                <Lock className="w-3 h-3" /> Khóa
                              </button>
                            )}
                            {(isLeader || isAdmin) && acc.status === AccountStatus.BLOCKED && (
                              <button onClick={() => handleUnblock(acc)}
                                title="Mở khóa tài khoản"
                                className="flex items-center gap-1 px-2 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[10px] font-bold cursor-pointer">
                                <Unlock className="w-3 h-3" /> Mở khóa
                              </button>
                            )}

                            {/* Yêu cầu xóa — Trưởng họ gửi lên Admin */}
                            {isLeader && acc.role !== UserRole.ADMIN && onRequestDeleteAccount &&
                              acc.status !== AccountStatus.PENDING_DELETE && (
                              <button onClick={() => setDeleteTarget(acc)}
                                title="Gửi yêu cầu xóa tài khoản tới Admin"
                                className="flex items-center gap-1 px-2 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 rounded-lg text-[10px] font-bold cursor-pointer">
                                <Trash2 className="w-3 h-3" /> Yêu cầu xóa
                              </button>
                            )}
                            {acc.status === AccountStatus.PENDING_DELETE && (
                              <span className="text-[10px] text-orange-600 font-semibold italic">⏳ Chờ Admin duyệt xóa</span>
                            )}

                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );

            if (clanAccounts.length === 0) {
              return (
                <p className="text-xs text-slate-400 text-center py-8">
                  Chưa có tài khoản nào được ánh xạ vào gia phả
                </p>
              );
            }

            // ADMIN: hiển thị theo từng khối dòng họ, mỗi khối có tên dòng họ ở trên
            if (isAdmin) {
              return (
                <div className="space-y-6">
                  {clanGroups.map(group => (
                    <div key={group.clanId} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between bg-rose-50/60 px-4 py-2.5 border-b border-rose-100">
                        <h4 className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" /> {group.clanName}
                        </h4>
                        <span className="text-[10px] font-semibold text-rose-500">{group.accounts.length} tài khoản</span>
                      </div>
                      <div className="overflow-x-auto">{renderTable(group.accounts)}</div>
                    </div>
                  ))}
                </div>
              );
            }

            // TRƯỞNG HỌ: bảng đơn (chỉ thấy dòng họ của mình)
            return <div className="overflow-x-auto">{renderTable(clanAccounts)}</div>;
          })()}
        </div>
      )}

      {/* ── TRƯỞNG HỌ: Quản lý mã mời ──────────────────────────────── */}
      {(isLeader) && (
        <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-emerald-50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 rounded-lg"><Key className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Quản lý mã mời</h3>
                <p className="text-[11px] text-slate-500">Tạo mã để thành viên đăng ký tham gia dòng họ</p>
              </div>
            </div>
            <button onClick={() => setShowInvitePanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer">
              <Key className="w-3.5 h-3.5" /> {showInvitePanel ? "Đóng" : "Xem & Tạo mã"}
            </button>
          </div>

          {showInvitePanel && (
            <div className="space-y-4">
              {/* Form tạo mã mới */}
              {isLeader && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-xs font-bold text-emerald-800 mb-2">Tạo mã mời mới</p>
                <div className="flex gap-2">
                  <input
                    value={newCodeNote}
                    onChange={e => setNewCodeNote(e.target.value)}
                    placeholder="Ghi chú mục đích (VD: Chi họ Nguyễn Bá Phả...)"
                    className="flex-1 border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                  />
                  <button onClick={handleCreateCode} disabled={creatingCode}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap">
                    <Plus className="w-3.5 h-3.5" /> {creatingCode ? "Đang tạo..." : "Tạo mã"}
                  </button>
                </div>
                <p className="text-[10px] text-emerald-600 mt-2">
                  Mã được tạo tự động dạng <strong>DH_XXXXXXXX</strong>. Gửi mã này cho thành viên muốn gia nhập.
                </p>
              </div>
              )}

              {/* Danh sách mã mời */}
              {inviteCodes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Chưa có mã mời nào được tạo</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b text-slate-500 font-bold text-[11px] uppercase">
                        <th className="p-2.5 text-left">Mã mời</th>
                        <th className="p-2.5 text-left">Ghi chú</th>
                        <th className="p-2.5 text-center">Đã dùng</th>
                        <th className="p-2.5 text-left">Tạo bởi</th>
                        <th className="p-2.5 text-left">Ngày tạo</th>
                        <th className="p-2.5 text-center">Trạng thái</th>
                        <th className="p-2.5 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inviteCodes.map(c => (
                        <tr key={c.code} className={`hover:bg-slate-50 ${!c.isActive ? "opacity-40" : ""}`}>
                          <td className="p-2.5">
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              {c.code}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600">{c.note || <span className="text-slate-300 italic">—</span>}</td>
                          <td className="p-2.5 text-center font-semibold text-slate-700">
                            {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ""}
                          </td>
                          <td className="p-2.5 text-slate-500">{c.createdBy}</td>
                          <td className="p-2.5 text-slate-400 text-[10px]">
                            {new Date(c.createdAt).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="p-2.5 text-center">
                            {c.isActive
                              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Hoạt động</span>
                              : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Đã tắt</span>
                            }
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => handleCopyCode(c.code)} title="Sao chép mã"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg cursor-pointer">
                                {copiedCode === c.code ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              {c.isActive ? (
                                <button onClick={() => handleDeactivateCode(c.code)} title="Tạm khóa mã"
                                  className="flex items-center gap-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold cursor-pointer">
                                  <Lock className="w-3 h-3" /> Khóa
                                </button>
                              ) : (
                                <button onClick={() => handleReactivateCode(c.code)} title="Kích hoạt lại"
                                  className="flex items-center gap-1 px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold cursor-pointer">
                                  <Unlock className="w-3 h-3" /> Mở
                                </button>
                              )}
                              <button onClick={() => handleDeleteCode(c.code)} title="Xóa vĩnh viễn"
                                className="flex items-center gap-1 px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-bold cursor-pointer">
                                <Trash2 className="w-3 h-3" /> Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Audit Log ─────────────────────────────────────────────────────────── */}
      {(isAdmin || isLeader) && (
        <div className="bg-slate-950 text-slate-300 rounded-2xl p-5 border border-slate-900 shadow-md">
          <div className="pb-2 border-b border-slate-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-xs text-emerald-400 font-bold uppercase tracking-wider">Nhật ký hệ thống</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {auditLogs.length === 0 && <p className="text-[11px] text-slate-600 text-center py-4">Chưa có nhật ký</p>}
            {auditLogs.map(log => (
              <div key={log.id} className="flex gap-2 text-[10.5px] font-mono border-b border-slate-900/50 pb-2 leading-relaxed">
                <span className="text-slate-500 flex-shrink-0">[{log.timestamp}]</span>
                <span className="text-amber-400 font-bold flex-shrink-0">{log.actorName}:</span>
                <span className="text-emerald-400 font-semibold flex-shrink-0">[{log.action}]</span>
                <span className="text-slate-300">{log.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}