/**
 * components/Navbar.tsx
 * Thanh điều hướng chính — hiển thị tab theo vai trò người dùng
 */
import React, { useState } from "react";
import {
  Trees, BookOpen, Calendar, Wallet, Shield,
  LogIn, LogOut, UserPlus, Menu, X, Lock, Crown,
  Landmark, FileText, ChevronDown, KeyRound
} from "lucide-react";
import { useApp, ActiveTab } from "../context/AppContext";
import { UserRole, AccountStatus } from "../types";
import { RoleBadge } from "./ui";
import { ChangePasswordModal } from "./AuthModals";

const ROLE_COLOR: Record<UserRole, string> = {
  [UserRole.ADMIN]:     "text-purple-600 bg-purple-50 border-purple-200",
  [UserRole.LEADER]:    "text-amber-700 bg-amber-50 border-amber-200",
  [UserRole.TREASURER]: "text-emerald-700 bg-emerald-50 border-emerald-200",
  [UserRole.MEMBER]:    "text-sky-700 bg-sky-50 border-sky-200",
  [UserRole.GUEST]:     "text-stone-600 bg-stone-50 border-stone-200",
};

export default function Navbar() {
  const {
    isLoggedIn, currentAccount, activeTab, setActiveTab,
    logout, setShowLoginModal, setShowRegisterModal
  } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const isActive = (t: ActiveTab) => activeTab === t;
  const tabCls = (t: ActiveTab) =>
    `flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors rounded-lg cursor-pointer whitespace-nowrap
    ${isActive(t) ? "bg-[#8c4f2b]/10 text-[#8c4f2b] font-semibold" : "text-stone-600 hover:text-[#8c4f2b] hover:bg-stone-50"}`;

  const pendingLock = isLoggedIn && currentAccount.status !== AccountStatus.ACTIVE;

  // Tabs available by role
  const showGiapha   = isLoggedIn && currentAccount.role !== UserRole.GUEST && currentAccount.role !== UserRole.ADMIN;
  const showMembers  = isLoggedIn && currentAccount.role !== UserRole.GUEST && currentAccount.role !== UserRole.ADMIN;
  const showEvents   = isLoggedIn && currentAccount.role !== UserRole.ADMIN && currentAccount.role !== UserRole.GUEST;
  const showFinance  = isLoggedIn && currentAccount.role !== UserRole.ADMIN && currentAccount.role !== UserRole.GUEST;
  const showAccounts = isLoggedIn && (currentAccount.role === UserRole.ADMIN || currentAccount.role === UserRole.LEADER);
  const showClanInfo = isLoggedIn && currentAccount.role === UserRole.LEADER;

  const navItems = [
    { tab: "giamap"    as ActiveTab, label: "Gia phả",            icon: Trees,    show: showGiapha   },
    { tab: "member_grid" as ActiveTab, label: "Thành viên",        icon: BookOpen, show: showMembers  },
    { tab: "events"    as ActiveTab, label: "Sự kiện",             icon: Calendar, show: showEvents   },
    { tab: "finance"   as ActiveTab, label: "Quỹ dòng họ",         icon: Wallet,   show: showFinance  },
    { tab: "accounts"  as ActiveTab, label: "Tài khoản",           icon: Shield,   show: showAccounts },
    { tab: "clan_info" as ActiveTab, label: "Thông tin dòng họ",   icon: FileText, show: showClanInfo },
    { tab: "profile"   as ActiveTab, label: "Tộc ước",             icon: Crown,    show: false        },
  ];

  return (
    <>
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={() => setActiveTab("landing")} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8c4f2b] to-[#5c3219] flex items-center justify-center shadow-md">
              <Trees className="w-5 h-5 text-amber-100" />
            </div>
            <div className="hidden sm:block">
              <div className="font-serif font-bold text-stone-800 text-sm leading-none">MỘC BẢN</div>
              <div className="text-[12px] text-stone-400 font-medium tracking-wide uppercase mt-0.5">Gia phả số</div>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.filter(n => n.show).map(({ tab, label, icon: Icon }) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={tabCls(tab)}>
                <Icon className="w-3.5 h-3.5" />
                {label}
                {pendingLock && tab !== "landing" && tab !== "profile" && tab !== "clan_info" && (
                  <Lock className="w-2.5 h-2.5 text-amber-500 ml-0.5" />
                )}
              </button>
            ))}
          </nav>

          {/* Auth area */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <div className="relative">
                <button onClick={() => setShowUserMenu(v => !v)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${ROLE_COLOR[currentAccount.role]}`}>
                  <div className="w-6 h-6 rounded-full bg-white/60 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {currentAccount.fullName.charAt(0)}
                  </div>
                  <span className="hidden sm:inline max-w-[100px] truncate">{currentAccount.fullName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
                </button>

                {showUserMenu && (
                  <>
                    {/* Lớp phủ trong suốt để đóng dropdown khi click ra ngoài */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-stone-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-stone-100">
                        <p className="text-sm font-bold text-stone-800 truncate">{currentAccount.fullName}</p>
                        <p className="text-[11px] text-stone-400 truncate">{currentAccount.phone || currentAccount.email}</p>
                        <div className="mt-1.5"><RoleBadge role={currentAccount.role} /></div>
                      </div>
                      <button onClick={() => { setShowUserMenu(false); setShowChangePassword(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer transition-colors">
                        <KeyRound className="w-3.5 h-3.5" /> Đổi mật khẩu
                      </button>
                      <button onClick={() => { setShowUserMenu(false); logout(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition-colors border-t border-stone-100">
                        <LogOut className="w-3.5 h-3.5" /> Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer transition-colors">
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Đăng nhập</span>
                </button>
                <button onClick={() => setShowRegisterModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#8c4f2b] text-white hover:bg-[#723e20] rounded-lg cursor-pointer transition-colors shadow-sm">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Đăng ký</span>
                </button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 text-stone-500 hover:bg-stone-100 rounded-lg cursor-pointer">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-stone-100 py-3 flex flex-col gap-1">
            {navItems.filter(n => n.show).map(({ tab, label, icon: Icon }) => (
              <button key={tab} onClick={() => { setActiveTab(tab); setMobileOpen(false); }}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-xl ${isActive(tab) ? "bg-[#8c4f2b]/10 text-[#8c4f2b]" : "text-stone-700 hover:bg-stone-50"}`}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            {isLoggedIn && (
              <div className="mx-4 mt-2 flex flex-col gap-1">
                <div className={`px-3 py-2 rounded-xl border text-xs font-semibold ${ROLE_COLOR[currentAccount.role]} flex items-center gap-2`}>
                  <RoleBadge role={currentAccount.role} />
                  <span>{currentAccount.fullName}</span>
                </div>
                <button onClick={() => { setMobileOpen(false); setShowChangePassword(true); }}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 rounded-xl cursor-pointer">
                  <KeyRound className="w-4 h-4" /> Đổi mật khẩu
                </button>
                <button onClick={() => { setMobileOpen(false); logout(); }}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl cursor-pointer">
                  <LogOut className="w-4 h-4" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </>
  );
}