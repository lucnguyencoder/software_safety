/**
 * components/AuthModals.tsx
 * Modal đăng nhập, đăng ký, quên mật khẩu và đổi mật khẩu
 * Workflow theo UC xác thực & bảo mật tài khoản
 */
import React, { useState } from "react";
import { LogIn, UserPlus, Eye, EyeOff, Phone, Lock, KeyRound, ShieldCheck } from "lucide-react";
import { useApp, RegisterForm } from "../context/AppContext";
import { Modal, Btn } from "./ui";
import { authApi } from "../services/api";

// ─── Login Modal ─────────────────────────────────────────────────────────────
export function LoginModal() {
  const { setShowLoginModal, setShowRegisterModal, login } = useApp();
  const [input, setInput] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [rejectedMsg, setRejectedMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setRejectedMsg("");
    if (!input.trim() || !pass) {
      setError("Vui lòng nhập số điện thoại/email và mật khẩu.");
      return;
    }
    setSubmitting(true);
    const err = await login(input.trim(), pass);
    setSubmitting(false);
    if (!err) { setShowLoginModal(false); return; }
    if (err.startsWith("__REJECTED__")) {
      setRejectedMsg(err.replace("__REJECTED__", ""));
    } else {
      setError(err);
    }
  };

  // Popup từ chối
  if (rejectedMsg) {
    return (
      <Modal onClose={() => setShowLoginModal(false)} title="Yêu cầu đăng ký bị từ chối">
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✗</span>
          </div>
          <h3 className="font-serif font-bold text-slate-800 text-lg mb-2">Từ chối yêu cầu đăng ký</h3>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left mb-5">
            <p className="text-xs font-bold text-red-700 mb-1">Lý do từ chối:</p>
            <p className="text-sm text-red-800 leading-relaxed">{rejectedMsg}</p>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Vui lòng liên hệ Trưởng họ để biết thêm chi tiết hoặc đăng ký lại với thông tin chính xác.
          </p>
          <Btn variant="primary" onClick={() => setShowLoginModal(false)} className="w-full justify-center">
            Đóng
          </Btn>
        </div>
      </Modal>
    );
  }

  // Flow D: Chuyển sang modal quên mật khẩu
  if (showForgot) {
    return <ForgotPasswordModal onBack={() => setShowForgot(false)} onClose={() => setShowLoginModal(false)} />;
  }

  return (
    <Modal onClose={() => setShowLoginModal(false)} title="Đăng nhập tài khoản">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="text-center mb-2">
          <div className="w-14 h-14 rounded-full bg-[#8c4f2b]/10 flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-7 h-7 text-[#8c4f2b]" />
          </div>
          <p className="text-sm text-stone-500">Sử dụng số điện thoại hoặc email đã đăng ký</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Số điện thoại / Email <span className="text-red-500">*</span></label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={input} onChange={e => setInput(e.target.value)}
              placeholder="0901234567 hoặc email@gmail.com"
              className="w-full border border-stone-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30 focus:border-[#8c4f2b]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Mật khẩu <span className="text-red-500">*</span></label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type={showPass ? "text" : "password"}
              value={pass} onChange={e => setPass(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="w-full border border-stone-200 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30 focus:border-[#8c4f2b]"
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              {showPass ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          {/* D1: Link "Quên mật khẩu" */}
          <div className="text-right mt-1">
            <button type="button" onClick={() => setShowForgot(true)}
              className="text-xs text-[#8c4f2b] hover:underline font-medium">
              Quên mật khẩu?
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
        )}

        <Btn type="submit" variant="primary" className="w-full justify-center" disabled={submitting}>
          <LogIn className="w-4 h-4" /> {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </Btn>

        <div className="text-center text-xs text-stone-400 pt-2 border-t border-stone-100">
          Chưa có tài khoản?{" "}
          <button type="button" onClick={() => { setShowLoginModal(false); setShowRegisterModal(true); }}
            className="text-[#8c4f2b] font-semibold hover:underline">
            Đăng ký mới
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Forgot Password Modal — Flow D ──────────────────────────────────────────
function ForgotPasswordModal({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!phoneOrEmail.trim()) {
      setError("Vui lòng nhập số điện thoại hoặc email.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.forgotPassword(phoneOrEmail.trim());
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  // D3: Màn hình xác nhận yêu cầu đã được gửi
  if (success) {
    return (
      <Modal onClose={onClose} title="Yêu cầu đã được gửi">
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="font-serif font-bold text-slate-800 text-lg mb-3">Yêu cầu đã được gửi!</h3>
          <p className="text-stone-500 text-sm leading-relaxed mb-2">
            Yêu cầu cấp lại mật khẩu của bạn đã được gửi đến <strong>Quản trị viên</strong>.
          </p>
          <p className="text-stone-400 text-xs leading-relaxed mb-6">
            Quản trị viên sẽ xác minh danh tính và thông báo mật khẩu tạm thời qua kênh liên hệ ngoài hệ thống. Vui lòng chờ phản hồi.
          </p>
          <Btn variant="primary" onClick={onClose} className="w-full justify-center">
            Về trang đăng nhập
          </Btn>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Quên mật khẩu">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="text-center mb-2">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-7 h-7 text-amber-600" />
          </div>
          <p className="text-sm text-stone-500">Nhập số điện thoại hoặc email đã đăng ký để gửi yêu cầu cấp lại mật khẩu.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Số điện thoại / Email <span className="text-red-500">*</span></label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={phoneOrEmail} onChange={e => setPhoneOrEmail(e.target.value)}
              placeholder="0901234567 hoặc email@gmail.com"
              className="w-full border border-stone-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30 focus:border-[#8c4f2b]"
            />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          Sau khi gửi yêu cầu, Quản trị viên sẽ xác minh danh tính và cấp mật khẩu tạm thời qua kênh liên hệ ngoài hệ thống.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
        )}

        <Btn type="submit" variant="primary" className="w-full justify-center" disabled={submitting}>
          <KeyRound className="w-4 h-4" /> {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
        </Btn>

        <div className="text-center">
          <button type="button" onClick={onBack} className="text-xs text-stone-500 hover:text-stone-700 hover:underline">
            ← Quay lại đăng nhập
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Change Password Modal — Flow C (đổi mật khẩu thường) + Flow D5 (mật khẩu tạm thời) ──
export function ChangePasswordModal({ onClose, forceMode = false }: { onClose: () => void; forceMode?: boolean }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // S-1: Đánh giá độ mạnh mật khẩu realtime
  const getPasswordStrength = (pw: string) => {
    if (!pw) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (score <= 1) return { score, label: "Rất yếu", color: "bg-red-500" };
    if (score === 2) return { score, label: "Yếu", color: "bg-orange-400" };
    if (score === 3) return { score, label: "Trung bình", color: "bg-yellow-400" };
    if (score === 4) return { score, label: "Mạnh", color: "bg-blue-500" };
    return { score, label: "Rất mạnh", color: "bg-green-500" };
  };
  const pwStrength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (forceMode) {
      if (!newPassword || !confirmPassword) {
        setError("Vui lòng điền đầy đủ mật khẩu mới và xác nhận.");
        return;
      }
    } else {
      if (!oldPassword || !newPassword || !confirmPassword) {
        setError("Vui lòng điền đầy đủ tất cả các trường.");
        return;
      }
    }
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Mật khẩu mới phải tối thiểu 8 ký tự, gồm cả chữ và số.");
      return;
    }
    if (/\s/.test(newPassword)) {
      setError("Mật khẩu mới không được chứa khoảng trắng.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setSubmitting(true);
    try {
      if (forceMode) {
        await authApi.changePasswordForced(newPassword, confirmPassword);
      } else {
        await authApi.changePassword(oldPassword, newPassword, confirmPassword);
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Modal onClose={onClose} title={forceMode ? "Đặt mật khẩu thành công" : "Đổi mật khẩu thành công"}>
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-serif font-bold text-slate-800 text-lg mb-3">
            {forceMode ? "Đặt mật khẩu mới thành công!" : "Đổi mật khẩu thành công!"}
          </h3>
          <p className="text-stone-500 text-sm mb-6">
            {forceMode
              ? "Tài khoản của bạn đã được bảo mật. Vui lòng sử dụng mật khẩu mới cho lần đăng nhập tiếp theo."
              : "Mật khẩu của bạn đã được cập nhật. Vui lòng sử dụng mật khẩu mới cho lần đăng nhập tiếp theo."}
          </p>
          <Btn variant="primary" onClick={onClose} className="w-full justify-center">
            Đóng
          </Btn>
        </div>
      </Modal>
    );
  }

  const inputCls = (hasErr?: boolean) =>
    `w-full border rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30 focus:border-[#8c4f2b] ${hasErr ? "border-red-400 bg-red-50" : "border-stone-200"}`;

  return (
    <Modal onClose={onClose} title={forceMode ? "Đặt mật khẩu mới" : "Đổi mật khẩu"}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="text-center mb-2">
          <div className="w-14 h-14 rounded-full bg-[#8c4f2b]/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7 text-[#8c4f2b]" />
          </div>
          <p className="text-sm text-stone-500">
            {forceMode
              ? "Vui lòng đặt mật khẩu mới để bảo vệ tài khoản của bạn."
              : "Nhập mật khẩu cũ và mật khẩu mới để cập nhật bảo mật tài khoản."}
          </p>
        </div>

        {/* C1: Mật khẩu cũ — chỉ hiện khi không phải forceMode */}
        {!forceMode && (
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Mật khẩu hiện tại <span className="text-red-500">*</span></label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input type={showOld ? "text" : "password"} value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                placeholder="Mật khẩu hiện tại" className={inputCls()} />
              <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                {showOld ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* C1: Mật khẩu mới + thanh độ mạnh (S-1) */}
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Mật khẩu mới <span className="text-red-500">*</span></label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input type={showNew ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="≥8 ký tự, có chữ+số, không khoảng trắng" className={inputCls()} />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              {showNew ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          {/* S-1: Thanh độ mạnh mật khẩu */}
          {newPassword && (
            <div className="mt-1.5">
              <div className="flex gap-1 mb-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= pwStrength.score ? pwStrength.color : "bg-stone-200"}`} />
                ))}
              </div>
              <p className={`text-[11px] font-semibold ${pwStrength.score <= 2 ? "text-red-500" : pwStrength.score === 3 ? "text-yellow-600" : "text-green-600"}`}>
                Độ mạnh: {pwStrength.label}
              </p>
            </div>
          )}
        </div>

        {/* C1: Xác nhận mật khẩu mới */}
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Xác nhận mật khẩu mới <span className="text-red-500">*</span></label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới" className={inputCls(confirmPassword !== "" && confirmPassword !== newPassword)} />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              {showConfirm ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-red-600 text-[11px] mt-1 font-medium">Mật khẩu xác nhận không khớp.</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 border border-stone-300 text-stone-600 text-sm font-semibold rounded-lg hover:bg-stone-50 transition-colors cursor-pointer">
            Hủy
          </button>
          <Btn type="submit" variant="primary" className="flex-1 justify-center" disabled={submitting}>
            <Lock className="w-4 h-4" /> {submitting ? "Đang lưu..." : "Đổi mật khẩu"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

// ─── Register Modal ──────────────────────────────────────────────────────────
export function RegisterModal() {
  const { register, setShowRegisterModal, setShowLoginModal } = useApp();
  const [form, setForm] = useState<RegisterForm>({
    fullName: "", birthDate: "", gender: "MALE", phone: "", email: "",
    hometown: "", address: "", password: "", confirmPassword: "",
    inviteCode: "", notes: ""
  });
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterForm | "general", string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const set = (k: keyof RegisterForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setFieldErrors(fe => ({ ...fe, [k]: "" }));
  };

  // S-1: Đánh giá độ mạnh mật khẩu realtime
  const getPasswordStrength = (pw: string): { score: number; label: string; color: string } => {
    if (!pw) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (score <= 1) return { score, label: "Rất yếu", color: "bg-red-500" };
    if (score === 2) return { score, label: "Yếu", color: "bg-orange-400" };
    if (score === 3) return { score, label: "Trung bình", color: "bg-yellow-400" };
    if (score === 4) return { score, label: "Mạnh", color: "bg-blue-500" };
    return { score, label: "Rất mạnh", color: "bg-green-500" };
  };
  const pwStrength = getPasswordStrength(form.password);

  const handleCancel = () => {
    setForm({ fullName: "", birthDate: "", gender: "MALE", phone: "", email: "", hometown: "", address: "", password: "", confirmPassword: "", inviteCode: "", notes: "" });
    setFieldErrors({});
    setShowRegisterModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};

    if (!form.fullName.trim()) errors.fullName = "Họ và tên là bắt buộc.";
    if (!form.birthDate) errors.birthDate = "Ngày sinh là bắt buộc.";
    if (!form.gender) errors.gender = "Giới tính là bắt buộc.";
    if (!form.phone.trim()) errors.phone = "Số điện thoại là bắt buộc.";
    else if (!/^(0|\+84)[0-9]{9}$/.test(form.phone.trim())) errors.phone = "Số điện thoại không đúng định dạng.";
    if (!form.password) errors.password = "Mật khẩu là bắt buộc.";
    else if (form.password.length < 8 || !/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password))
      errors.password = "Mật khẩu phải tối thiểu 8 ký tự, gồm cả chữ và số.";
    else if (/\s/.test(form.password))
      errors.password = "Mật khẩu không được chứa khoảng trắng.";
    if (!form.confirmPassword) errors.confirmPassword = "Vui lòng xác nhận mật khẩu.";
    else if (form.password !== form.confirmPassword) errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    if (!form.inviteCode.trim()) errors.inviteCode = "Mã mời là bắt buộc.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const result = await register(form);
    setSubmitting(false);

    if (result?.ok === false) {
      const msg: string = result.message || "";
      if (msg.toLowerCase().includes("mã mời") || msg.toLowerCase().includes("invite")) {
        setFieldErrors({ inviteCode: "Mã mời không tồn tại, đã hết hạn hoặc đã hết lượt sử dụng." });
        return;
      }
      const fe: typeof fieldErrors = {};
      if (msg.toLowerCase().includes("email")) fe.email = "Email này đã được đăng ký hoặc đang chờ xử lý.";
      if (msg.toLowerCase().includes("phone") || msg.toLowerCase().includes("điện thoại") || msg.toLowerCase().includes("sđt"))
        fe.phone = "SĐT này đã được đăng ký hoặc đang chờ xử lý.";
      if (Object.keys(fe).length > 0) { setFieldErrors(fe); return; }
      setFieldErrors({ general: msg || "Đăng ký thất bại. Vui lòng thử lại." });
      return;
    }
    setSuccess(true);
  };

  const errCls = (err?: string) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30 focus:border-[#8c4f2b] ${err ? "border-red-400 bg-red-50" : "border-stone-200"}`;

  const inputCls = errCls;

  if (success) {
    return (
      <Modal onClose={() => setShowRegisterModal(false)} title="Gửi yêu cầu thành công">
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="font-serif font-bold text-stone-800 text-lg mb-3">Gửi yêu cầu thành công!</h3>
          <p className="text-stone-500 text-sm leading-relaxed mb-6">
            Vui lòng chờ <strong>Quản trị viên hệ thống</strong> phê duyệt và kích hoạt tài khoản. Bạn sẽ nhận được thông báo sau khi được duyệt.
          </p>
          <Btn variant="primary" onClick={() => setShowRegisterModal(false)} className="w-full justify-center">
            Về trang chủ
          </Btn>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={handleCancel} title="Đăng ký tham gia dòng họ">
      <form onSubmit={handleSubmit} className="p-6 space-y-3 max-h-[80vh] overflow-y-auto">

        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Thông tin cá nhân</p>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Họ và tên đầy đủ <span className="text-red-500">*</span></label>
          <input value={form.fullName} onChange={e => set("fullName", e.target.value)}
            placeholder="Nguyễn Bá ..." className={inputCls(fieldErrors.fullName)} />
          {fieldErrors.fullName && <p className="text-red-600 text-[11px] mt-1 font-medium">{fieldErrors.fullName}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Ngày sinh <span className="text-red-500">*</span></label>
            <input type="date" value={form.birthDate} onChange={e => set("birthDate", e.target.value)}
              className={inputCls(fieldErrors.birthDate)} />
            {fieldErrors.birthDate && <p className="text-red-600 text-[11px] mt-1 font-medium">{fieldErrors.birthDate}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Giới tính <span className="text-red-500">*</span></label>
            <select value={form.gender} onChange={e => set("gender", e.target.value)}
              className={inputCls(fieldErrors.gender)}>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
            </select>
            {fieldErrors.gender && <p className="text-red-600 text-[11px] mt-1 font-medium">{fieldErrors.gender}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Số điện thoại <span className="text-red-500">*</span></label>
            <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
              placeholder="09xxxxxxxx" className={inputCls(fieldErrors.phone)} />
            {fieldErrors.phone && <p className="text-red-600 text-[11px] mt-1 font-medium">{fieldErrors.phone}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
              placeholder="email@gmail.com" className={inputCls(fieldErrors.email)} />
            {fieldErrors.email && <p className="text-red-600 text-[11px] mt-1 font-medium">{fieldErrors.email}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Quê quán</label>
          <input value={form.hometown} onChange={e => set("hometown", e.target.value)}
            placeholder="Tỉnh / Huyện / Xã" className={inputCls(fieldErrors.hometown)} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Địa chỉ hiện tại</label>
          <input value={form.address} onChange={e => set("address", e.target.value)}
            placeholder="Địa chỉ cư trú hiện nay" className={inputCls(fieldErrors.address)} />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 pt-1">Bảo mật</p>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Mật khẩu <span className="text-red-500">*</span></label>
          <div className="relative">
            <input type={showPass ? "text" : "password"} value={form.password}
              onChange={e => set("password", e.target.value)}
              placeholder="≥8 ký tự, có chữ+số, không khoảng trắng" className={`${inputCls(fieldErrors.password)} pr-9`} />
            <button type="button" onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              {showPass ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.password && <p className="text-red-600 text-[11px] mt-1 font-medium">{fieldErrors.password}</p>}
          {form.password && (
            <div className="mt-1.5">
              <div className="flex gap-1 mb-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= pwStrength.score ? pwStrength.color : "bg-stone-200"}`} />
                ))}
              </div>
              <p className={`text-[11px] font-semibold ${pwStrength.score <= 2 ? "text-red-500" : pwStrength.score === 3 ? "text-yellow-600" : "text-green-600"}`}>
                Độ mạnh: {pwStrength.label}
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Xác nhận mật khẩu <span className="text-red-500">*</span></label>
          <div className="relative">
            <input type={showConfirmPass ? "text" : "password"} value={form.confirmPassword}
              onChange={e => set("confirmPassword", e.target.value)}
              placeholder="Nhập lại mật khẩu" className={`${inputCls(fieldErrors.confirmPassword)} pr-9`} />
            <button type="button" onClick={() => setShowConfirmPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              {showConfirmPass ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.confirmPassword && <p className="text-red-600 text-[11px] mt-1 font-medium">{fieldErrors.confirmPassword}</p>}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 pt-1">Xác thực dòng họ</p>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Mã mời <span className="text-red-500">*</span></label>
          <input value={form.inviteCode} onChange={e => set("inviteCode", e.target.value)}
            placeholder="Liên hệ Trưởng họ để lấy mã"
            className={inputCls(fieldErrors.inviteCode)} />
          {fieldErrors.inviteCode && <p className="text-red-600 text-[11px] mt-1 font-medium">{fieldErrors.inviteCode}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">Ghi chú / Tự giới thiệu</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
            placeholder="Con cháu chi nào, thuộc đời thứ mấy..."
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30 focus:border-[#8c4f2b] h-20 resize-none" />
        </div>

        {fieldErrors.general && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{fieldErrors.general}</div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-stone-300 text-stone-600 text-sm font-semibold rounded-lg hover:bg-stone-50 transition-colors cursor-pointer">
            Hủy
          </button>
          <Btn type="submit" variant="primary" className="flex-1 justify-center" disabled={submitting}>
            <UserPlus className="w-4 h-4" /> {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
          </Btn>
        </div>

        <p className="text-center text-xs text-stone-400">
          Đã có tài khoản?{" "}
          <button type="button" onClick={() => { setShowRegisterModal(false); setShowLoginModal(true); }}
            className="text-[#8c4f2b] font-semibold hover:underline">
            Đăng nhập
          </button>
        </p>
      </form>
    </Modal>
  );
}