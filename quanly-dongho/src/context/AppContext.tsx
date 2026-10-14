/**
 * src/context/AppContext.tsx
 * Global state — kết nối REAL API (MySQL backend)
 */
import React, { createContext, useContext, useState, useEffect } from "react";
import {
  UserAccount, ClanMember, ClanEvent, FundTransaction,
  AnnualQuota, AuditLog, UserRole, AccountStatus,
  EventType, EventStatus, LivingStatus
} from "../types";
import {
  authApi, membersApi, eventsApi, financeApi, accountsApi,
  getToken, setToken, clearToken
} from "../services/api";
import { CLAN_PROFILE as CLAN_PROFILE_STATIC } from "../data/seedData";

export { CLAN_PROFILE_STATIC as CLAN_PROFILE };

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActiveTab =
  | "landing" | "giamap" | "member_grid" | "events"
  | "finance" | "accounts" | "profile" | "clan_info";

export interface RegisterForm {
  fullName: string; birthDate: string; gender: string;
  phone: string; email: string; hometown: string; address: string;
  password: string; confirmPassword: string; inviteCode: string; notes: string;
}

interface AppState {
  isLoggedIn: boolean;
  currentAccount: UserAccount;
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
}

interface AppActions {
  login: (phoneOrEmail: string, password: string) => Promise<string | null>;
  logout: () => void;
  register: (form: RegisterForm) => Promise<{ ok: boolean; message: string }> | any;
  setShowLoginModal: (v: boolean) => void;
  setShowRegisterModal: (v: boolean) => void;
  setCurrentAccount: (acc: UserAccount) => void;
  setActiveTab: (tab: ActiveTab) => void;

  refreshMembers: () => Promise<void>;
  addMember: (m: any) => Promise<any>;
  updateMember: (m: ClanMember) => Promise<void>;
  deleteMember: (id: string, reason?: string, notes?: string) => Promise<void>;

  refreshEvents: () => Promise<void>;
  addEvent: (e: any) => Promise<void>;
  updateEvent: (e: ClanEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;

  addTransaction: (t: any) => Promise<void>;
  updateQuota: (q: AnnualQuota) => Promise<void>;
  submitRsvp: (eventId: string, status: string, additionalGuests?: number, reason?: string) => Promise<void>;

  refreshAccounts: () => Promise<void>;
  approveByAdmin: (id: string) => Promise<void>;
  approveByLeader: (id: string, role: UserRole, memberId?: string) => Promise<void>;
  rejectAccount: (id: string, reason: string) => Promise<void>;
  blockAccount: (id: string, reason: string) => Promise<void>;
  unblockAccount: (id: string) => Promise<void>;
  updateAccountRole: (id: string, role: UserRole) => Promise<void>;
  requestDeleteAccount: (id: string, reason: string) => Promise<void>;
  approveDeleteAccount: (id: string) => Promise<void>;
  rejectDeleteAccount: (id: string, reason: string) => Promise<void>;
  editAccount: (id: string, data: Partial<UserAccount>) => Promise<void>;
  unlinkAccountFromNode: (accountId: string) => Promise<void>;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_ACCOUNT: UserAccount = {
  id: "", fullName: "Khách", phone: "", email: "",
  role: UserRole.GUEST, status: AccountStatus.PENDING_LEADER,
  inviteCode: "", registeredAt: "",
};

const DEFAULT_QUOTA: AnnualQuota = { year: new Date().getFullYear(), amountPerMember: 200000, description: "" };

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<(AppState & AppActions) | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentAccount, setCurrentAccountState] = useState<UserAccount>(DEFAULT_ACCOUNT);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("landing");
  const [loading, setLoading] = useState(false);

