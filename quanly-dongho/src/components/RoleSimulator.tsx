/**
 * components/RoleSimulator.tsx
 * Footer bar cho phép chuyển đổi vai trò giả lập để demo/test hệ thống.
 * Hiển thị dưới dạng floating bar ở cuối trang.
 */
import React, { useState } from "react";
import { Settings, ChevronUp, ChevronDown, Zap } from "lucide-react";
import { useApp } from "../context/AppContext";
import { UserRole, AccountStatus } from "../types";

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]:     "⚙️ Quản trị viên",
  [UserRole.LEADER]:    "👑 Trưởng họ",
  [UserRole.TREASURER]: "💰 Thủ quỹ",
  [UserRole.MEMBER]:    "👤 Tộc viên",
  [UserRole.GUEST]:     "🚪 Khách",
};

export default function RoleSimulator() {
  const { accounts, currentAccount, setCurrentAccount, isLoggedIn, logout, setActiveTab } = useApp();
  const [open, setOpen] = useState(false);

  // Only show active accounts
  const activeAccounts = accounts.filter(a => a.status === AccountStatus.ACTIVE || a.role === UserRole.ADMIN);

  const handleSelect = (acc: typeof accounts[0]) => {
    setCurrentAccount(acc);
    setOpen(false);
    setActiveTab("landing");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Panel */}
      {open && (
        <div className="bg-white border-t border-stone-200 shadow-2xl max-h-72 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mb-2 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-500" />
              Giả lập vai trò — chỉ dùng để kiểm thử
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {activeAccounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => handleSelect(acc)}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    currentAccount.id === acc.id
                      ? "bg-[#8c4f2b]/10 border-[#8c4f2b]/30 text-[#8c4f2b]"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <div className="font-semibold truncate">{acc.fullName}</div>
                  <div className="text-stone-400 mt-0.5">{ROLE_LABELS[acc.role]}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
