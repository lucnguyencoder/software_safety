/**
 * src/services/api.ts
 * HTTP client giao tiếp với Backend API
 * Tự động đính kèm JWT token vào mỗi request
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// ─── Token management ─────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem("clan_jwt_token");
}

export function setToken(token: string) {
  localStorage.setItem("clan_jwt_token", token);
}

export function clearToken() {
  localStorage.removeItem("clan_jwt_token");
}

// Tệp tư liệu (ảnh/video/tài liệu) được backend trả về dưới dạng đường dẫn tương đối
// (ví dụ "/uploads/events/abc.jpg") — cần ghép với gốc domain của API (bỏ "/api") để trỏ đúng.
export function getMediaUrl(relativeUrl: string): string {
  if (!relativeUrl) return "";
  if (/^https?:\/\//.test(relativeUrl)) return relativeUrl;
  const origin = BASE_URL.replace(/\/api\/?$/, "");
  return `${origin}${relativeUrl}`;
}

// ─── Base fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({ error: "Phản hồi không hợp lệ từ server." }));

  if (!res.ok) {
    const err: any = new Error(data.error || `HTTP ${res.status}`);
    if (data.detail) err.detail = data.detail;
    throw err;
  }
  return data as T;
}

const get  = <T>(path: string)                => request<T>("GET",    path);
const post = <T>(path: string, body: unknown) => request<T>("POST",   path, body);
const put  = <T>(path: string, body: unknown) => request<T>("PUT",    path, body);
const del  = <T>(path: string, body?: unknown) => request<T>("DELETE", path, body);

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (phoneOrEmail: string, password: string) =>
    post<{ token: string; account: any }>("/auth/login", { phoneOrEmail, password }),

  register: (form: {
    fullName: string; phone: string; email: string; password: string;
    birthDate?: string; gender?: string; hometown?: string;
    address?: string; notes?: string; inviteCode: string;
  }) => post<{ message: string }>("/auth/register", form),

  me: () => get<any>("/auth/me"),

  changePassword: (oldPassword: string, newPassword: string, confirmPassword: string) =>
    post<{ message: string }>("/auth/change-password", { oldPassword, newPassword, confirmPassword }),

  changePasswordForced: (newPassword: string, confirmPassword: string) =>
    post<{ message: string }>("/auth/change-password-forced", { newPassword, confirmPassword }),

  forgotPassword: (phoneOrEmail: string) =>
    post<{ message: string }>("/auth/forgot-password", { phoneOrEmail }),

  getPasswordResetRequests: () =>
    get<any[]>("/auth/password-reset-requests"),

  processPasswordReset: (id: number) =>
    put<{ message: string; tempPassword: string }>(`/auth/password-reset-requests/${id}/process`, {}),

  rejectPasswordReset: (id: number, reason: string) =>
    put<{ message: string }>(`/auth/password-reset-requests/${id}/reject`, { reason }),
};

// ─── Members API ──────────────────────────────────────────────────────────────

export const membersApi = {
  list: (params?: {
    search?: string; gender?: string; livingStatus?: string;
    generation?: number; page?: number; limit?: number;
  }) => {
    const qs = params ? "?" + new URLSearchParams(
      Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])
    ) : "";
    return get<{ data: any[]; total: number }>(`/members${qs}`);
  },

  get: (id: string) => get<any>(`/members/${id}`),

  create: (member: any) => post<any>("/members", member),

  update: (id: string, member: Partial<any>) => put<any>(`/members/${id}`, member),

  delete: (id: string, reason?: string, notes?: string) =>
    del<{ message: string }>(`/members/${id}`, { reason, notes }),
};

// ─── Events API ───────────────────────────────────────────────────────────────

export const eventsApi = {
  list: (params?: { year?: number; month?: number; type?: string; status?: string }) => {
    const qs = params ? "?" + new URLSearchParams(
      Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])
    ) : "";
    return get<any[]>(`/events${qs}`);
  },

  create: (event: any) => post<any>("/events", event),

  update: (id: string, event: Partial<any>) => put<any>(`/events/${id}`, event),

  delete: (id: string) => del<{ message: string }>(`/events/${id}`),

  rsvp: (eventId: string, status: string, additionalGuests = 0, reason?: string) =>
    post<{ message: string }>(`/events/${eventId}/rsvp`, { status, additionalGuests, reason }),

  autoGioc: () => post<{ message: string; created: number }>("/events/auto-gioc", {}),
};

// ─── Finance API ──────────────────────────────────────────────────────────────

export const financeApi = {
  transactions: (params?: { type?: string; category?: string; year?: number; page?: number }) => {
    const qs = params ? "?" + new URLSearchParams(
      Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])
    ) : "";
    return get<{ data: any[]; total: number }>(`/finance/transactions${qs}`);
  },

  addTransaction: (tx: any) => post<any>("/finance/transactions", tx),

  quota: (year?: number) => get<any>(`/finance/quota${year ? `?year=${year}` : ""}`),

  quotaList: () => get<any>("/finance/quotas"),

  updateQuota: (year: number, amountPerMember: number, description?: string, notes?: string) =>
    put<any>("/finance/quota", { year, amountPerMember, description, notes }),

  summary: (year?: number) => get<any>(`/finance/summary${year ? `?year=${year}` : ""}`),
};

// ─── Accounts API ─────────────────────────────────────────────────────────────

export const inviteCodesApi = {
  list: () => get<any[]>("/invite-codes"),
  create: (note?: string, expiresAt?: string, usageLimit?: number) =>
    post<{ code: string; message: string }>("/invite-codes", { note, expiresAt, usageLimit }),
  deactivate: (code: string) => del<{ message: string }>(`/invite-codes/${code}/deactivate`),
  reactivate: (code: string) => put<{ message: string }>(`/invite-codes/${code}/reactivate`, {}),
  deleteCode: (code: string) => del<{ message: string }>(`/invite-codes/${code}`),
};

export const accountsApi = {
  list: (params?: { status?: string; role?: string }) => {
    const qs = params ? "?" + new URLSearchParams(
      Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])
    ) : "";
    return get<any[]>(`/accounts${qs}`);
  },

  approveAdmin: (id: string) => put<{ message: string }>(`/accounts/${id}/approve-admin`, {}),

  createLeader: (fullName: string, phone: string, email: string, password: string, clanName?: string, clanOrigin?: string) =>
    post<{ message: string; clanId: string }>("/accounts/create-leader", { fullName, phone, email, password, clanName, clanOrigin }),

  approveLeader: (id: string, role: string, memberId?: string) =>
    put<{ message: string }>(`/accounts/${id}/approve-leader`, { role, memberId }),

  // Alt Flow 4a (UC2.4): gỡ liên kết Node↔Tài khoản, đưa tài khoản về trạng thái tự do chờ map lại
  unlinkMember: (id: string) =>
    put<{ message: string }>(`/accounts/${id}/unlink-member`, {}),

  reject: (id: string, reason: string) =>
    put<{ message: string }>(`/accounts/${id}/reject`, { reason }),

  block: (id: string, reason: string) =>
    put<{ message: string }>(`/accounts/${id}/block`, { reason }),

  unblock: (id: string) => put<{ message: string }>(`/accounts/${id}/unblock`, {}),

  changeRole: (id: string, role: string) =>
    put<{ message: string }>(`/accounts/${id}/role`, { role }),

  requestDelete: (id: string, reason: string) =>
    put<{ message: string }>(`/accounts/${id}/request-delete`, { reason }),

  approveDelete: (id: string) =>
    del<{ message: string }>(`/accounts/${id}`),

  rejectDelete: (id: string, reason: string) =>
    put<{ message: string }>(`/accounts/${id}/reject-delete`, { reason }),

  editAccount: (id: string, data: Partial<any>) =>
    put<{ message: string }>(`/accounts/${id}/edit`, data),

  auditLogs: (page = 1, limit = 50) =>
    get<{ data: any[]; total: number }>(`/accounts/audit-logs?page=${page}&limit=${limit}`),
};

// ─── Event Media API (Tư liệu / Hình ảnh sự kiện) ─────────────────────────────
// Upload dùng XMLHttpRequest thay vì fetch() vì cần sự kiện tiến trình (progress)
// cho từng tệp khi tải lên (Step 6 trong workflow lưu trữ tư liệu).

export const eventMediaApi = {
  list: (eventId: string) => get<any[]>(`/events/${eventId}/media`),

  upload: (eventId: string, files: File[], onProgress?: (percent: number) => void) => {
    return new Promise<any[]>((resolve, reject) => {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f, f.name));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE_URL}/events/${eventId}/media`);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        let data: any = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* phản hồi không hợp lệ */ }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data?.error || `Tải tệp lên thất bại (HTTP ${xhr.status}).`));
        }
      };
      xhr.onerror = () => reject(new Error("Lỗi kết nối khi tải tệp lên."));
      xhr.send(formData);
    });
  },

  remove: (eventId: string, mediaId: string) =>
    del<{ message: string }>(`/events/${eventId}/media/${mediaId}`),
};
// Thêm đoạn này vào cuối file: src/services/api.ts
// (bên cạnh accountsApi, membersApi, v.v.)

// ─── Clan Info API ────────────────────────────────────────────────────────────
export const clanInfoApi = {
  /** Lấy thông tin dòng họ hiện tại (bước 2 — workflow) */
  get: () => get<any>("/clan-info"),

  /** Lấy danh sách lịch sử cập nhật (hiển thị cột phải) */
  history: (limit = 20) => get<any[]>(`/clan-info/history?limit=${limit}`),

  /** Lưu / cập nhật thông tin dòng họ — BR1: chỉ LEADER */
  update: (data: {
    clanName: string;
    originHistory: string;
    homeTown: string;
    currentResidenceArea?: string;
    templeAddress: string;
    ancestorDayLunar: string;
    clanRegulations: string;
  }) => put<{ message: string; data: any }>("/clan-info", data),
};