  const [members, setMembers] = useState<ClanMember[]>([]);
  const [events, setEvents] = useState<ClanEvent[]>([]);
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [annualQuota, setAnnualQuota] = useState<AnnualQuota>(DEFAULT_QUOTA);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // ── Khởi tạo: restore session từ JWT ───────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (token) {
      authApi.me().then(acc => {
        setCurrentAccountState(acc);
        setIsLoggedIn(true);
      }).catch(() => clearToken());
    }
  }, []);

  // ── Load data khi đăng nhập ─────────────────────────────────────────────────
  useEffect(() => {
    if (isLoggedIn) {
      refreshMembers();
      refreshEvents();
      refreshTransactions();
      refreshQuota();
      if (currentAccount.role === UserRole.ADMIN || currentAccount.role === UserRole.LEADER) {
        refreshAccounts();
        refreshAuditLogs();
      }
    }
  }, [isLoggedIn]);

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
      if (err.detail) return `__REJECTED__${err.detail}`;
      return err.message || "Đăng nhập thất bại.";
    }
  };

  const logout = () => {
    clearToken();
    setIsLoggedIn(false);
    setCurrentAccountState(DEFAULT_ACCOUNT);
    setActiveTab("landing");
    setMembers([]); setEvents([]); setTransactions([]);
    setAccounts([]); setAuditLogs([]);
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
    try {
      const { data } = await membersApi.list({ limit: 500 });
      setMembers(data);
    } catch {}
  };

  const addMember = async (m: any) => {
    const { id, ...body } = m;
    const created = await membersApi.create(body);
    await refreshMembers();
    return created;
  };

  const updateMember = async (m: ClanMember) => {
    await membersApi.update(m.id, m);
    await refreshMembers();
  };

  const deleteMember = async (id: string, reason?: string, notes?: string) => {
    await membersApi.delete(id, reason, notes);
    await refreshMembers();
  };

  // ── Events ───────────────────────────────────────────────────────────────────

  const refreshEvents = async () => {
    try {
      const data = await eventsApi.list();
      setEvents(data);
    } catch {}
  };

  const addEvent = async (e: any) => {
    const { id, rsvps, createdAt, ...body } = e;
    await eventsApi.create(body);
    await refreshEvents();
  };

  const updateEvent = async (e: ClanEvent) => {
    await eventsApi.update(e.id, e);
    await refreshEvents();
  };

  const deleteEvent = async (id: string) => {
    await eventsApi.delete(id);
    await refreshEvents();
  };

  // ── Finance ──────────────────────────────────────────────────────────────────

  const refreshTransactions = async () => {
    try {
      const { data } = await financeApi.transactions({ limit: 500 } as any);
      setTransactions(data);
    } catch {}
  };

  const refreshQuota = async () => {
    try {
      const q = await financeApi.quota(new Date().getFullYear());
      if (q) setAnnualQuota(q);
    } catch {}
  };

  const addTransaction = async (t: any) => {
    const { id, ...body } = t;
    await financeApi.addTransaction(body);
    await refreshTransactions();
  };

  const submitRsvp = async (eventId: string, status: string, additionalGuests = 0, reason?: string) => {
    await eventsApi.rsvp(eventId, status, additionalGuests, reason);
    await refreshEvents();
  };

  const updateQuota = async (q: AnnualQuota) => {
    const updated = await financeApi.updateQuota(q.year, q.amountPerMember, q.description, q.notes);
    // Only update context if it's the current year quota
    if (q.year === new Date().getFullYear()) {
      setAnnualQuota(updated);
    }
  };

  // ── Accounts ─────────────────────────────────────────────────────────────────

  const refreshAccounts = async () => {
    try {
      const data = await accountsApi.list();
      setAccounts(data);
    } catch (err) {
      console.error("Không thể tải danh sách tài khoản:", err);
    }
  };

  const refreshAuditLogs = async () => {
    try {
      const { data } = await accountsApi.auditLogs();
      setAuditLogs(data);
    } catch {}
  };

  const approveByAdmin = async (id: string) => {
    await accountsApi.approveAdmin(id);
    await refreshAccounts();
  };

  const approveByLeader = async (id: string, role: UserRole, memberId?: string) => {
    await accountsApi.approveLeader(id, role, memberId);
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

  const requestDeleteAccount = async (id: string, reason: string) => {
    await accountsApi.requestDelete(id, reason);
    await refreshAccounts();
  };

  const approveDeleteAccount = async (id: string) => {
    await accountsApi.approveDelete(id);
    await refreshAccounts();
  };

  const rejectDeleteAccount = async (id: string, reason: string) => {
    await accountsApi.rejectDelete(id, reason);
    await refreshAccounts();
  };

  const editAccount = async (id: string, data: Partial<UserAccount>) => {
    await accountsApi.editAccount(id, data);
    await refreshAccounts();
  };

  const unlinkAccountFromNode = async (accountId: string) => {
    await accountsApi.unlinkMember(accountId);
    await refreshAccounts();
    await refreshMembers();
  };

  return (
    <AppContext.Provider value={{
      isLoggedIn, currentAccount, showLoginModal, showRegisterModal,
      accounts, members, events, transactions, annualQuota, auditLogs,
      activeTab, loading,
      login, logout, register, setShowLoginModal, setShowRegisterModal, setCurrentAccount,
      setActiveTab,
      refreshMembers, addMember, updateMember, deleteMember,
      refreshEvents, addEvent, updateEvent, deleteEvent,
      addTransaction, updateQuota, submitRsvp,
      refreshAccounts, approveByAdmin, approveByLeader, rejectAccount,
      blockAccount, unblockAccount, updateAccountRole,
      requestDeleteAccount, approveDeleteAccount, rejectDeleteAccount,
      editAccount, unlinkAccountFromNode,
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