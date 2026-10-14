/**
 * components/ui.tsx — Shared UI primitives used across all pages
 */
import React from "react";
import { UserRole, AccountStatus } from "../types";

// ─── Role Badge ───────────────────────────────────────────────────────────────
export function RoleBadge({ role }: { role: UserRole }) {
  const map: Record<UserRole, { label: string; cls: string }> = {
    [UserRole.ADMIN]:      { label: "Quản trị viên", cls: "bg-purple-100 text-purple-700 border-purple-200" },
    [UserRole.LEADER]:     { label: "Trưởng họ",     cls: "bg-amber-100 text-amber-700 border-amber-200" },
    [UserRole.TREASURER]:  { label: "Thủ quỹ",       cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    [UserRole.MEMBER]:     { label: "Tộc viên",      cls: "bg-sky-100 text-sky-700 border-sky-200" },
    [UserRole.GUEST]:      { label: "Khách",          cls: "bg-stone-100 text-stone-600 border-stone-200" },
  };
  const { label, cls } = map[role] || map[UserRole.GUEST];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: AccountStatus }) {
  const map: Record<AccountStatus, { label: string; cls: string }> = {
    [AccountStatus.ACTIVE]:          { label: "Hoạt động",       cls: "bg-green-100 text-green-700" },
    [AccountStatus.PENDING_ADMIN]:   { label: "Chờ duyệt KT",    cls: "bg-blue-100 text-blue-700" },
    [AccountStatus.PENDING_LEADER]:  { label: "Chờ Trưởng họ",   cls: "bg-amber-100 text-amber-700" },
    [AccountStatus.BLOCKED]:         { label: "Bị khóa",         cls: "bg-red-100 text-red-700" },
    [AccountStatus.REJECTED]:        { label: "Từ chối",         cls: "bg-stone-100 text-stone-600" },
    [AccountStatus.PENDING_DELETE]:  { label: "Chờ Admin duyệt xóa", cls: "bg-orange-100 text-orange-800" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-stone-100 text-stone-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, icon: Icon }: {
  title: string; subtitle?: string; icon?: React.ElementType
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        {Icon && <Icon className="w-5 h-5 text-[#8c4f2b]" />}
        <h2 className="font-serif text-xl font-semibold text-stone-800">{title}</h2>
      </div>
      {subtitle && <p className="text-stone-500 text-sm ml-8">{subtitle}</p>}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-stone-200 rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// ─── Modal Wrapper ──────────────────────────────────────────────────────────
export function Modal({ onClose, children, title }: {
  onClose: () => void; children: React.ReactNode; title?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
            <h3 className="font-serif font-semibold text-stone-800">{title}</h3>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl font-bold leading-none">×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, message }: { icon?: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-stone-400">
      {Icon && <Icon className="w-12 h-12 mb-3 opacity-40" />}
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Permission Gate ─────────────────────────────────────────────────────────
export function PermGate({
  allowedRoles, currentRole, children, fallback
}: {
  allowedRoles: UserRole[];
  currentRole: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (!allowedRoles.includes(currentRole)) {
    return <>{fallback || null}</>;
  }
  return <>{children}</>;
}

// ─── Input ───────────────────────────────────────────────────────────────────
export function FormInput({
  label, required, ...props
}: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        {...props}
        className={`w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30 focus:border-[#8c4f2b] ${props.className || ""}`}
      />
    </div>
  );
}

export function FormSelect({
  label, required, children, ...props
}: { label: string; required?: boolean } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        {...props}
        className={`w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#8c4f2b]/30 focus:border-[#8c4f2b] ${props.className || ""}`}
      >
        {children}
      </select>
    </div>
  );
}

// ─── Btn ─────────────────────────────────────────────────────────────────────
export function Btn({
  variant = "primary", size = "md", children, className = "", ...props
}: {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center gap-1.5 font-semibold rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary:   "bg-[#8c4f2b] text-white hover:bg-[#723e20] shadow-sm",
    secondary: "bg-stone-100 text-stone-700 hover:bg-stone-200",
    danger:    "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    ghost:     "text-stone-600 hover:bg-stone-100",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
