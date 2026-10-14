/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  Search, Eye, Edit2, Trash2, ChevronLeft, ChevronRight,
  User, Smartphone, Mail, MapPin, Calendar, Heart, X,
  Users, BarChart2, TrendingUp, UserCheck, UserX
} from "lucide-react";
import { ClanMember, Gender, LivingStatus, UserRole, UserAccount } from "../types";

interface MemberDataTableProps {
  members: ClanMember[];
  currentAccount: UserAccount;
  onEditMember: (member: ClanMember) => void;
  onDeleteMember: (id: string, reason: string, notes?: string) => void;
}

// ─── Stats Modal ──────────────────────────────────────────────────────────────
function StatsModal({ members, onClose }: { members: ClanMember[]; onClose: () => void }) {
  const stats = useMemo(() => {
    const now = new Date();
    const total = members.length;
    const male = members.filter(m => m.gender === Gender.MALE).length;
    const female = members.filter(m => m.gender === Gender.FEMALE).length;
    const alive = members.filter(m => m.livingStatus === LivingStatus.ALIVE).length;
    const deceased = members.filter(m => m.livingStatus === LivingStatus.DECEASED).length;

    const getAge = (birthDate?: string): number | null => {
      if (!birthDate) return null;
      const diff = now.getTime() - new Date(birthDate.split("T")[0]).getTime();
      const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
      return age >= 0 && age < 150 ? age : null;
    };

    const ages = members.map(m => getAge(m.birthDate)).filter((a): a is number => a !== null);
    const avgAge = ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null;
    const minAge = ages.length ? Math.min(...ages) : null;
    const maxAge = ages.length ? Math.max(...ages) : null;

    const ageGroups = [
      { label: "Dưới 10 tuổi",  color: "bg-purple-400", text: "text-purple-700", bg: "bg-purple-50", count: ages.filter(a => a < 10).length },
      { label: "10 – 17 tuổi",  color: "bg-violet-400", text: "text-violet-700", bg: "bg-violet-50", count: ages.filter(a => a >= 10 && a < 18).length },
      { label: "18 – 30 tuổi",  color: "bg-blue-400",   text: "text-blue-700",   bg: "bg-blue-50",   count: ages.filter(a => a >= 18 && a < 30).length },
      { label: "31 – 45 tuổi",  color: "bg-cyan-400",   text: "text-cyan-700",   bg: "bg-cyan-50",   count: ages.filter(a => a >= 30 && a < 45).length },
      { label: "46 – 60 tuổi",  color: "bg-amber-400",  text: "text-amber-700",  bg: "bg-amber-50",  count: ages.filter(a => a >= 45 && a < 60).length },
      { label: "Trên 60 tuổi",  color: "bg-rose-400",   text: "text-rose-700",   bg: "bg-rose-50",   count: ages.filter(a => a >= 60).length },
    ];

    const knownAgeCount = ages.length;
    const unknownAgeCount = total - knownAgeCount;

    return { total, male, female, alive, deceased, avgAge, minAge, maxAge, ageGroups, knownAgeCount, unknownAgeCount };
  }, [members]);

  const pct = (n: number, d: number) => d ? Math.round((n / d) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-rose-600 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Thống kê Thành viên Gia tộc</h2>
              <p className="text-[11px] text-slate-400">Tổng quan nhân khẩu học dòng họ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">

          {/* ── Tổng quan ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Tổng thành viên", value: stats.total, icon: Users,     color: "bg-slate-900 text-white" },
              { label: "Còn sống",        value: stats.alive, icon: UserCheck,  color: "bg-emerald-600 text-white" },
              { label: "Đã khuất",        value: stats.deceased, icon: UserX,  color: "bg-slate-500 text-white" },
              { label: "Tuổi trung bình", value: stats.avgAge !== null ? `${stats.avgAge}` : "—", icon: TrendingUp, color: "bg-rose-600 text-white" },
            ].map(card => (
              <div key={card.label} className={`${card.color} rounded-2xl p-4 flex flex-col gap-2`}>
                <card.icon className="w-5 h-5 opacity-80" />
                <div className="text-2xl font-bold">{card.value}</div>
                <div className="text-[11px] opacity-80 font-medium">{card.label}</div>
              </div>
            ))}
          </div>

          {/* ── Giới tính ── */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Phân bố giới tính</h3>
            <div className="flex items-center gap-4 mb-3">
              {/* Bar chart */}
              <div className="flex-1 h-8 rounded-xl overflow-hidden flex">
                <div
                  className="bg-blue-500 h-full flex items-center justify-center text-white text-[11px] font-bold transition-all"
                  style={{ width: `${pct(stats.male, stats.total)}%`, minWidth: stats.male ? "2rem" : 0 }}
                >
                  {pct(stats.male, stats.total)}%
                </div>
                <div
                  className="bg-pink-400 h-full flex items-center justify-center text-white text-[11px] font-bold transition-all"
                  style={{ width: `${pct(stats.female, stats.total)}%`, minWidth: stats.female ? "2rem" : 0 }}
                >
                  {pct(stats.female, stats.total)}%
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 border border-blue-100 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                <div>
                  <div className="font-bold text-slate-900 text-sm">{stats.male} người</div>
                  <div className="text-[11px] text-slate-500">Nam ({pct(stats.male, stats.total)}%)</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-pink-100 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-pink-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-slate-900 text-sm">{stats.female} người</div>
                  <div className="text-[11px] text-slate-500">Nữ ({pct(stats.female, stats.total)}%)</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Độ tuổi ── */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Phân bố độ tuổi</h3>
              <div className="flex gap-3 text-[11px] text-slate-500">
                {stats.minAge !== null && <span>Nhỏ nhất: <strong className="text-slate-700">{stats.minAge} tuổi</strong></span>}
                {stats.maxAge !== null && <span>Lớn nhất: <strong className="text-slate-700">{stats.maxAge} tuổi</strong></span>}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {stats.ageGroups.map(g => (
                <div key={g.label} className="flex items-center gap-3">
                  <div className={`w-24 text-[11px] font-semibold ${g.text} flex-shrink-0`}>{g.label}</div>
                  <div className="flex-1 bg-slate-200 rounded-full h-5 overflow-hidden">
                    <div
                      className={`${g.color} h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
                      style={{ width: stats.knownAgeCount ? `${pct(g.count, stats.knownAgeCount)}%` : "0%", minWidth: g.count ? "1.5rem" : 0 }}
                    >
                      {g.count > 0 && (
                        <span className="text-white text-[10px] font-bold">{pct(g.count, stats.knownAgeCount)}%</span>
                      )}
                    </div>
                  </div>
                  <div className={`w-14 text-right text-xs font-bold ${g.text}`}>
                    {g.count} người
                  </div>
                </div>
              ))}
            </div>

            {stats.unknownAgeCount > 0 && (
              <p className="text-[11px] text-slate-400 mt-3 italic">
                * {stats.unknownAgeCount} thành viên không có ngày sinh — không tính vào phân bố độ tuổi.
              </p>
            )}
          </div>

          {/* ── Tuổi trung bình highlight ── */}
          {stats.avgAge !== null && (
            <div className="bg-gradient-to-r from-rose-600 to-amber-600 rounded-2xl p-5 text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold opacity-80 uppercase tracking-wider mb-1">Tuổi trung bình toàn gia tộc</div>
                <div className="text-4xl font-bold">{stats.avgAge} <span className="text-xl font-normal opacity-80">tuổi</span></div>
                <div className="text-[11px] opacity-70 mt-1">Tính trên {stats.knownAgeCount}/{stats.total} thành viên có ngày sinh</div>
              </div>
              <TrendingUp className="w-12 h-12 opacity-20" />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MemberDataTable({
  members,
  currentAccount,
  onEditMember,
  onDeleteMember,
}: MemberDataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [lifeFilter, setLifeFilter] = useState<"ALL" | "ALIVE" | "DECEASED">("ALL");
  const [generationFilter, setGenerationFilter] = useState<number | "ALL">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<ClanMember | null>(null);
  const [showStats, setShowStats] = useState(false);
  const itemsPerPage = 8;

  const isLeader = currentAccount.role === UserRole.LEADER;

  // ── Modal SỬA THÀNH VIÊN (giống bên Gia phả) ──────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormMember, setEditFormMember] = useState<ClanMember | null>(null);
  const [birthLunarManual, setBirthLunarManual] = useState(false);
  const [deathLunarManual, setDeathLunarManual] = useState(false);
  const [birthDateError, setBirthDateError] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    gender: Gender.MALE,
    livingStatus: LivingStatus.ALIVE,
    birthDate: "",
    birthDateLunar: "",
    deathDate: "",
    deathDateLunar: "",
    phone: "",
    email: "",
    currentAddress: "",
    originAddress: "",
    job: "",
    representativeRole: "",
    notes: "",
    fatherId: "",
    motherId: "",
    spouseId: "",
  });

  // ── Modal XÓA THÀNH VIÊN (ghi lý do xóa, giống bên Gia phả) ──────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMemberTarget, setDeleteMemberTarget] = useState<ClanMember | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteNote, setDeleteNote] = useState("");

  // ── Modal LỖI ──────────────────────────────────────────────────────────────
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const showError = (message: string) => setErrorModal({ show: true, message });

  // Khoảng cách tuổi sinh học tối thiểu hợp lý giữa cha/mẹ và con (năm)
  const MIN_PARENT_CHILD_GAP_YEARS = 13;
  const yearsBetween = (d1: string, d2: string) => {
    const a = new Date(d1).getTime(), b = new Date(d2).getTime();
    return (b - a) / (1000 * 60 * 60 * 24 * 365.25);
  };

  // Chuyển đổi dương lịch → âm lịch (thuật toán Hồ Ngọc Đức, múi giờ UTC+7)
  const solarToLunar = (dateStr: string): string => {
    if (!dateStr) return "";
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length < 3) return "";
    const dd = parseInt(parts[2]), mm = parseInt(parts[1]), yy = parseInt(parts[0]);
    if (isNaN(dd) || isNaN(mm) || isNaN(yy)) return "";

    const jdFromDate = (d: number, m: number, y: number): number => {
      let a = Math.floor((14 - m) / 12);
      let yr = y + 4800 - a, mo = m + 12 * a - 3;
      let jd = d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045;
      if (jd < 2299161) jd = d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - 32083;
      return jd;
    };

    const newMoonDay = (k: number): number => {
      const T = k / 1236.85, T2 = T * T, T3 = T2 * T;
      let Jde = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
        + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * Math.PI / 180);
      const M = (359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3) * Math.PI / 180;
      const MPr = (306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3) * Math.PI / 180;
      const F = (21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3) * Math.PI / 180;
      Jde += (0.1734 - 0.000393 * T) * Math.sin(M) + 0.0021 * Math.sin(2 * M)
        - 0.4068 * Math.sin(MPr) + 0.0161 * Math.sin(2 * MPr) - 0.0004 * Math.sin(3 * MPr)
        + 0.0104 * Math.sin(2 * F) - 0.0051 * Math.sin(M + MPr) - 0.0074 * Math.sin(M - MPr)
        + 0.0004 * Math.sin(2 * F + M) - 0.0004 * Math.sin(2 * F - M) - 0.0006 * Math.sin(2 * F + MPr)
        + 0.0010 * Math.sin(2 * F - MPr) + 0.0005 * Math.sin(M + 2 * MPr);
      return Math.floor(Jde + 0.5 + 7 / 24); // UTC+7
    };

    const sunLongitude = (jdn: number): number => {
      const T = (jdn - 2451545.5 - 7 / 24) / 36525, T2 = T * T;
      const dr = Math.PI / 180;
      let DL = 0, L = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
      const M = (357.52911 + 35999.05029 * T - 0.0001537 * T2) * dr;
      const C = (1.914602 - 0.004817 * T - 0.000014 * T2) * Math.sin(M)
        + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
      L = (L + C) * dr;
      L = L - 2 * Math.PI * Math.floor(L / (2 * Math.PI));
      return Math.floor(L / dr / 30) % 12;
    };

    const jd = jdFromDate(dd, mm, yy);
    const k = Math.floor((jd - 2415021.076998695) / 29.530588853);

    let monthStart = newMoonDay(k);
    if (monthStart > jd) monthStart = newMoonDay(k - 1);

    const lunarDay = jd - monthStart + 1;
    let lunarMonth = sunLongitude(monthStart) + 2;
    if (lunarMonth > 12) lunarMonth -= 12;

    return `${String(lunarDay).padStart(2, "0")}/${String(lunarMonth).padStart(2, "0")}`;
  };

  const getSpouseOf = (id: string): ClanMember | undefined => {
    const self = members.find(m => m.id === id);
    if (self?.spouseId) return members.find(m => m.id === self.spouseId);
    return members.find(m => m.spouseId === id);
  };
  const hasSpouse = (id: string) => !!getSpouseOf(id);

  // Mở modal sửa: nạp dữ liệu thành viên hiện tại vào form (giống openEditModal bên Gia phả)
  const openEditModal = (member: ClanMember) => {
    setEditFormMember(member);
    setFormData({
      fullName: member.fullName,
      gender: member.gender,
      livingStatus: member.livingStatus,
      birthDate: member.birthDate ? member.birthDate.split("T")[0] : "",
      birthDateLunar: member.birthDateLunar || "",
      deathDate: member.deathDate ? member.deathDate.split("T")[0] : "",
      deathDateLunar: member.deathDateLunar || "",
      phone: member.phone || "",
      email: member.email || "",
      currentAddress: member.currentAddress || "",
      originAddress: member.originAddress || "",
      job: member.job || "",
      representativeRole: member.representativeRole || "",
      notes: member.notes || "",
      fatherId: member.fatherId || "",
      motherId: member.motherId || "",
      spouseId: member.spouseId || "",
    });
    setBirthLunarManual(false);
    setDeathLunarManual(false);
    setBirthDateError(false);
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormMember) return;
    setBirthDateError(false);

    // Các trường bắt buộc không được để trống
    if (!formData.fullName.trim()) {
      showError("Lỗi dữ liệu: Họ và tên không được để trống!");
      return;
    }
    if (!formData.birthDate) {
      showError("Lỗi dữ liệu: Ngày sinh không được để trống!");
      return;
    }

    // Ngày sinh phải nhỏ hơn ngày mất
    if (formData.livingStatus === LivingStatus.DECEASED && formData.birthDate && formData.deathDate) {
      if (formData.birthDate > formData.deathDate) {
        setBirthDateError(true);
        showError("Lỗi dữ liệu: Ngày sinh không được lớn hơn ngày mất!");
        return;
      }
    }

    // Ngày sinh phải lớn hơn ngày sinh của cha/mẹ được gán (và không quá gần)
    if (formData.fatherId) {
      const father = members.find(m => m.id === formData.fatherId);
      if (father && formData.birthDate && father.birthDate) {
        if (father.birthDate > formData.birthDate || yearsBetween(father.birthDate, formData.birthDate) < MIN_PARENT_CHILD_GAP_YEARS) {
          setBirthDateError(true);
          showError("Lỗi: Ngày sinh không hợp lệ so với mối quan hệ phả hệ");
          return;
        }
      }
    }
    if (formData.motherId) {
      const mother = members.find(m => m.id === formData.motherId);
      if (mother && formData.birthDate && mother.birthDate) {
        if (mother.birthDate > formData.birthDate || yearsBetween(mother.birthDate, formData.birthDate) < MIN_PARENT_CHILD_GAP_YEARS) {
          setBirthDateError(true);
          showError("Lỗi: Ngày sinh không hợp lệ so với mối quan hệ phả hệ");
          return;
        }
      }
    }

    // Ngày sinh phải nhỏ hơn ngày sinh của các con trực hệ (nếu có)
    const directChildren = members.filter(m => m.id !== editFormMember.id && (m.fatherId === editFormMember.id || m.motherId === editFormMember.id));
    for (const child of directChildren) {
      if (child.birthDate && formData.birthDate && formData.birthDate >= child.birthDate) {
        setBirthDateError(true);
        showError("Lỗi: Ngày sinh không hợp lệ so với mối quan hệ phả hệ");
        return;
      }
    }

    // Nếu Cha/Mẹ liên kết thay đổi → tính lại đời của thành viên này và toàn bộ nhánh con phía dưới
    const oldGeneration = editFormMember.generation;
    const newGeneration = formData.fatherId
      ? (members.find(m => m.id === formData.fatherId)?.generation || 1) + 1
      : formData.motherId
        ? (members.find(m => m.id === formData.motherId)?.generation || 1) + 1
        : oldGeneration;

    onEditMember({
      ...editFormMember,
      fullName: formData.fullName,
      gender: formData.gender,
      livingStatus: formData.livingStatus,
      birthDate: formData.birthDate,
      birthDateLunar: formData.birthDateLunar || undefined,
      deathDate: formData.livingStatus === LivingStatus.DECEASED ? formData.deathDate : undefined,
      deathDateLunar: formData.livingStatus === LivingStatus.DECEASED ? formData.deathDateLunar : undefined,
      phone: formData.phone || undefined,
      email: formData.email || undefined,
      currentAddress: formData.currentAddress || undefined,
      originAddress: formData.originAddress || undefined,
      generation: newGeneration,
      fatherId: formData.fatherId || undefined,
      motherId: formData.motherId || undefined,
      spouseId: formData.spouseId || undefined,
      job: formData.job || undefined,
      representativeRole: formData.representativeRole || undefined,
      notes: formData.notes || undefined,
    });

    // Di chuyển toàn bộ nhánh con phía dưới sang đúng vị trí đời mới, tránh lệch đời
    if (newGeneration !== oldGeneration) {
      const diff = newGeneration - oldGeneration;
      const queue = [editFormMember.id];
      const visited = new Set<string>();
      while (queue.length) {
        const curId = queue.shift()!;
        const children = members.filter(m => (m.fatherId === curId || m.motherId === curId) && !visited.has(m.id));
        for (const child of children) {
          visited.add(child.id);
          onEditMember({ ...child, generation: child.generation + diff });
          queue.push(child.id);
        }
      }
    }

    setShowEditModal(false);
    setEditFormMember(null);
    alert(`Cập nhật thông tin thành viên thành công! Thông tin của ${formData.fullName} đã được lưu và cập nhật.`);
  };

  // Mở modal xóa: kiểm tra ràng buộc phả hệ trước khi cho xóa (không xóa nếu có con/cháu trực hệ)
  const openDeleteModal = (member: ClanMember) => {
    const hasChildren = members.some(m => m.fatherId === member.id || m.motherId === member.id);
    if (hasChildren) {
      showError(`Không thể xóa! Thành viên [${member.fullName}] đang có dữ liệu con/cháu trực hệ trong gia phả. Vui lòng di chuyển hoặc xóa các thành viên con cháu trước.`);
      return;
    }
    setDeleteMemberTarget(member);
    setDeleteReason("");
    setDeleteNote("");
    setShowDeleteModal(true);
  };

  const handleDeleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteReason) {
      showError("Lý do xóa là bắt buộc để đối soát gia đình sau này!");
      return;
    }
    if (!deleteMemberTarget) return;
    const deletedName = deleteMemberTarget.fullName;
    onDeleteMember(deleteMemberTarget.id, deleteReason, deleteNote || undefined);
    setShowDeleteModal(false);
    setDeleteMemberTarget(null);
    setDeleteNote("");
    alert(`Xóa thành viên [${deletedName}] thành công!`);
  };

  const getEffectiveGeneration = (m: ClanMember): number => {
    if (!m.fatherId && !m.motherId) {
      const spouse = getSpouseOf(m.id);
      if (spouse) return spouse.generation;
    }
    return m.generation;
  };

  const getMotherName = (m: ClanMember): string | undefined => {
    if (m.motherId) return members.find(x => x.id === m.motherId)?.fullName;
    if (m.fatherId) {
      const father = members.find(x => x.id === m.fatherId);
      if (!father) return undefined;
      const fatherSpouse = father.spouseId
        ? members.find(x => x.id === father.spouseId)
        : members.find(x => x.spouseId === father.id);
      return fatherSpouse?.fullName;
    }
    return undefined;
  };

  // ── Tính thứ tự anh/em trong cùng nhóm bố (sort theo birthDate) ─────────
  const siblingOrderMap = useMemo(() => {
    const map = new Map<string, number>(); // memberId → thứ tự (1-based)
    // Nhóm theo fatherId
    const groups = new Map<string, ClanMember[]>();
    members.forEach(m => {
      if (!m.fatherId) return;
      const group = groups.get(m.fatherId) || [];
      group.push(m);
      groups.set(m.fatherId, group);
    });
    groups.forEach(siblings => {
      // Tách thành 2 nhóm: có ngày sinh và không có
      const withDate    = siblings.filter(s => s.birthDate).sort((a, b) => a.birthDate!.localeCompare(b.birthDate!));
      const withoutDate = siblings.filter(s => !s.birthDate);
      // Gán thứ tự cho nhóm có ngày sinh
      withDate.forEach((s, idx) => map.set(s.id, idx + 1));
      // Nhóm không có ngày sinh: chỉ gán thứ tự nếu có ít nhất 2 anh/em (để biết là có thứ bậc)
      if (withoutDate.length > 0 && siblings.length > 1) {
        withoutDate.forEach(s => map.set(s.id, -1)); // -1 = "Không rõ thứ tự"
      }
    });
    return map;
  }, [members]);

  const getSiblingBadge = (m: ClanMember): { label: string; cls: string } | null => {
    if (!m.fatherId) return null; // Cụ tổ, không có bố trong hệ thống
    const siblings = members.filter(x => x.fatherId === m.fatherId);
    if (siblings.length < 2) return null; // Con một, không cần badge
    const order = siblingOrderMap.get(m.id);
    if (order === undefined) return null;
    if (order === -1) return { label: "Con thứ ?", cls: "bg-slate-100 text-slate-500 border-slate-200" };
    if (order === 1)  return { label: "Con trưởng", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    return { label: `Con thứ ${order}`, cls: "bg-sky-50 text-sky-700 border-sky-200" };
  };

  const processedMembers = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      const ga = getEffectiveGeneration(a), gb = getEffectiveGeneration(b);
      if (ga !== gb) return ga - gb;
      return (a.birthDate || "").localeCompare(b.birthDate || "");
    });
    return sorted.filter((m) => {
      const matchSearch = m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (m.phone && m.phone.includes(searchTerm)) ||
                          (m.email && m.email.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchGender = genderFilter === "ALL" || m.gender === genderFilter;
      const matchLife = lifeFilter === "ALL" || m.livingStatus === lifeFilter;
      const matchGen = generationFilter === "ALL" || getEffectiveGeneration(m) === Number(generationFilter);
      return matchSearch && matchGender && matchLife && matchGen;
    });
  }, [members, searchTerm, genderFilter, lifeFilter, generationFilter]);

  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedMembers.slice(startIndex, startIndex + itemsPerPage);
  }, [processedMembers, currentPage]);

  const totalPages = Math.ceil(processedMembers.length / itemsPerPage) || 1;

  const generationsList = useMemo(() => {
    const gens = members.map(m => getEffectiveGeneration(m));
    return Array.from(new Set(gens)).sort((a, b) => a - b);
  }, [members]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const datePart = dateStr.split("T")[0];
    const [y, m, d] = datePart.split("-");
    if (!y || !m || !d) return datePart;
    return `${d}/${m}/${y}`;
  };

  const selectedSpouse = useMemo(() => {
    if (!selectedMember?.spouseId) return undefined;
    return members.find(x => x.id === selectedMember.spouseId);
  }, [selectedMember, members]);

  const selectedChildren = useMemo(() => {
    if (!selectedMember) return [];
    return members.filter(x => x.fatherId === selectedMember.id || x.motherId === selectedMember.id);
  }, [selectedMember, members]);

  return (
    <>
      {showStats && <StatsModal members={members} onClose={() => setShowStats(false)} />}

      <div className="flex flex-col gap-4 bg-white border border-rose-100 rounded-2xl p-6 shadow-sm">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center pb-4 border-b border-rose-50">
          <div>
            <h3 className="font-sans font-semibold text-slate-900 text-sm">DANH SÁCH THÀNH VIÊN GIA TỘC</h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">Bảng thống kê đinh đố, đại diện chi họ, đời sinh hoạt thực tế và lý lịch gốc.</p>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center w-full lg:w-auto">
            <button
              onClick={() => setShowStats(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
            >
              <BarChart2 className="w-3.5 h-3.5" /> Thống kê
            </button>

            <div className="relative w-full lg:w-60">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                id="tbl-search-member"
                type="text"
                placeholder="Gõ tên, SĐT tộc viên..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-rose-500"
              />
            </div>

            <select
              id="tbl-gender-filter"
              value={genderFilter}
              onChange={(e) => { setGenderFilter(e.target.value as any); setCurrentPage(1); }}
              className="text-xs font-sans bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none text-slate-700 cursor-pointer"
            >
              <option value="ALL">Tất cả giới</option>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
            </select>

            <select
              id="tbl-status-filter"
              value={lifeFilter}
              onChange={(e) => { setLifeFilter(e.target.value as any); setCurrentPage(1); }}
              className="text-xs font-sans bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none text-slate-700 cursor-pointer"
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="ALIVE">Còn sống</option>
              <option value="DECEASED">Đã khuất</option>
            </select>

            <select
              id="tbl-gen-filter"
              value={generationFilter}
              onChange={(e) => {
                const val = e.target.value;
                setGenerationFilter(val === "ALL" ? "ALL" : Number(val));
                setCurrentPage(1);
              }}
              className="text-xs font-sans bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none text-slate-700 cursor-pointer"
            >
              <option value="ALL">Mọi thế hệ</option>
              {generationsList.map(g => (
                <option key={g} value={g}>Đời thứ {g}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-6">
          {/* BẢNG CHÍNH */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-rose-50 text-slate-400 font-bold tracking-wider">
                  <th className="p-3 font-sans">Họ và tên</th>
                  <th className="p-3 font-sans">Đời</th>
                  <th className="p-3 font-sans">Giới tính</th>
                  <th className="p-3 font-sans font-medium">Bố mẹ đẻ</th>
                  <th className="p-3 font-sans">Vợ / Chồng</th>
                  <th className="p-3 font-sans">Ngày sinh/mất</th>
                  <th className="p-3 font-sans">Quê quán</th>
                  <th className="p-3 font-sans text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50/50">
                {paginatedMembers.length > 0 ? (
                  paginatedMembers.map((m) => {
                    const isDeceased = m.livingStatus === LivingStatus.DECEASED;
                    const fatherName = m.fatherId ? members.find(x => x.id === m.fatherId)?.fullName : undefined;
                    const motherName = getMotherName(m);
                    const siblingBadge = getSiblingBadge(m);
                    const spouseOfM = getSpouseOf(m.id);

                    // Phân biệt "Cụ tổ" (khởi tổ, không có bố mẹ và vợ/chồng cũng không có
                    // bố mẹ trong hệ thống) với "con dâu/con rể" (married-in: không có bố mẹ
                    // trong hệ thống NHƯNG vợ/chồng lại có, vì họ là người ngoài dòng máu).
                    const isFounder = !fatherName && !motherName &&
                      !(spouseOfM && (spouseOfM.fatherId || spouseOfM.motherId));

                    return (
                      <tr key={m.id} className="hover:bg-rose-50/20 text-slate-700 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{m.fullName}</span>
                              {m.representativeRole && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                                  {m.representativeRole}
                                </span>
                              )}
                            </div>
                            {siblingBadge && (
                              <span className={`inline-flex w-fit items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${siblingBadge.cls}`}>
                                {siblingBadge.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-bold text-slate-800">Đời {getEffectiveGeneration(m)}</td>
                        <td className="p-3">
                          {m.gender === Gender.MALE
                            ? <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold text-[10px]">Nam</span>
                            : <span className="text-pink-700 bg-pink-50 px-2 py-0.5 rounded font-semibold text-[10px]">Nữ</span>
                          }
                        </td>
                        <td className="p-3 text-slate-500">
                          {!fatherName && !motherName ? (
                            isFounder ? (
                              <span className="italic text-amber-600 font-medium">Cụ tổ</span>
                            ) : (
                              <span className="italic text-slate-400">Không rõ</span>
                            )
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span>
                                <span className="text-slate-400 text-[10px] mr-1">Bố:</span>
                                {fatherName
                                  ? <span className="font-medium text-slate-700">{fatherName}</span>
                                  : <span className="italic text-slate-400">Không rõ</span>}
                              </span>
                              <span>
                                <span className="text-slate-400 text-[10px] mr-1">Mẹ:</span>
                                {motherName
                                  ? <span className="font-medium text-slate-700">{motherName}</span>
                                  : <span className="italic text-slate-400">Không rõ</span>}
                              </span>
                            </div>
                          )}
                        </td>
                        {/* Vợ / Chồng */}
                        <td className="p-3">
                          {spouseOfM ? (
                            <span className="font-medium text-slate-700 text-xs">{spouseOfM.fullName}</span>
                          ) : (
                            <span className="italic text-slate-400 text-xs">Chưa có</span>
                          )}
                        </td>
                        <td className="p-3 font-medium">
                          {isDeceased
                            ? <span className="text-rose-700 font-semibold">{formatDate(m.birthDate) || "?"} – {formatDate(m.deathDate) || "Không rõ"}</span>
                            : <span className="text-slate-600">{formatDate(m.birthDate)}</span>
                          }
                        </td>
                        <td className="p-3 text-slate-600">
                          {m.originAddress || <span className="italic text-slate-400">Chưa rõ</span>}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              id={`btn-view-member-${m.id}`}
                              onClick={() => setSelectedMember(m)}
                              className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {isLeader && (
                              <>
                                <button
                                  id={`btn-edit-member-${m.id}`}
                                  onClick={() => openEditModal(m)}
                                  className="p-1.5 hover:bg-slate-100 rounded text-amber-600"
                                  title="Sửa"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  id={`btn-delete-member-${m.id}`}
                                  onClick={() => openDeleteModal(m)}
                                  className="p-1.5 hover:bg-red-50 rounded text-red-600"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Không tìm thấy thành viên nào trùng khớp với bộ lọc dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* PHÂN TRANG */}
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-rose-50 text-xs">
              <span className="text-slate-500">
                Hiển thị <strong>{paginatedMembers.length}</strong> trên <strong>{processedMembers.length}</strong> tộc viên.
              </span>
              <div className="flex items-center gap-2">
                <button
                  id="btn-tbl-prev-page"
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border rounded-lg bg-slate-50 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-slate-700 font-bold">Trang {currentPage} / {totalPages}</span>
                <button
                  id="btn-tbl-next-page"
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border rounded-lg bg-slate-50 text-slate-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* CHI TIẾT BÊN PHẢI */}
          {selectedMember && (
            <div className="w-full xl:w-80 bg-slate-50/50 border rounded-2xl p-4 flex flex-col gap-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono">Chi tiết hồ sơ phả hệ</span>
                <button onClick={() => setSelectedMember(null)} className="p-1 hover:bg-slate-200 rounded text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col gap-3 text-xs text-slate-700 leading-relaxed">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`p-2 rounded-xl text-white ${selectedMember.gender === Gender.MALE ? "bg-blue-600" : "bg-pink-600"}`}>
                    <User className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">{selectedMember.fullName}</h4>
                    <p className="text-[10px] text-slate-500">Thế hệ đời {getEffectiveGeneration(selectedMember)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    <span>Trạng thái: <strong>{selectedMember.livingStatus === LivingStatus.ALIVE ? "Còn sống" : "Đã khuất"}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span>Ngày sinh: {formatDate(selectedMember.birthDate)}</span>
                  </div>
                  {selectedMember.livingStatus === LivingStatus.DECEASED ? (
                    <>
                      <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-2 rounded border border-rose-100">
                        <Calendar className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <span>Ngày mất: <strong>{formatDate(selectedMember.deathDate) || "Không rõ"}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span>Quê quán: {selectedMember.originAddress || "Không rõ"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-pink-500 flex-shrink-0" />
                        <span>Vợ/chồng: {selectedSpouse?.fullName || "Không rõ"}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Users className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span>Con: {selectedChildren.length > 0 ? selectedChildren.map(c => c.fullName).join(", ") : "Không rõ"}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {selectedMember.birthDateLunar && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>Lịch âm sinh: {selectedMember.birthDateLunar}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span>SĐT: {selectedMember.phone || "Không rõ"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <span>Email: {selectedMember.email || "Không rõ"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span>Cư ngụ: {selectedMember.currentAddress || "Chưa khai báo"}</span>
                      </div>
                    </>
                  )}
                </div>
                {selectedMember.notes && (
                  <div className="bg-amber-50 p-2 text-[11px] border border-amber-200 text-amber-900 italic rounded-lg mt-2">
                    {selectedMember.notes}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CHỈNH SỬA THÀNH VIÊN (giống modal Sửa bên Gia phả) */}
      {showEditModal && editFormMember && (
        <div id="modal-member-edit" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-lg mt-8 mb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b mb-4">
              <h3 className="font-sans font-semibold text-slate-900 text-base">Cập nhật thông tin thành viên</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Giới tính</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                    className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                  >
                    <option value={Gender.MALE}>Nam</option>
                    <option value={Gender.FEMALE}>Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Trạng thái sinh hoạt</label>
                  <select
                    value={formData.livingStatus}
                    onChange={(e) => setFormData({ ...formData, livingStatus: e.target.value as LivingStatus })}
                    className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                  >
                    <option value={LivingStatus.ALIVE}>Còn sống</option>
                    <option value={LivingStatus.DECEASED}>Đã khuất</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Quê quán</label>
                  <input
                    type="text"
                    value={formData.originAddress}
                    onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Địa chỉ hiện tại</label>
                <input
                  type="text"
                  value={formData.currentAddress}
                  onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                  placeholder="Nơi đang cư trú hiện tại"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Ngày sinh Dương lịch *</label>
                  <input
                    type="date"
                    required
                    value={formData.birthDate || ""}
                    onChange={(e) => { const v = e.target.value; setBirthDateError(false); setFormData(f => ({ ...f, birthDate: v, birthDateLunar: v && !birthLunarManual ? solarToLunar(v) : f.birthDateLunar })); }}
                    className={`w-full border rounded-lg p-2 focus:outline-rose-500 ${birthDateError ? "border-red-500 bg-red-50 text-red-800 ring-1 ring-red-400" : "bg-slate-50"}`}
                  />
                  {birthDateError && (
                    <p className="text-[10px] text-red-600 font-semibold mt-1">Lỗi: Ngày sinh không hợp lệ so với mối quan hệ phả hệ</p>
                  )}
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Ngày sinh Âm lịch
                    {formData.birthDateLunar && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Tự động</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Tự động tính khi chọn ngày DL"
                    value={formData.birthDateLunar}
                    onChange={(e) => { setBirthLunarManual(e.target.value !== ""); setFormData(f => ({ ...f, birthDateLunar: e.target.value })); }}
                    className="w-full border rounded-lg p-2 bg-emerald-50 focus:outline-emerald-400 text-emerald-800"
                  />
                </div>
              </div>

              {formData.livingStatus === LivingStatus.DECEASED && (
                <div className="grid grid-cols-2 gap-3 p-2.5 bg-slate-50 rounded-lg border">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Ngày mất Dương lịch</label>
                    <input
                      type="date"
                      value={formData.deathDate || ""}
                      onChange={(e) => { const v = e.target.value; setFormData(f => ({ ...f, deathDate: v, deathDateLunar: v && !deathLunarManual ? solarToLunar(v) : f.deathDateLunar })); }}
                      className="w-full border rounded-lg p-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Giỗ chạp hằng năm Âm lịch *
                      {formData.deathDateLunar && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Tự động</span>}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Tự động tính khi chọn ngày mất"
                      value={formData.deathDateLunar || ""}
                      onChange={(e) => { setDeathLunarManual(e.target.value !== ""); setFormData(f => ({ ...f, deathDateLunar: e.target.value })); }}
                      className="w-full border rounded-lg p-2 bg-emerald-50 focus:outline-emerald-400 text-emerald-800"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {formData.livingStatus !== LivingStatus.DECEASED && (
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Số điện thoại liên lạc</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border rounded-lg p-2 bg-slate-50"
                    />
                  </div>
                )}
                {formData.livingStatus !== LivingStatus.DECEASED && (
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border rounded-lg p-2 bg-slate-50"
                      placeholder="ten@email.com"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Chức vị tộc / Chức phong</label>
                <input
                  type="text"
                  value={formData.representativeRole}
                  onChange={(e) => setFormData({ ...formData, representativeRole: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Bố liên kết</label>
                  <select
                    value={formData.fatherId}
                    onChange={(e) => setFormData({ ...formData, fatherId: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                  >
                    <option value="">Không rõ hoặc không có</option>
                    {members.filter(m => m.gender === Gender.MALE && m.id !== editFormMember.id).map(m => (
                      <option key={m.id} value={m.id}>Đời {getEffectiveGeneration(m)} - {m.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Mẹ liên kết</label>
                  <select
                    value={formData.motherId}
                    onChange={(e) => setFormData({ ...formData, motherId: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                  >
                    <option value="">Không rõ</option>
                    {members.filter(m => m.gender === Gender.FEMALE && m.id !== editFormMember.id).map(m => (
                      <option key={m.id} value={m.id}>Đời {getEffectiveGeneration(m)} - {m.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Vợ/Chồng liên kết</label>
                <select
                  value={formData.spouseId}
                  onChange={(e) => setFormData({ ...formData, spouseId: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50"
                >
                  <option value="">Chưa có vợ/chồng trên cây</option>
                  {members
                    .filter(m => m.id !== editFormMember.id && m.gender !== formData.gender && (!hasSpouse(m.id) || m.id === editFormMember.spouseId))
                    .map(m => (
                      <option key={m.id} value={m.id}>Đời {getEffectiveGeneration(m)} - {m.fullName} ({m.gender === Gender.MALE ? "Nam" : "Nữ"})</option>
                    ))}
                </select>
              </div>

              {formData.livingStatus !== LivingStatus.DECEASED && (
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Công việc thực hành</label>
                  <input
                    type="text"
                    value={formData.job}
                    onChange={(e) => setFormData({ ...formData, job: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-medium mb-1">Gợi ý sự tích / Ghi chú</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50 h-16 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setBirthDateError(false); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  id="btn-submit-member-edit"
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Cập nhật thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÓA THÀNH VIÊN — ghi lý do xóa (giống modal Xóa bên Gia phả) */}
      {showDeleteModal && deleteMemberTarget && (
        <div id="modal-member-delete" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-md">
            <h3 className="font-sans font-semibold text-slate-900 text-base mb-2">Xác nhận xóa thành viên?</h3>

            <p className="text-xs text-slate-600 leading-relaxed mb-1">
              Bạn có chắc chắn muốn xóa thành viên{" "}
              <strong>[{deleteMemberTarget.fullName}]</strong> khỏi danh sách tộc viên?{" "}
              <span className="text-red-600 font-semibold">Hành động này không thể hoàn tác.</span>
            </p>

            <form onSubmit={handleDeleteSubmit} className="flex flex-col gap-3 text-xs font-sans mt-3">
              <div>
                <label className="block text-red-700 font-bold mb-1">Lý do xóa (Bắt buộc) *</label>
                <input
                  id="input-delete-member-reason"
                  type="text"
                  required
                  placeholder="Ví dụ: Nhập trùng dữ liệu / Đính chính thông tin..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full border border-red-300 bg-red-50/20 rounded-lg p-2 focus:outline-red-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Ghi chú thêm (không bắt buộc)</label>
                <textarea
                  id="input-delete-member-note"
                  placeholder="Thông tin bổ sung nếu cần (tùy chọn)..."
                  value={deleteNote}
                  onChange={(e) => setDeleteNote(e.target.value)}
                  className="w-full border rounded-lg p-2 bg-slate-50 h-16 resize-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  id="btn-confirm-delete-member"
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Xác nhận xóa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LỖI */}
      {errorModal.show && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Cảnh báo !</h3>
            </div>
            <p className="text-sm text-slate-700 font-sans mb-5 leading-relaxed">{errorModal.message}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorModal({ show: false, message: "" })}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg cursor-pointer text-sm transition-colors"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}