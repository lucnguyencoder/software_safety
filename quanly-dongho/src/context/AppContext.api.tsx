/**
 * src/context/AppContext.api.tsx
 * Version AppContext dùng REAL API thay vì localStorage
 * Đổi tên file thành AppContext.tsx khi đã có backend chạy
 *
 * Cách dùng:
 *   1. Đảm bảo backend đang chạy tại http://localhost:3001
 *   2. Tạo file src/.env.local với: VITE_API_URL=http://localhost:3001/api
 *   3. Đổi tên file này thành AppContext.tsx (ghi đè bản localStorage)
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  UserAccount, ClanMember, ClanEvent, FundTransaction,
  AnnualQuota, AuditLog, UserRole, AccountStatus
} from "../types";
import {
  authApi, membersApi, eventsApi, financeApi, accountsApi,
  getToken, setToken, clearToken
} from "../services/api";
import { CLAN_PROFILE as CLAN_PROFILE_STATIC } from "../data/seedData";

export type ActiveTab =
  | "landing" | "giamap" | "member_grid" | "events"
  | "finance" | "accounts" | "profile";

export interface RegisterForm {
  fullName: string; birthDate: string; gender: string;
  phone: string; email: string; hometown: string; address: string;
  password: string; confirmPassword: string; inviteCode: string; notes: string;
}

// ── State & Actions interfaces (giữ nguyên, chỉ thay implementation) ──────────
interface AppState {
  isLoggedIn: boolean;
  currentAccount: UserAccount | null;
  showLoginModal: boolean;
  showRegisterModal: boolean;
  accounts: UserAccount[];
  members: ClanMember[];
  events: ClanEvent[];
  transactions: FundTransaction[];
  annualQuota: AnnualQuota;
  auditLogs: AuditLog[];
  activeTab: ActiveTab;
  loading: boolean;
  error: string | null;
}

interface AppActions {
  login: (phoneOrEmail: string, password: string) => Promise<string | null>;
  logout: () => void;
  register: (form: RegisterForm) => Promise<{ ok: boolean; message: string }>;
  setShowLoginModal: (v: boolean) => void;
  setShowRegisterModal: (v: boolean) => void;
  setCurrentAccount: (acc: UserAccount) => void;
  setActiveTab: (tab: ActiveTab) => void;
  refreshMembers: () => Promise<void>;
  addMember: (m: Omit<ClanMember, "id">) => Promise<any>;
  updateMember: (m: ClanMember) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  refreshEvents: () => Promise<void>;
  addEvent: (e: Omit<ClanEvent, "id">) => Promise<void>;
  updateEvent: (e: ClanEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  submitRsvp: (eventId: string, status: string, additionalGuests?: number, reason?: string) => Promise<void>;
  addTransaction: (t: Omit<FundTransaction, "id">) => Promise<void>;
  updateQuota: (q: AnnualQuota) => Promise<void>;
  refreshAccounts: () => Promise<void>;
  approveByAdmin: (id: string) => Promise<void>;
  approveByLeader: (id: string, role: UserRole, memberId?: string) => Promise<void>;
  unlinkAccountFromNode: (accountId: string) => Promise<void>;
  rejectAccount: (id: string, reason: string) => Promise<void>;
  blockAccount: (id: string, reason: string) => Promise<void>;
  unblockAccount: (id: string) => Promise<void>;
  updateAccountRole: (id: string, role: UserRole) => Promise<void>;
}

const AppContext = createContext<(AppState & AppActions) | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentAccount, setCurrentAccountState] = useState<UserAccount | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("landing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [events, setEvents] = useState<ClanEvent[]>([]);
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [annualQuota, setAnnualQuota] = useState<AnnualQuota>({ year: 2026, amountPerMember: 200000, description: "" });
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // ── Khởi tạo: kiểm tra token đã lưu ────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (token) {
      authApi.me().then(acc => {
        setCurrentAccountState(acc);
        setIsLoggedIn(true);
      }).catch(() => {
        clearToken();
      });
    }
  }, []);

  // ── Auth ─────────────────────────────────────────────────────────────────────

  const login = async (phoneOrEmail: string, password: string): Promise<string | null> => {
    try {
      const { token, account } = await authApi.login(phoneOrEmail, password);
      setToken(token);
      setCurrentAccountState(account);
      setIsLoggedIn(true);
      setShowLoginModal(false);
      return null;
    } catch (err: any) {
      return err.message || "Đăng nhập thất bại.";
    }
  };

  const logout = () => {
    clearToken();
    setIsLoggedIn(false);
    setCurrentAccountState(null);
    setActiveTab("landing");
    // Reset data
    setMembers([]); setEvents([]); setTransactions([]); setAccounts([]);
  };

  const register = async (form: RegisterForm): Promise<{ ok: boolean; message: string }> => {
    try {
      const { message } = await authApi.register({
        fullName: form.fullName, phone: form.phone, email: form.email,
        password: form.password, birthDate: form.birthDate, gender: form.gender,
        hometown: form.hometown, address: form.address,
        notes: form.notes, inviteCode: form.inviteCode,
      });
      return { ok: true, message };
    } catch (err: any) {
      return { ok: false, message: err.message || "Đăng ký thất bại." };
    }
  };

  const setCurrentAccount = (acc: UserAccount) => setCurrentAccountState(acc);

  // ── Members ──────────────────────────────────────────────────────────────────

  const refreshMembers = async () => {
    const { data } = await membersApi.list({ limit: 500 });
    setMembers(data);
  };

  const addMember = async (m: Omit<ClanMember, "id">) => {
    const created = await membersApi.create(m);
    await refreshMembers();
    return created;
  };

  const updateMember = async (m: ClanMember) => {
    await membersApi.update(m.id, m);
    await refreshMembers();
  };

  const deleteMember = async (id: string) => {
    await membersApi.delete(id);
    await refreshMembers();
  };

  // ── Events ───────────────────────────────────────────────────────────────────

  const refreshEvents = async () => {
    const data = await eventsApi.list({ year: 2026 });
    setEvents(data);
  };

  const addEvent = async (e: Omit<ClanEvent, "id">) => {
    await eventsApi.create(e);
    await refreshEvents();
  };

  const updateEvent = async (e: ClanEvent) => {
    await eventsApi.update(e.id, e);
    await refreshEvents();
  };

  // Ghi nhận RSVP của thành viên — dùng đúng endpoint POST /events/:id/rsvp
  // (KHÔNG dùng updateEvent/PUT vì route đó chỉ cho ADMIN/LEADER và không lưu rsvps).
  const submitRsvp = async (eventId: string, status: string, additionalGuests = 0, reason?: string) => {
    await eventsApi.rsvp(eventId, status, additionalGuests, reason);
    await refreshEvents();
  };

  const deleteEvent = async (id: string) => {
    await eventsApi.delete(id);
    await refreshEvents();
  };

  // ── Finance ──────────────────────────────────────────────────────────────────

  const addTransaction = async (t: Omit<FundTransaction, "id">) => {
    await financeApi.addTransaction(t);
    const { data } = await financeApi.transactions({ year: 2026, limit: 500 } as any);
    setTransactions(data);
  };

  const updateQuota = async (q: AnnualQuota) => {
    const updated = await financeApi.updateQuota(q.year, q.amountPerMember, q.description);
    setAnnualQuota(updated);
  };

  // ── Accounts ─────────────────────────────────────────────────────────────────

  const refreshAccounts = async () => {
    const data = await accountsApi.list();
    setAccounts(data);
  };

  const approveByAdmin = async (id: string) => {
    await accountsApi.approveAdmin(id);
    await refreshAccounts();
  };

  const approveByLeader = async (id: string, role: UserRole, memberId?: string) => {
    await accountsApi.approveLeader(id, role, memberId);
    await refreshAccounts();
  };

  const unlinkAccountFromNode = async (accountId: string) => {
    await accountsApi.unlinkMember(accountId);
    await refreshAccounts();
    await refreshMembers();
  };

  const rejectAccount = async (id: string, reason: string) => {
    await accountsApi.reject(id, reason);
    await refreshAccounts();
  };

  const blockAccount = async (id: string, reason: string) => {
    await accountsApi.block(id, reason);
    await refreshAccounts();
  };

  const unblockAccount = async (id: string) => {
    await accountsApi.unblock(id);
    await refreshAccounts();
  };

  const updateAccountRole = async (id: string, role: UserRole) => {
    await accountsApi.changeRole(id, role);
    await refreshAccounts();
  };

  return (
    <AppContext.Provider value={{
      isLoggedIn, currentAccount: currentAccount as UserAccount,
      showLoginModal, showRegisterModal,
      accounts, members, events, transactions, annualQuota, auditLogs,
      activeTab, loading, error,
      login, logout, register, setShowLoginModal, setShowRegisterModal, setCurrentAccount,
      setActiveTab,
      refreshMembers, addMember, updateMember, deleteMember,
      refreshEvents, addEvent, updateEvent, deleteEvent, submitRsvp,
      addTransaction, updateQuota,
      refreshAccounts, approveByAdmin, approveByLeader, unlinkAccountFromNode, rejectAccount,
      blockAccount, unblockAccount, updateAccountRole,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { CLAN_PROFILE_STATIC as CLAN_PROFILE };