/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from "react";
import { 
  Plus, Edit2, Trash2, Search, Filter, ZoomIn, ZoomOut, RotateCcw, 
  User, CheckCircle, Info, Heart, X, AlertOctagon, UserPlus, Link
} from "lucide-react";
import { ClanMember, Gender, LivingStatus, UserRole, UserAccount, AccountStatus } from "../types";

// Bảng màu phân biệt theo từng đời (lặp lại theo chu kỳ nếu vượt quá số màu)
const GENERATION_COLORS = [
  { bg: "#eef4ff", border: "#5b7fdb", text: "#3654a8" }, // Đời 1 - xanh dương
  { bg: "#fdeef2", border: "#d9618c", text: "#a8395e" }, // Đời 2 - hồng
  { bg: "#eefaf0", border: "#4caf7d", text: "#2f7d56" }, // Đời 3 - xanh lá
  { bg: "#fff6e6", border: "#d9a23b", text: "#a8741f" }, // Đời 4 - vàng cam
  { bg: "#f3eefd", border: "#9166d9", text: "#6a3fad" }, // Đời 5 - tím
  { bg: "#fdeeee", border: "#d96a5b", text: "#a8392b" }, // Đời 6 - đỏ gạch
  { bg: "#eef9fb", border: "#3fa9c9", text: "#1f7791" }, // Đời 7 - xanh ngọc
];

interface GiaPhaTreeProps {
  members: ClanMember[];
  currentAccount: UserAccount;
  allAccounts: UserAccount[];
  onAddMember: (newMember: Omit<ClanMember, "id">) => Promise<any>;
  onUpdateMember: (updatedMember: ClanMember) => void;
  onDeleteMember: (id: string, reason: string, notes?: string) => void;
  onLinkAccountToNode: (accountId: string, memberId: string) => void;
  onUnlinkAccount: (accountId: string) => void;
}

export default function GiaPhaTree({
  members,
  currentAccount,
  allAccounts,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onLinkAccountToNode,
  onUnlinkAccount,
}: GiaPhaTreeProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ALIVE" | "DECEASED">("ALL");
  const [selectedMember, setSelectedMember] = useState<ClanMember | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Zoom and Pan states
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Admin form modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
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
    originAddress: "Vụ Bản, Nam Định",
    job: "",
    representativeRole: "",
    notes: "",
    parentCoupleId: "", // ID của người đại diện cha (sẽ tính từ m_genX_...)
    fatherId: "",
    motherId: "",
    spouseId: "",
    isNewFounder: false, // Đánh dấu: thêm Cụ tổ mới phía trên các nhánh gốc hiện có
  });

  const [deleteReason, setDeleteReason] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [deleteNote, setDeleteNote] = useState(""); // Ghi chú thêm (không bắt buộc) khi xóa thành viên

  const [linkAccountModal, setLinkAccountModal] = useState(false);
  const [linkAccountId, setLinkAccountId] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const showError = (message: string) => setErrorModal({ show: true, message });
  // E1 (UC2.4): bôi đỏ ô Ngày sinh khi xung đột logic phả hệ
  const [birthDateError, setBirthDateError] = useState(false);
  // Dropdown chọn tài khoản để liên kết ngay trong modal Sửa (Alt Flow 4a)
  const [editLinkAccountId, setEditLinkAccountId] = useState("");
  // Flag: người dùng đã nhập tay → không ghi đè khi thay đổi ngày DL
  const [birthLunarManual, setBirthLunarManual] = useState(false);
  const [deathLunarManual, setDeathLunarManual] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null); // set khi mở từ nút "Thêm Con"
  const [addSpouseMode, setAddSpouseMode] = useState(false); // set khi mở từ nút "Thêm Vợ/Chồng"

  // UC2.6 — Toolbar states
  const [treeDirection, setTreeDirection] = useState<"vertical" | "horizontal">("vertical");
  const [maxGenDisplay, setMaxGenDisplay] = useState<number>(99); // 99 = hiển thị tất cả
  const [showLegend, setShowLegend] = useState(true);

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
      // Chuẩn hóa góc về [0, 2π) — bắt buộc vì với các năm xa hiện tại (vd. 1800s)
      // giá trị L có thể âm, nếu không chuẩn hóa sẽ ra số tháng âm (vd. "-7")
      L = L - 2 * Math.PI * Math.floor(L / (2 * Math.PI));
      return Math.floor(L / dr / 30) % 12;
    };

    const isLeapMonth = (a11: number, a12: number): boolean => {
      let k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
      let last = 0, i = 1;
      let arc = sunLongitude(newMoonDay(k + i));
      do { last = arc; i++; arc = sunLongitude(newMoonDay(k + i)); } while (arc !== last && i < 14);
      return i - 1 >= 13;
    };

    const jd = jdFromDate(dd, mm, yy);
    const k = Math.floor((jd - 2415021.076998695) / 29.530588853);

    let monthStart = newMoonDay(k);
    if (monthStart > jd) monthStart = newMoonDay(k - 1);

    const a11 = (() => {
      let nm = newMoonDay(Math.floor((jd - 2415021.076998695) / 29.530588853));
      for (let i = 0; i < 14; i++) {
        if (sunLongitude(nm) === 9) return nm;
        nm = newMoonDay(Math.floor((jd - 2415021.076998695) / 29.530588853) - i);
      }
      return nm;
    })();

    const lunarDay = jd - monthStart + 1;

    // Simple month approximation for display (day/month only)
    const lunarCycleK = Math.floor(0.5 + (monthStart - 2415021.076998695) / 29.530588853);
    let lunarMonth = sunLongitude(monthStart) + 2;
    if (lunarMonth > 12) lunarMonth -= 12;

    return `${String(lunarDay).padStart(2, "0")}/${String(lunarMonth).padStart(2, "0")}`;
  };

  const formatDateWithLunar = (dateStr: string, lunarStr?: string): string => {
    if (!dateStr) return "";
    const solar = dateStr.split("T")[0]; // YYYY-MM-DD
    const [y, m, day] = solar.split("-");
    const solarDisplay = `${day}/${m}/${y}`;
    let lunar = lunarStr && lunarStr.trim() ? lunarStr.trim().replace(/Âm lịch|Âm/gi, "").trim() : "";
    // Một số thành viên được thêm trước khi sửa lỗi tính âm lịch có thể đã lưu sẵn
    // chuỗi bị lỗi (chứa dấu trừ trước tháng, vd "27/-7") → tự tính lại cho đúng
    if (!lunar || lunar.includes("-")) {
      lunar = solarToLunar(solar);
    }
    return lunar ? `${solarDisplay} (${lunar} ÂL)` : solarDisplay;
  };

  const isLeader = currentAccount.role === UserRole.LEADER;

  // UC2.6 — Auto scroll đến Node của thành viên khi mở sơ đồ
  React.useEffect(() => {
    if (!isLeader && currentAccount.mappedMemberId && members.length > 0) {
      const myMember = members.find(m => m.id === currentAccount.mappedMemberId);
      if (myMember) {
        const coord = coordinateMap[myMember.id];
        if (coord) {
          setPanX(-(coord.x - 400));
          setPanY(-(coord.y - 200));
          setSelectedMember(myMember);
        }
      }
    }
  }, [members, currentAccount.mappedMemberId]);

  // Một người chỉ được có tối đa 1 vợ/chồng. Kiểm tra cả 2 chiều:
  // - chính người đó đã gán spouseId, hoặc
  // - có người khác đã gán spouseId chỉ về người đó
  const getSpouseOf = (id: string): ClanMember | undefined => {
    const self = members.find(m => m.id === id);
    if (self?.spouseId) return members.find(m => m.id === self.spouseId);
    return members.find(m => m.spouseId === id);
  };
  const hasSpouse = (id: string) => !!getSpouseOf(id);

  // Đời hiệu lực: nếu thành viên không có cha/mẹ ghi nhận trong cây (chỉ liên kết
  // qua hôn nhân, vd vợ được thêm bằng nút "Thêm Vợ/Chồng"), lấy đời theo đúng
  // đời của vợ/chồng để đồng bộ hiển thị trên toàn bộ giao diện
  const getEffectiveGeneration = (m: ClanMember): number => {
    if (!m.fatherId && !m.motherId) {
      const spouse = getSpouseOf(m.id);
      if (spouse) return spouse.generation;
    }
    return m.generation;
  };

  // ── Thứ tự anh/em trong cùng nhóm bố (sort theo birthDate) ────────────────
  const siblingOrderMap = useMemo(() => {
    const map = new Map<string, number>(); // memberId → thứ tự 1-based, -1 = không rõ
    const groups = new Map<string, ClanMember[]>();
    members.forEach(m => {
      if (!m.fatherId) return;
      const g = groups.get(m.fatherId) || [];
      g.push(m);
      groups.set(m.fatherId, g);
    });
    groups.forEach(siblings => {
      if (siblings.length < 2) return; // con một → không cần đánh thứ tự
      const withDate    = [...siblings].filter(s => s.birthDate).sort((a, b) => a.birthDate!.localeCompare(b.birthDate!));
      const withoutDate = siblings.filter(s => !s.birthDate);
      withDate.forEach((s, i) => map.set(s.id, i + 1));
      withoutDate.forEach(s => map.set(s.id, -1));
    });
    return map;
  }, [members]);

  const getSiblingLabel = (m: ClanMember): string | null => {
    if (!m.fatherId) return null;
    const siblings = members.filter(x => x.fatherId === m.fatherId);
    if (siblings.length < 2) return null;
    const order = siblingOrderMap.get(m.id);
    if (order === undefined) return null;
    if (order === -1) return "Con thứ ?";
    if (order === 1)  return "Con trưởng";
    return `Con thứ ${order}`;
  };

  // UC2.6 — Lọc members theo số thế hệ hiển thị
  const visibleMembers = React.useMemo(() => {
    if (maxGenDisplay >= 99) return members;
    return members.filter(m => getEffectiveGeneration(m) <= maxGenDisplay);
  }, [members, maxGenDisplay]);
  const isAdmin = currentAccount.role === UserRole.ADMIN;

  // 1. CHUẨN BỊ TỌA ĐỘ VẼ CÂY GIA PHẢ CHUYÊN NGHIỆP
  // Chúng ta bố trí theo sơ đồ tĩnh thiết kế hoặc thuật toán phân cấp cây
  const coordinateMap = useMemo(() => {
    const NODE_W = 110;
    const NODE_H = 65;
    const H_GAP = 40;    // khoảng cách ngang giữa 2 node
    const COUPLE_GAP = 4; // vợ chồng sát nhau
    const V_GAP = 110;   // khoảng cách dọc giữa các đời

    const coords: Record<string, { x: number; y: number }> = {};
    if (members.length === 0) return coords;

    // spouseSet: id của người là VỢ (Nữ trong cặp) — node chính luôn là Nam
    // Nếu cả 2 đều Nữ hoặc đều Nam, lấy người có spouseId làm chính
    const spouseSet = new Set<string>();
    members.forEach(m => {
      if (!m.spouseId) return;
      const partner = members.find(p => p.id === m.spouseId);
      if (!partner) return;
      // Node chính = Nam; spouse = Nữ
      // Nếu m là Nam và partner là Nữ → partner là spouse
      if (m.gender === 'MALE' && partner.gender === 'FEMALE') {
        spouseSet.add(partner.id);
      }
      // Nếu m là Nữ và partner là Nam → m là spouse (partner sẽ handle khi đến lượt)
      if (m.gender === 'FEMALE' && partner.gender === 'MALE') {
        spouseSet.add(m.id);
      }
      // Cùng giới: người có spouseId nhỏ hơn làm chính
      if (m.gender === partner.gender) {
        if (m.id > partner.id) spouseSet.add(m.id);
        else spouseSet.add(partner.id);
      }
    });

    // nodeMap chỉ chứa node "chính" (không phải spouse)
    type TNode = { id: string; children: string[]; parentId: string | null; spouseId: string | null; width: number; x: number; y: number };
    const nodeMap: Record<string, TNode> = {};
    members.forEach(m => {
      if (!spouseSet.has(m.id)) {
        // spouseId của node chính = id của người kia (nếu có)
        const spouseId = m.spouseId && !spouseSet.has(m.spouseId) ? null : m.spouseId;
        // Tìm spouse của m: người có spouseId = m.id và bị đưa vào spouseSet
        const actualSpouse = members.find(p => p.spouseId === m.id && spouseSet.has(p.id))
                          || members.find(p => p.id === m.spouseId && spouseSet.has(p.id));
        nodeMap[m.id] = { id: m.id, children: [], parentId: null, spouseId: actualSpouse?.id || null, width: 0, x: 0, y: 0 };
      }
    });

    // Gán con vào cha/mẹ chính
    members.forEach(m => {
      if (spouseSet.has(m.id)) return; // skip spouse
      const parentId = m.fatherId || m.motherId;
      if (parentId && nodeMap[parentId]) {
        nodeMap[parentId].children.push(m.id);
        nodeMap[m.id].parentId = parentId;
      }
    });

    // Roots = node chính không có cha/mẹ
    const roots = Object.values(nodeMap)
      .filter(n => !n.parentId)
      .sort((a, b) => {
        const ma = members.find(m => m.id === a.id)!;
        const mb = members.find(m => m.id === b.id)!;
        return ma.generation - mb.generation;
      })
      .map(n => n.id);

    // Width couple unit = node chính + spouse (nếu có)
    const coupleUnitW = (id: string) =>
      nodeMap[id]?.spouseId ? NODE_W * 2 + COUPLE_GAP : NODE_W;

    // Post-order: tính width subtree
    const calcWidth = (id: string): number => {
      const node = nodeMap[id];
      if (!node) return NODE_W;
      if (node.children.length === 0) {
        node.width = coupleUnitW(id);
        return node.width;
      }
      const childTotal = node.children.reduce((s, cid) => s + calcWidth(cid) + H_GAP, 0) - H_GAP;
      node.width = Math.max(coupleUnitW(id), childTotal);
      return node.width;
    };
    roots.forEach(rid => calcWidth(rid));

    // Pre-order: gán tọa độ
    const assignCoords = (id: string, startX: number, depth: number) => {
      const node = nodeMap[id];
      if (!node) return;
      const y = depth * (NODE_H + V_GAP) + 60;

      // Tính tâm ngang của couple unit
      let unitCenterX: number;
      if (node.children.length === 0) {
        unitCenterX = startX + coupleUnitW(id) / 2;
      } else {
        let cursor = startX;
        node.children.forEach(cid => {
          assignCoords(cid, cursor, depth + 1);
          cursor += nodeMap[cid].width + H_GAP;
        });
        const first = nodeMap[node.children[0]];
        const last  = nodeMap[node.children[node.children.length - 1]];
        // Tâm của nhóm con
        const childCenter = (first.x + NODE_W / 2 + last.x + NODE_W / 2) / 2;
        // Đảm bảo couple unit không chồng lên con
        unitCenterX = Math.max(childCenter, startX + coupleUnitW(id) / 2);
      }

      const spouseId = node.spouseId;
      if (spouseId) {
        const member = members.find(m => m.id === id)!;
        if (member.gender === 'MALE') {
          // Chồng trái, vợ phải
          node.x = unitCenterX - NODE_W - COUPLE_GAP / 2;
          coords[id]       = { x: node.x, y };
          coords[spouseId] = { x: unitCenterX + COUPLE_GAP / 2, y };
        } else {
          // Vợ phải, chồng trái
          node.x = unitCenterX + COUPLE_GAP / 2;
          coords[id]       = { x: node.x, y };
          coords[spouseId] = { x: unitCenterX - NODE_W - COUPLE_GAP / 2, y };
        }
      } else {
        node.x = unitCenterX - NODE_W / 2;
        coords[id] = { x: node.x, y };
      }
      node.y = y;
    };

    let rootCursor = 50;
    roots.forEach(rid => {
      assignCoords(rid, rootCursor, 0);
      rootCursor += nodeMap[rid].width + H_GAP * 2;
    });

    return coords;
  }, [members]);

  // Bộ lọc tìm kiếm thành viên
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch = m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (m.job && m.job.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (m.representativeRole && m.representativeRole.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchGender = genderFilter === "ALL" || m.gender === genderFilter;
      const matchStatus = statusFilter === "ALL" || m.livingStatus === statusFilter;
      return matchSearch && matchGender && matchStatus;
    });
  }, [members, searchTerm, genderFilter, statusFilter]);

  // Nhận diện tài khoản đang chờ map (Luồng R1.3)
  const pendingLeaderAccounts = useMemo(() => {
    return allAccounts.filter(acc => acc.status === AccountStatus.PENDING_LEADER);
  }, [allAccounts]);

  // Hành vi chuột kéo pan và thả
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPanX(e.clientX - dragStart.current.x);
    setPanY(e.clientY - dragStart.current.y);
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
  };

  // VẼ ĐƯỜNG LIÊN KẾT GIA ĐÌNH
  const connectionLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const NODE_W = 110;
    const NODE_H = 65;
    const COUPLE_GAP = 4;

    // Helper: tâm dưới của 1 node
    const botCenter = (id: string) => {
      const c = coordinateMap[id];
      return c ? { x: c.x + NODE_W / 2, y: c.y + NODE_H } : null;
    };

    // Helper: điểm nối xuống của 1 thành viên — nếu có vợ/chồng thì lấy điểm giữa cặp
    const coupleBottom = (m: typeof members[0]) => {
      const c = coordinateMap[m.id];
      if (!c) return null;
      if (m.spouseId && coordinateMap[m.spouseId]) {
        const sc = coordinateMap[m.spouseId];
        const midX = (c.x + NODE_W / 2 + sc.x + NODE_W / 2) / 2;
        return { x: midX, y: c.y + NODE_H };
      }
      return { x: c.x + NODE_W / 2, y: c.y + NODE_H };
    };

    // Tìm "người chính" của 1 đứa con (cha nếu có, không thì mẹ)
    const getParentMember = (childId: string) => {
      const child = members.find(m => m.id === childId);
      if (!child) return null;
      if (child.fatherId) return members.find(m => m.id === child.fatherId) || null;
      if (child.motherId) return members.find(m => m.id === child.motherId) || null;
      return null;
    };

    // Nhóm con theo cha/mẹ chính
    const childrenByParent: Record<string, string[]> = {};
    members.forEach(m => {
      const parentId = m.fatherId || m.motherId;
      if (parentId && coordinateMap[m.id] && coordinateMap[parentId]) {
        if (!childrenByParent[parentId]) childrenByParent[parentId] = [];
        childrenByParent[parentId].push(m.id);
      }
    });

    // Vẽ cây cha-con với thanh ngang chung
    Object.entries(childrenByParent).forEach(([parentId, childIds]) => {
      const parent = members.find(m => m.id === parentId);
      if (!parent) return;

      const pc = coordinateMap[parent.id];
      if (!pc) return;

      // Tìm spouse của parent (qua spouseId của parent, hoặc người có spouseId = parent.id)
      const spouseMember = parent.spouseId
        ? members.find(m => m.id === parent.spouseId)
        : members.find(m => m.spouseId === parent.id);
      const sc = spouseMember ? coordinateMap[spouseMember.id] : null;

      // Điểm giữa cặp (hoặc giữa node đơn)
      const parentCenterX = pc.x + NODE_W / 2;
      const spouseCenterX = sc ? sc.x + NODE_W / 2 : parentCenterX;
      const midX = (parentCenterX + spouseCenterX) / 2;
      const originY = pc.y + NODE_H;

      const V_STEM = 40;
      const midY = originY + V_STEM;

      if (sc) {
        // Thanh ngang nối đáy chồng ↔ đáy vợ
        const coupleBarY = originY; // đáy node
        const leftEdge  = Math.min(pc.x, sc.x) + NODE_W; // cạnh phải node trái
        const rightEdge = Math.max(pc.x, sc.x);           // cạnh trái node phải
        lines.push(
          <line key={`couple-bar-${parentId}`}
            x1={leftEdge} y1={coupleBarY}
            x2={rightEdge} y2={coupleBarY}
            stroke="#7c5c45" strokeWidth="2"
          />
        );
        // Đường dọc từ giữa thanh ngang xuống điểm phân nhánh
        lines.push(
          <line key={`couple-down-${parentId}`}
            x1={midX} y1={coupleBarY}
            x2={midX} y2={midY}
            stroke="#7c5c45" strokeWidth="2"
          />
        );
      } else {
        // Không có vợ/chồng: đường dọc thẳng từ đáy node xuống
        lines.push(
          <line key={`stem-${parentId}`}
            x1={midX} y1={originY}
            x2={midX} y2={midY}
            stroke="#7c5c45" strokeWidth="2"
          />
        );
      }

      const childCoords = childIds
        .map(cid => coordinateMap[cid] ? { id: cid, x: coordinateMap[cid].x + NODE_W / 2, y: coordinateMap[cid].y } : null)
        .filter(Boolean) as { id: string; x: number; y: number }[];

      if (childCoords.length === 0) return;

      const leftX = Math.min(midX, ...childCoords.map(c => c.x));
      const rightX = Math.max(midX, ...childCoords.map(c => c.x));

      // Thanh ngang nối tất cả con
      if (childCoords.length > 1 || childCoords[0].x !== midX) {
        lines.push(
          <line key={`hbar-${parentId}`}
            x1={leftX} y1={midY}
            x2={rightX} y2={midY}
            stroke="#7c5c45" strokeWidth="2"
          />
        );
      }

      // Đường dọc từ thanh ngang xuống từng con
      childCoords.forEach(({ id: cid, x: cx, y: cy }) => {
        lines.push(
          <line key={`drop-${cid}`}
            x1={cx} y1={midY}
            x2={cx} y2={cy}
            stroke="#7c5c45" strokeWidth="2"
          />
        );
      });
    });

    // Vẽ liên kết vợ chồng (đường ngang nét đứt với trái tim ở giữa)
    // Vợ chồng đứng sát nhau — không cần đường nối

    return lines;
  }, [members, coordinateMap]);

  // 2. CÁC HÀM XỬ LÝ MẪU (CRUD GIA PHẢ)
  const openAddModal = (parentNodeId?: string) => {
    const parent = members.find(m => m.id === parentNodeId);
    // Tự động lấy vợ/chồng của người được chọn làm cha/mẹ còn lại
    const parentSpouse = parent ? members.find(m => m.id === parent.spouseId || m.spouseId === parent.id) : undefined;
    setFormData({
      fullName: "",
      gender: Gender.MALE,
      livingStatus: LivingStatus.ALIVE,
      birthDate: "1990-01-01",
      birthDateLunar: "15/12 Âm lịch",
      deathDate: "",
      deathDateLunar: "",
      phone: "",
      email: "",
      currentAddress: "",
      originAddress: "Vụ Bản, Nam Định",
      job: "",
      representativeRole: "",
      notes: "",
      parentCoupleId: parentNodeId || "",
      fatherId: parent?.gender === Gender.MALE ? parent.id : (parentSpouse?.gender === Gender.MALE ? parentSpouse.id : ""),
      motherId: parent?.gender === Gender.FEMALE ? parent.id : (parentSpouse?.gender === Gender.FEMALE ? parentSpouse.id : ""),
      spouseId: "",
      isNewFounder: false,
    });
    setBirthLunarManual(false);
    setDeathLunarManual(false);
    setAddParentId(parentNodeId || null);
    setAddSpouseMode(false);
    setShowAddModal(true);
  };

  const openAddSpouseModal = (spouseNode: ClanMember) => {
    setFormData({
      fullName: "",
      gender: spouseNode.gender === Gender.MALE ? Gender.FEMALE : Gender.MALE,
      livingStatus: spouseNode.livingStatus,
      birthDate: "",
      birthDateLunar: "",
      deathDate: "",
      deathDateLunar: "",
      phone: "",
      email: "",
      currentAddress: spouseNode.currentAddress || "",
      originAddress: spouseNode.originAddress || "Vụ Bản, Nam Định",
      job: "",
      representativeRole: "",
      notes: "",
      parentCoupleId: "",
      fatherId: "",
      motherId: "",
      spouseId: spouseNode.id,
      isNewFounder: false,
    });
    setBirthLunarManual(false);
    setDeathLunarManual(false);
    setAddParentId(null);
    setAddSpouseMode(true);
    setShowAddModal(true);
  };


  // Tự động xác định vai vế dựa theo đời, giới tính, thứ tự anh/chị/em
  const autoRole = (fatherId: string, motherId: string, gender: string, spouseId?: string): string => {
    // Nếu là vợ/chồng của ai đó → lấy vai vế từ người kia
    if (spouseId) {
      const spouse = members.find(m => m.id === spouseId);
      if (spouse) {
        const spouseRole = spouse.representativeRole || "";
        // Bảng đối xứng vai vế vợ ↔ chồng
        const roleMap: Record<string, string> = {
          "Cụ tổ":        gender === Gender.FEMALE ? "Cụ tổ bà"    : "Cụ tổ",
          "Cụ tổ bà":     gender === Gender.MALE   ? "Cụ tổ"       : "Cụ tổ bà",
          "Ông tổ":       "Bà tổ",
          "Bà tổ":        "Ông tổ",
          "Con trưởng":   "Dâu trưởng",
          "Con thứ":      "Dâu thứ",
          "Con gái trưởng": "Rể trưởng",
          "Con gái":      "Rể",
          "Trưởng chi":   gender === Gender.FEMALE ? "Vợ trưởng chi" : "Chồng trưởng chi",
        };
        if (roleMap[spouseRole]) return roleMap[spouseRole];
        // Fallback: thêm "bà" hoặc "ông" vào
        const spouseGen = spouse.generation;
        if (spouseGen === 1) return gender === Gender.FEMALE ? "Cụ tổ bà" : "Cụ tổ";
        if (spouseGen === 2) return gender === Gender.FEMALE ? "Bà tổ" : "Ông tổ";
        return gender === Gender.FEMALE ? "Dâu" : "Rể";
      }
    }

    const parentId = fatherId || motherId;
    const parent = members.find(m => m.id === parentId);
    const gen = parent ? parent.generation + 1 : (members.length === 0 ? 1 : 2);

    if (gen === 1) return gender === Gender.FEMALE ? "Cụ tổ bà" : "Cụ tổ";
    if (gen === 2) return gender === Gender.MALE ? "Ông tổ" : "Bà tổ";

    const siblings = members.filter(m =>
      (fatherId && m.fatherId === fatherId) ||
      (motherId && m.motherId === motherId)
    );
    const siblingCount = siblings.length;

    if (gender === Gender.FEMALE) {
      if (siblingCount === 0) return "Con gái trưởng";
      return "Con gái";
    }

    if (siblingCount === 0) return "Con trưởng";
    return "Con thứ";
  };

  // Khoảng cách tuổi sinh học tối thiểu hợp lý giữa cha/mẹ và con (năm)
  const MIN_PARENT_CHILD_GAP_YEARS = 13;

  const yearsBetween = (d1: string, d2: string) => {
    const a = new Date(d1).getTime(), b = new Date(d2).getTime();
    return (b - a) / (1000 * 60 * 60 * 24 * 365.25);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // [1] Năm sinh không được lớn hơn năm mất
    if (formData.livingStatus === LivingStatus.DECEASED && formData.birthDate && formData.deathDate) {
      if (formData.birthDate > formData.deathDate) {
        showError("Lỗi dữ liệu: Ngày sinh không được lớn hơn ngày mất!");
        return;
      }
    }

    // [2] SubFlow S-1 + Alternate Flow 8a: Ngày sinh của con không thể nhỏ hơn,
    // hoặc xảy ra quá gần, ngày sinh của cha/mẹ
    if (formData.fatherId) {
      const father = members.find(m => m.id === formData.fatherId);
      if (father && formData.birthDate && father.birthDate) {
        if (father.birthDate > formData.birthDate || yearsBetween(father.birthDate, formData.birthDate) < MIN_PARENT_CHILD_GAP_YEARS) {
          showError("Lỗi: Ngày sinh của con không hợp lý (xảy ra trước hoặc quá gần) ngày sinh của cha/mẹ. Vui lòng kiểm tra lại!");
          return;
        }
      }
    }
    if (formData.motherId) {
      const mother = members.find(m => m.id === formData.motherId);
      if (mother && formData.birthDate && mother.birthDate) {
        if (mother.birthDate > formData.birthDate || yearsBetween(mother.birthDate, formData.birthDate) < MIN_PARENT_CHILD_GAP_YEARS) {
          showError("Lỗi: Ngày sinh của con không hợp lý (xảy ra trước hoặc quá gần) ngày sinh của cha/mẹ. Vui lòng kiểm tra lại!");
          return;
        }
      }
    }

    // [3] BR3: Không cho thành viên "lơ lửng" — trừ cụ tổ (cây đang rỗng) hoặc
    // trừ trường hợp người dùng chủ động đánh dấu "Thêm Cụ tổ mới" (gắn các
    // nhánh gốc hiện có làm con của Cụ tổ mới này)
    const isFounder = members.length === 0;
    if (!isFounder && !formData.isNewFounder && !formData.fatherId && !formData.motherId && !formData.spouseId) {
      showError("Lỗi ràng buộc: Thành viên mới phải được gắn với ít nhất một mối quan hệ (Cha, Mẹ hoặc Vợ/Chồng) đã tồn tại trên cây gia phả!");
      return;
    }

    // Ghi nhớ danh sách các nhánh gốc hiện có (trước khi thêm Cụ tổ mới),
    // để sau khi tạo xong sẽ gắn lại làm con của Cụ tổ mới này
    const existingRootsBeforeAdd = formData.isNewFounder
      ? members.filter(m => !m.fatherId && !m.motherId)
      : [];

    // [4] BR2: Một node chỉ được liên kết tối đa 1 tài khoản
    if (linkedAccountId) {
      const alreadyLinked = members.some(m => (m as any).accountId === linkedAccountId);
      if (alreadyLinked) {
        showError("Lỗi ràng buộc: Tài khoản này đã được liên kết với một thành viên khác trên cây gia phả!");
        return;
      }
    }

    const created = await onAddMember({
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
      generation: formData.fatherId
        ? (members.find(m => m.id === formData.fatherId)?.generation || 1) + 1
        : formData.motherId
          ? (members.find(m => m.id === formData.motherId)?.generation || 1) + 1
          : formData.spouseId
            ? (members.find(m => m.id === formData.spouseId)?.generation || 1) // Vợ/chồng cùng đời với người kia
            : (members.length === 0 ? 1 : 1), // Cụ tổ = đời 1
      fatherId: formData.fatherId || undefined,
      motherId: formData.motherId || undefined,
      spouseId: formData.spouseId || undefined,
      job: formData.job || undefined,
      representativeRole: formData.representativeRole || autoRole(formData.fatherId, formData.motherId, formData.gender, formData.spouseId) || undefined,
      notes: formData.notes || undefined,
    });

    // Bước 9: Liên kết tài khoản dùng ID thật vừa được trả về từ server (tránh đoán sai Node)
    if (linkedAccountId && created && created.id) {
      onLinkAccountToNode(linkedAccountId, created.id);
      setLinkedAccountId("");
    }

    // Thêm Cụ tổ mới: gắn lại toàn bộ các nhánh gốc hiện có (trước đó đang "lơ lửng")
    // làm con trực hệ của Cụ tổ mới, đồng thời dồn lại đời (generation) của toàn bộ
    // nhánh con phía dưới mỗi nhánh gốc đó để khớp với vị trí mới trên cây.
    if (formData.isNewFounder && created && created.id && existingRootsBeforeAdd.length > 0) {
      const newFounderGeneration = created.generation ?? 1;

      // Xác định ai là "node chính" trong 1 cặp vợ chồng (theo đúng quy ước
      // dùng trong thuật toán vẽ cây ở coordinateMap): Nam là chính, Nữ là spouse.
      // Chỉ gắn fatherId cho node chính; người vợ vẫn được tự động xếp đúng vị trí
      // qua liên kết spouseId, không cần set fatherId riêng.
      const isPrimaryRoot = (m: ClanMember) => {
        if (!m.spouseId) return true;
        const partner = members.find(p => p.id === m.spouseId);
        if (!partner) return true;
        if (m.gender === Gender.MALE && partner.gender === Gender.FEMALE) return true;
        if (m.gender === Gender.FEMALE && partner.gender === Gender.MALE) return false;
        return m.id < partner.id; // cùng giới: lấy id nhỏ hơn làm chính
      };

      existingRootsBeforeAdd.forEach(root => {
        const diff = (newFounderGeneration + 1) - root.generation;

        onUpdateMember({
          ...root,
          fatherId: isPrimaryRoot(root) ? created.id : root.fatherId,
          generation: root.generation + diff,
        });

        if (diff !== 0) {
          const queue = [root.id];
          const visited = new Set<string>();
          while (queue.length) {
            const curId = queue.shift()!;
            const children = members.filter(m => (m.fatherId === curId || m.motherId === curId) && !visited.has(m.id));
            for (const child of children) {
              visited.add(child.id);
              onUpdateMember({ ...child, generation: child.generation + diff });
              queue.push(child.id);
            }
          }
        }
      });
    }

    setShowAddModal(false);
    // Bước 10: Hiển thị thông báo thành công
    alert("Đã thêm thành viên mới vào gia phả thành công!");
  };


  const openEditModal = (member: ClanMember) => {
    setSelectedMember(member);
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
      originAddress: member.originAddress || "Vụ Bản, Nam Định",
      job: member.job || "",
      representativeRole: member.representativeRole || "",
      notes: member.notes || "",
      parentCoupleId: member.fatherId || "",
      fatherId: member.fatherId || "",
      motherId: member.motherId || "",
      spouseId: member.spouseId || "",
      isNewFounder: false,
    });
    setBirthLunarManual(false);
    setDeathLunarManual(false);
    setBirthDateError(false);
    setEditLinkAccountId("");
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setBirthDateError(false);

    // S-1: các trường bắt buộc không được để trống
    if (!formData.fullName.trim()) {
      showError("Lỗi dữ liệu: Họ và tên không được để trống!");
      return;
    }
    if (!formData.birthDate) {
      showError("Lỗi dữ liệu: Ngày sinh không được để trống!");
      return;
    }

    // [1] Ngày sinh phải nhỏ hơn ngày mất
    if (formData.livingStatus === LivingStatus.DECEASED && formData.birthDate && formData.deathDate) {
      if (formData.birthDate > formData.deathDate) {
        setBirthDateError(true);
        showError("Lỗi dữ liệu: Ngày sinh không được lớn hơn ngày mất!");
        return;
      }
    }

    // [2] E1: Ngày sinh phải lớn hơn ngày sinh của cha/mẹ được gán (và không quá gần)
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

    // [3] E1: Ngày sinh phải nhỏ hơn ngày sinh của các con trực hệ (nếu có)
    const directChildren = members.filter(m => m.id !== selectedMember.id && (m.fatherId === selectedMember.id || m.motherId === selectedMember.id));
    for (const child of directChildren) {
      if (child.birthDate && formData.birthDate && formData.birthDate >= child.birthDate) {
        setBirthDateError(true);
        showError("Lỗi: Ngày sinh không hợp lệ so với mối quan hệ phả hệ");
        return;
      }
    }

    // BR3: Nếu Cha/Mẹ liên kết thay đổi → tính lại đời của Node này và toàn bộ nhánh con phía dưới
    const oldGeneration = selectedMember.generation;
    const newGeneration = formData.fatherId
      ? (members.find(m => m.id === formData.fatherId)?.generation || 1) + 1
      : formData.motherId
        ? (members.find(m => m.id === formData.motherId)?.generation || 1) + 1
        : oldGeneration;

    onUpdateMember({
      ...selectedMember,
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

    // BR3: di chuyển toàn bộ nhánh con phía dưới sang đúng vị trí đời mới, tránh Node mồ côi/lệch đời
    if (newGeneration !== oldGeneration) {
      const diff = newGeneration - oldGeneration;
      const queue = [selectedMember.id];
      const visited = new Set<string>();
      while (queue.length) {
        const curId = queue.shift()!;
        const children = members.filter(m => (m.fatherId === curId || m.motherId === curId) && !visited.has(m.id));
        for (const child of children) {
          visited.add(child.id);
          onUpdateMember({ ...child, generation: child.generation + diff });
          queue.push(child.id);
        }
      }
    }

    // Alt Flow 4a — Trường hợp A: Node đang trống tài khoản, Trưởng họ chọn 1 tài khoản để map vào
    if (editLinkAccountId) {
      onLinkAccountToNode(editLinkAccountId, selectedMember.id);
      setEditLinkAccountId("");
    }

    setShowEditModal(false);
    setSelectedMember(null);
    // Bước 9: thông báo thành công
    alert(`Cập nhật thông tin thành viên thành công! Thông tin của ${formData.fullName} đã được lưu và cập nhật trên cây gia phả.`);
  };

  const openDeleteModal = (id: string, name: string) => {
    // Kiểm tra ràng buộc phả hệ trước khi xóa (BR2: Tuyệt đối không xóa nếu có con cháu trực thuộc)
    const hasChildren = members.some(m => m.fatherId === id || m.motherId === id);
    if (hasChildren) {
      showError(`Không thể xóa! Thành viên [${name}] đang có dữ liệu con/cháu trực hệ trong gia phả. Vui lòng di chuyển hoặc xóa các thành viên con cháu trước.`);
      return;
    }

    setDeleteId(id);
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
    const deletedName = selectedMember?.fullName || "";
    onDeleteMember(deleteId, deleteReason, deleteNote || undefined);
    setShowDeleteModal(false);
    setSelectedMember(null);
    setDeleteNote("");
    // Bước 8: Hiển thị thông báo thành công (log lịch sử được ghi nhận ở backend)
    alert(`Xóa thành viên ${deletedName ? `[${deletedName}] ` : ""}thành công!`);
  };

  const handleLinkAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkAccountId || !selectedMember) return;
    onLinkAccountToNode(linkAccountId, selectedMember.id);
    setLinkAccountModal(false);
    
    // Tự động gán thông tin tài khoản cho nút thành viên
    const targetAcc = allAccounts.find(a => a.id === linkAccountId);
    if (targetAcc) {
      onUpdateMember({
        ...selectedMember,
        phone: targetAcc.phone,
        email: targetAcc.email,
        notes: `Gia phả đã liên kết với tài khoản hệ thống của ${targetAcc.fullName}.`
      });
    }
  };

  // Tra cứu tài khoản đang liên kết với Node
  const getLinkedAccount = (mId: string) => {
    return allAccounts.find(acc => acc.mappedMemberId === mId);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 2.1 HEADER TITLE PANEL & TOOLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-stone-200 pb-5">
        <div>
          <h2 className="font-serif italic text-3xl font-bold text-stone-900 tracking-tight">Sơ đồ gia tộc</h2>
          <p className="text-[10px] tracking-wider text-stone-400 font-sans font-bold uppercase mt-1">BẢN ĐỒ KẾT NỐI 18 THẾ HỆ NGUYỄN TỘC</p>
        </div>
        
        {/* Right Controls: add member, search, filters button */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          {/* Search Input Custom pill design */}
          <div className="relative w-full sm:w-64 max-w-full">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-stone-400" />
            <input
              id="input-search-member"
              type="text"
              placeholder="Tìm tên tộc viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2.5 text-xs bg-stone-100/70 border border-stone-200 hover:bg-stone-50 focus:bg-white rounded-full focus:outline-none transition-all placeholder:text-stone-400 text-stone-800 font-medium"
            />
          </div>

          {/* Filter Toggle circle button */}
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
              showFilters || genderFilter !== "ALL" || statusFilter !== "ALL"
                ? "border-[#8c4f2b] bg-amber-50/50 text-[#8c4f2b]" 
                : "border-stone-200 hover:bg-stone-50 text-stone-600 bg-white"
            }`}
            title="Bộ lọc nâng cao"
          >
            <Filter className="w-4 h-4" />
          </button>

          {/* Zoom state floating panel inside header */}
          <div className="flex items-center gap-0.5 border border-stone-200/80 bg-white px-2.5 py-1.5 rounded-full text-stone-700 text-xs shadow-custom shadow-stone-100/10">
            <button
              id="btn-tree-zoom-out"
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.1, 0.5))}
              className="p-1 text-stone-500 hover:text-[#8c4f2b] transition-colors cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono text-stone-600 px-2 font-bold border-x border-stone-100">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              id="btn-tree-zoom-in"
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.1, 1.8))}
              className="p-1 text-stone-500 hover:text-[#8c4f2b] transition-colors cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              id="btn-tree-zoom-reset"
              onClick={handleResetZoom}
              className="p-1 text-stone-400 hover:text-[#8c4f2b] transition-colors cursor-pointer"
              title="Đặt lại"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* UC2.6 Toolbar mở rộng */}
          <div className="flex items-center gap-1.5 border border-stone-200 bg-white px-2.5 py-1.5 rounded-full text-xs shadow-sm">
            {/* Đổi hướng vẽ */}
            <button
              onClick={() => setTreeDirection(d => d === "vertical" ? "horizontal" : "vertical")}
              title={treeDirection === "vertical" ? "Chuyển sang ngang" : "Chuyển sang dọc"}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-100 text-stone-600 cursor-pointer text-[10px] font-bold"
            >
              {treeDirection === "vertical" ? "↕ Dọc" : "↔ Ngang"}
            </button>
            <div className="w-px h-4 bg-stone-200" />
            {/* Chọn số thế hệ */}
            <select
              value={maxGenDisplay}
              onChange={e => setMaxGenDisplay(Number(e.target.value))}
              className="text-[10px] font-bold text-stone-600 bg-transparent border-none outline-none cursor-pointer"
              title="Số thế hệ hiển thị"
            >
              <option value={99}>Tất cả đời</option>
              <option value={2}>2 đời</option>
              <option value={3}>3 đời</option>
              <option value={4}>4 đời</option>
              <option value={5}>5 đời</option>
              <option value={6}>6 đời</option>
            </select>
            <div className="w-px h-4 bg-stone-200" />
            {/* Ẩn/hiện chú giải */}
            <button
              onClick={() => setShowLegend(v => !v)}
              className={`text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer ${showLegend ? "text-[#8c4f2b] bg-amber-50" : "text-stone-400 hover:bg-stone-100"}`}
              title="Ẩn/hiện chú giải màu sắc"
            >
              {showLegend ? "🔵 Chú giải" : "◯ Chú giải"}
            </button>
          </div>

          {/* Solid warm brown button for adding, visible if leader or treasurer or admin */}
          {(isAdmin || isLeader) && (
            <button
              id="btn-add-primary-member"
              onClick={() => setShowAddModal(true)}
              className="bg-[#8c4f2b] hover:bg-[#723e20] text-stone-50 px-4 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-sm ml-auto sm:ml-0"
            >
              + Thêm thành viên mới
            </button>
          )}
        </div>
      </div>

      {/* COLLAPSIBLE FILTER WORKSPACE PANEL */}
      {showFilters && (
        <div className="bg-stone-50/60 border border-stone-200/50 rounded-2xl p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-semibold font-sans">Giới tính:</span>
            <select
              id="select-gender-filter"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
              className="text-xs font-sans bg-white border border-stone-200 hover:border-stone-300 px-3 py-1.5 rounded-lg outline-none text-stone-700 cursor-pointer"
            >
              <option value="ALL">Tất cả giới tính</option>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-semibold font-sans">Trạng thái:</span>
            <select
              id="select-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs font-sans bg-white border border-stone-200 hover:border-stone-300 px-3 py-1.5 rounded-lg outline-none text-stone-700 cursor-pointer"
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="ALIVE">Còn sống</option>
              <option value="DECEASED">Đã khuất</option>
            </select>
          </div>
          
          <button 
            onClick={() => { setGenderFilter("ALL"); setStatusFilter("ALL"); setSearchTerm(""); }}
            className="text-[11px] text-[#8c4f2b] hover:underline font-bold font-sans ml-auto transition-colors cursor-pointer"
          >
            Mặc định lại bộ lọc
          </button>
        </div>
      )}

      {/* THÔNG BÁO CHO TRƯỞNG HỌ VỀ THÀNH VIÊN ĐANG CHỜ MAP CẬP NHẬT */}
      {isLeader && pendingLeaderAccounts.length > 0 && (
        <div id="leader-pending-notice" className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex gap-2">
            <AlertOctagon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-sans font-semibold text-amber-900 text-sm">YÊU CẦU LIÊN KẾT GIA PHẢ MỚI ({pendingLeaderAccounts.length})</h4>
              <p className="text-xs text-amber-700/90 font-sans mt-0.5">Có tài khoản đã duyệt hồ sơ kỹ thuật, đang chờ bạn ánh xạ vào sơ đồ (Node) gia phả thích hợp và bổ nhiệm chức vụ.</p>
            </div>
          </div>
          <p className="text-xs text-stone-500 bg-white border border-amber-200/50 rounded-lg p-2 md:self-center font-sans shadow-sm">
            Mẹo: Click vào thành viên bất kỳ &gt; Chọn <strong>Liên kết tài khoản dòng họ</strong>.
          </p>
        </div>
      )}

      {/* SƠ ĐỒ CÂY TƯƠNG TÁC CHÍNH (CANVAS VIEW) */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div 
          id="tree-viewport-container"
          className="flex-1 min-h-[580px] bg-[radial-gradient(#e5e2db_1px,transparent_1px)] [background-size:24px_24px] bg-[#fdfdfc] border border-stone-200 rounded-2xl relative overflow-hidden select-none cursor-grab shadow-sm"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          {/* Header chỉ dẫn trên canvas */}
          <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-stone-200 shadow-custom shadow-stone-100/20 pointer-events-none">
            <h5 className="text-[10px] uppercase font-bold tracking-wider text-stone-400 font-sans">Bản đồ Gia Phả Hệ</h5>
            <p className="text-[9px] text-stone-500 mt-0.5">Kéo thả chuột để di chuyển • Cuộn để phóng to</p>
          </div>

          {/* Chú giải màu theo từng đời — UC2.6, ẩn/hiện theo toolbar */}
          {showLegend && (
            <div className="absolute top-4 right-4 z-10 flex flex-wrap gap-1.5 pointer-events-none max-w-[260px] justify-end">
              {Array.from(new Set(visibleMembers.map(m => getEffectiveGeneration(m)))).sort((a, b) => a - b).map(gen => {
                const c = GENERATION_COLORS[(gen - 1) % GENERATION_COLORS.length];
                return (
                  <span
                    key={gen}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: c.bg, border: `2px solid ${c.border}`, color: c.text }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.border }}></span> Đời thứ {gen}
                  </span>
                );
              })}
            </div>
          )}

          {/* VIEWPORT SVG CHÍNH */}
          <div 
            id="tree-svg-viewport"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
              transformOrigin: "center center",
              transition: isDragging.current ? "none" : "transform 0.15s ease-out"
            }}
            className="w-full h-full min-h-[580px] origin-center"
          >
            <svg className="absolute inset-0 w-[1250px] h-[600px] overflow-visible">
              <defs>
                {/* Mũi tên chỉ huyết hệ */}
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="5"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#8c6c58" />
                </marker>
              </defs>

              {/* Vẽ đường liên kết */}
              {connectionLines}

              {/* Vẽ các Thẻ Thành Viên (HTML overlay hoặc SVG group g) */}
              {visibleMembers.map((m) => {
                const coord = coordinateMap[m.id];
                if (!coord) return null;

                const isSelected = selectedMember?.id === m.id;
                const hasAccountLinked = getLinkedAccount(m.id);
                const genColor = GENERATION_COLORS[(getEffectiveGeneration(m) - 1) % GENERATION_COLORS.length];

                // Highlight tìm kiếm trùng khớp
                const isSearched = searchTerm !== "" && (
                  m.fullName.toLowerCase().includes(searchTerm.toLowerCase())
                );

                const siblingLabel = getSiblingLabel(m);
                const spouseNode   = getSpouseOf(m.id);
                // Chỉ hiển thị tên vợ/chồng trên node của người CHÍNH (không phải spouse node)
                // Người chính = người có fatherId, hoặc người có spouseId trỏ đến người kia
                const isMainNode = !!m.fatherId || (!m.fatherId && !m.motherId && !!m.spouseId);
                const showSpouseName = isMainNode && !!spouseNode;

                return (
                  <g key={m.id}>
                    <foreignObject
                      x={coord.x}
                      y={coord.y}
                      width="120"
                      height="75"
                      className="overflow-visible"
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMember(m);
                        }}
                        style={{
                          backgroundColor: isSelected ? "#faf6f2" : genColor.bg,
                          borderColor: isSelected ? "#8c4f2b" : genColor.border
                        }}
                        className={`relative w-[110px] h-[65px] rounded-xl p-2 flex flex-col justify-center gap-0.5 text-left cursor-pointer transition-all border-2 ${
                          isSelected ? "ring-3 ring-[#8c4f2b]/20 scale-105 shadow-md" : "hover:brightness-95 shadow-xs"
                        } ${isSearched ? "ring-2 ring-amber-500 animate-pulse" : ""}`}
                      >
                        {hasAccountLinked && (
                          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#8c4f2b] rounded-full" title="Tài khoản hoạt động"></span>
                        )}

                        {/* Badge thứ tự anh/em */}
                        {siblingLabel && (
                          <span
                            className="absolute top-1 left-1 px-1 py-0.5 rounded text-[7px] font-bold uppercase leading-none"
                            style={{
                              backgroundColor: siblingLabel === "Con trưởng" ? "#fef3c7" : "#e0f2fe",
                              color:           siblingLabel === "Con trưởng" ? "#92400e"  : "#0369a1",
                              border:          `1px solid ${siblingLabel === "Con trưởng" ? "#fbbf24" : "#7dd3fc"}`,
                            }}
                          >
                            {siblingLabel}
                          </span>
                        )}

                        {/* Tên thành viên */}
                        <h4
                          className={`font-serif font-bold leading-tight truncate ${siblingLabel ? "mt-2.5 text-[10px]" : "text-[11px]"}`}
                          style={{ color: isSelected ? "#3a2a1c" : genColor.text }}
                        >
                          {m.fullName}
                        </h4>

                        {/* Vai trò hoặc tên vợ/chồng */}
                        {showSpouseName ? (
                          <div className="text-[8px] font-sans leading-none truncate"
                            style={{ color: isSelected ? "#8c4f2b" : genColor.text, opacity: 0.75 }}>
                            <span className="truncate">{spouseNode!.fullName}</span>
                          </div>
                        ) : (
                          <div
                            className="text-[8px] font-sans font-bold leading-none uppercase tracking-wide truncate"
                            style={{ color: isSelected ? "#8c4f2b" : genColor.text, opacity: 0.8 }}
                          >
                            {m.representativeRole || m.job || "Hậu sinh"}
                          </div>
                        )}
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* 2.2 BẢNG THÔNG TIN CHI TIẾT THÀNH VIÊN (DRAWER/DETAIL PANEL) */}
        <div id="tree-detail-drawer" className="w-full xl:w-96 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
          {selectedMember ? (
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex justify-between items-start pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2.5">
                    <span className={`p-2.5 rounded-xl text-white ${
                      selectedMember.gender === Gender.MALE ? "bg-[#8c4f2b]" : "bg-[#f2cfb8]"
                    }`}>
                      <User className="w-5 h-5 text-white" />
                    </span>
                    <div>
                      <h3 className="font-serif font-bold text-stone-900 text-sm">{selectedMember.fullName}</h3>
                      <p className="text-[10px] text-stone-400 font-sans font-bold uppercase tracking-wider">
                        Thế hệ đời thứ {
                          (!selectedMember.fatherId && !selectedMember.motherId && getSpouseOf(selectedMember.id))
                            ? getSpouseOf(selectedMember.id)!.generation
                            : selectedMember.generation
                        } • {
                          selectedMember.gender === Gender.MALE
                            ? "Đinh Nam"
                            : (() => {
                                const spouse = getSpouseOf(selectedMember.id);
                                const isMother = members.some(m =>
                                  m.motherId === selectedMember.id ||
                                  (spouse && m.fatherId === spouse.id)
                                );
                                return isMother ? "Phụ mẫu" : "Con gái";
                              })()
                        }
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedMember(null)} className="p-1 hover:bg-stone-100 rounded transition-colors cursor-pointer">
                    <X className="w-4 h-4 text-stone-400" />
                  </button>
                </div>

                {/* THÔNG TIN CHI TIẾT */}
                <div className="py-4 flex flex-col gap-3 text-xs leading-relaxed text-slate-700">
                  <div className="grid grid-cols-3 gap-1 pt-1 border-b border-slate-50">
                    <span className="text-slate-400 font-sans">Trạng thái:</span>
                    <span className="col-span-2 font-sans font-semibold">
                      {selectedMember.livingStatus === LivingStatus.ALIVE ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Còn sống</span>
                      ) : (
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">Đã khuất</span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 pt-1 border-b border-slate-50">
                    <span className="text-slate-400 font-sans">Ngày sinh:</span>
                    <span className="col-span-2 font-sans font-medium">
                      {selectedMember.birthDate && (
                        <span>{formatDateWithLunar(selectedMember.birthDate, selectedMember.birthDateLunar)}</span>
                      )}
                    </span>
                  </div>

                  {selectedMember.livingStatus === LivingStatus.DECEASED && (
                    <>
                      <div className="grid grid-cols-3 gap-1 pt-1 border-b border-slate-50">
                        <span className="text-slate-400 font-sans">Ngày mất/giỗ:</span>
                        <span className="col-span-2 font-sans font-medium text-rose-700">
                          {selectedMember.deathDate && formatDateWithLunar(selectedMember.deathDate, selectedMember.deathDateLunar)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-3 gap-1 pt-1 border-b border-slate-50">
                    <span className="text-slate-400 font-sans">Quê quán:</span>
                    <span className="col-span-2 font-sans">{selectedMember.originAddress || "Chưa cập nhật"}</span>
                  </div>

                  {selectedMember.livingStatus !== LivingStatus.DECEASED && (
                    <div className="grid grid-cols-3 gap-1 pt-1 border-b border-slate-50">
                      <span className="text-slate-400 font-sans">Nghề nghiệp:</span>
                      <span className="col-span-2 font-sans font-medium">{selectedMember.job || "Chưa rõ"}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1 pt-1 border-b border-slate-50">
                    <span className="text-slate-400 font-sans">Chức danh:</span>
                    <span className="col-span-2 text-amber-700 font-sans font-bold">{selectedMember.representativeRole || "Thành viên gia đình"}</span>
                  </div>

                  {/* Quan hệ bố mẹ / vợ chồng hiển thị chi tiết tên */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2 flex flex-col gap-1.5">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Mối quan hệ huyết thống</div>
                    {(() => {
                      const father = selectedMember.fatherId
                        ? members.find(m => m.id === selectedMember.fatherId)
                        : (selectedMember.motherId ? getSpouseOf(selectedMember.motherId) : undefined);
                      const mother = selectedMember.motherId
                        ? members.find(m => m.id === selectedMember.motherId)
                        : (selectedMember.fatherId ? getSpouseOf(selectedMember.fatherId) : undefined);
                      return (
                        <>
                          {father && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Cha:</span>
                              <span className="font-medium text-slate-800">{father.fullName}</span>
                            </div>
                          )}
                          {mother && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Mẹ:</span>
                              <span className="font-medium text-slate-800">{mother.fullName}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {(() => {
                      const spouse = getSpouseOf(selectedMember.id);
                      if (!spouse) return null;
                      const label = spouse.gender === Gender.MALE ? "Chồng" : "Vợ";
                      return (
                        <div className="flex justify-between">
                          <span className="text-slate-400">{label}:</span>
                          <span className="font-medium text-rose-800">{spouse.fullName}</span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const spouse = getSpouseOf(selectedMember.id);
                      const children = members.filter(m =>
                        m.fatherId === selectedMember.id ||
                        m.motherId === selectedMember.id ||
                        (spouse && (m.fatherId === spouse.id || m.motherId === spouse.id))
                      );
                      if (children.length === 0) return null;
                      return (
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-400 flex-shrink-0">Con cái:</span>
                          <span className="font-medium text-slate-800 text-right">{children.map(c => c.fullName).join(", ")}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Tài khoản liên kết hệ thống — chỉ hiển thị với thành viên còn sống */}
                  {selectedMember.livingStatus !== LivingStatus.DECEASED && (
                    <div className="py-2">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Liên kết tài khoản ứng dụng</div>
                      {getLinkedAccount(selectedMember.id) ? (
                        <div className="p-2 border border-emerald-200 bg-emerald-50/50 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Đã liên kết với tài khoản <strong>{getLinkedAccount(selectedMember.id)?.fullName}</strong></span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 border border-slate-100 bg-slate-50 rounded-lg text-[10px] text-slate-500">
                          Chưa có tài khoản ứng dụng nào ánh xạ vào vị trí rẽ nhánh này.
                        </div>
                      )}
                    </div>
                  )}

                  {selectedMember.notes && (
                    <div className="bg-amber-50 p-2.5 rounded-lg text-amber-900 border border-amber-100 italic">
                      Ghi chú: {selectedMember.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* HÀNH ĐỘNG HỖ TRỢ TRƯỞNG HỌ / ADMIN */}
              {isLeader && (
                <div className="pt-4 border-t border-rose-100 flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="btn-tree-edit-member"
                      onClick={() => openEditModal(selectedMember)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa
                    </button>
                    <button
                      id="btn-tree-delete-member"
                      onClick={() => openDeleteModal(selectedMember.id, selectedMember.fullName)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa vị trí
                    </button>
                  </div>

                  <div className={`grid gap-2 ${hasSpouse(selectedMember.id) ? "grid-cols-1" : "grid-cols-2"}`}>
                    <button
                      id="btn-tree-add-child"
                      onClick={() => openAddModal(selectedMember.id)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Thêm Con / Chi mới
                    </button>
                    {!hasSpouse(selectedMember.id) && (
                      <button
                        id="btn-tree-add-spouse"
                        onClick={() => openAddSpouseModal(selectedMember)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 rounded-lg cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Thêm Vợ / Chồng
                      </button>
                    )}
                  </div>

                  {selectedMember.livingStatus !== LivingStatus.DECEASED && !getLinkedAccount(selectedMember.id) && pendingLeaderAccounts.length > 0 && (
                    <button
                      id="btn-tree-link-account"
                      onClick={() => {
                        setLinkAccountId(pendingLeaderAccounts[0].id);
                        setLinkAccountModal(true);
                      }}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer"
                    >
                      <Link className="w-4 h-4" /> Liên kết Đinh nam ứng dụng
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div id="tree-no-selected-member" className="flex flex-col items-center justify-center text-center py-12 text-slate-400">
              <span className="p-3 bg-rose-50 text-rose-500 rounded-2xl mb-3">
                <Info className="w-6 h-6 animate-pulse" />
              </span>
              <h4 className="font-sans font-semibold text-slate-700 text-sm">Hồ sơ chi tiết</h4>
              <p className="text-xs text-slate-500 font-sans max-w-[240px] mt-1.5">
                Nhấp chuột vào bất cứ Thẻ thành viên nào trên sơ đồ gia phả để đọc thông tin lai lịch, liên kết cha mẹ, ngày mất Âm lịch và tài khoản hệ thống.
              </p>
              {isLeader && members.length === 0 && (
                <div className="mt-6 w-full">
                  <button
                    id="btn-tree-add-root"
                    onClick={() => openAddModal()}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Tạo thành viên gốc (Cụ Tổ)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2.3 MODAL THÊM MỚI THÀNH VIÊN (ADD MEMBER DIALOG) */}
      {showAddModal && (
        <div id="modal-tree-add-member" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-lg mt-8 mb-8">
            <div className="flex justify-between items-center pb-3 border-b mb-4">
              <h3 className="font-sans font-semibold text-slate-900 text-base">Thêm thành viên vào gia phả</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col gap-4 text-xs font-sans">
              {/* Dropdown chọn tài khoản đã được duyệt */}
              {allAccounts.filter(a => a.status === AccountStatus.ACTIVE && a.role !== "ADMIN" && !a.mappedMemberId).length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <label className="block text-xs font-bold text-blue-800 mb-1.5">
                    🔗 Liên kết từ tài khoản đã duyệt (tự điền thông tin)
                  </label>
                  <select
                    onChange={e => {
                      const accId = e.target.value;
                      if (!accId) return;
                      const acc = allAccounts.find(a => a.id === accId);
                      if (acc) {
                        setFormData(f => ({
                          ...f,
                          fullName: acc.fullName,
                          birthDate: acc.birthDate ? acc.birthDate.split("T")[0] : f.birthDate,
                          gender: (acc.gender as Gender) || Gender.MALE,
                          phone: acc.phone || "",
                          email: acc.email || "",
                          currentAddress: acc.address || "",
                          originAddress: acc.hometown || "",
                          notes: acc.notes || "",
                        }));
                        setLinkedAccountId(accId);
                      }
                    }}
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                    defaultValue=""
                  >
                    <option value="">-- Chọn tài khoản để tự điền thông tin --</option>
                    {allAccounts
                      .filter(a => a.status === AccountStatus.ACTIVE && a.role !== "ADMIN" && !a.mappedMemberId)
                      .map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.fullName} · {acc.phone} · {acc.role}
                        </option>
                      ))
                    }
                  </select>
                  <p className="text-[10px] text-blue-600 mt-1">Chọn tài khoản sẽ tự điền thông tin vào form bên dưới</p>
                </div>
              )}
              {/* VAI VẾ — tự động + có thể override */}
              {!addSpouseMode && <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
                    Vai vế trong dòng họ
                    {!formData.representativeRole && (formData.fatherId || formData.motherId || members.length === 0) && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Tự động</span>
                    )}
                  </label>
                  <select
                    value={formData.representativeRole}
                    onChange={(e) => setFormData({ ...formData, representativeRole: e.target.value })}
                    className={`w-full border rounded-lg p-2 ${formData.representativeRole ? "bg-slate-50" : "bg-amber-50 text-amber-800"}`}
                  >
                    <option value="">
                      {(formData.fatherId || formData.motherId || members.length === 0)
                        ? `← Tự động: ${autoRole(formData.fatherId, formData.motherId, formData.gender, formData.spouseId)}`
                        : "-- Chọn vai vế --"}
                    </option>
                    <option value="Cụ tổ">Cụ tổ</option>
                    <option value="Ông tổ">Ông tổ</option>
                    <option value="Bà tổ">Bà tổ</option>
                    <option value="Trưởng chi">Trưởng chi</option>
                    <option value="Trưởng nhánh">Trưởng nhánh</option>
                    <option value="Con trưởng">Con trưởng</option>
                    <option value="Con thứ">Con thứ</option>
                    <option value="Con gái trưởng">Con gái trưởng</option>
                    <option value="Con gái">Con gái</option>
                    <option value="Con út">Con út</option>
                    <option value="Dâu trưởng">Dâu trưởng</option>
                    <option value="Dâu thứ">Dâu thứ</option>
                    <option value="Rể trưởng">Rể trưởng</option>
                    <option value="Cháu đích tôn">Cháu đích tôn</option>
                    <option value="Cháu nội">Cháu nội</option>
                    <option value="Cháu ngoại">Cháu ngoại</option>
                    <option value="Thành viên">Thành viên</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Trạng thái</label>
                  <select
                    value={formData.livingStatus}
                    onChange={(e) => setFormData({ ...formData, livingStatus: e.target.value as LivingStatus })}
                    className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                  >
                    <option value={LivingStatus.ALIVE}>Còn sống</option>
                    <option value={LivingStatus.DECEASED}>Đã khuất</option>
                  </select>
                </div>
              </div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Bá Vương"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
                    Giới tính
                    {addSpouseMode && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Tự động</span>
                    )}
                  </label>
                  <select
                    value={formData.gender}
                    disabled={addSpouseMode}
                    onChange={(e) => {
                      const newGender = e.target.value as Gender;
                      setFormData(f => {
                        // Nếu vợ/chồng đã chọn bị trùng giới với giới tính mới → bỏ chọn
                        // để tránh trường hợp Nam cưới Nam / Nữ cưới Nữ
                        const spouse = f.spouseId ? members.find(m => m.id === f.spouseId) : undefined;
                        const stillValid = !spouse || spouse.gender !== newGender;
                        return { ...f, gender: newGender, spouseId: stillValid ? f.spouseId : "" };
                      });
                    }}
                    className={`w-full border rounded-lg p-2 focus:outline-rose-500 ${addSpouseMode ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-slate-50"}`}
                  >
                    <option value={Gender.MALE}>Nam</option>
                    <option value={Gender.FEMALE}>Nữ / Con dâu gả</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Từ đường gốc / Quê quán</label>
                  <input
                    type="text"
                    value={formData.originAddress}
                    onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Ngày sinh Dương lịch *</label>
                  <input
                    type="date"
                    required
                    value={formData.birthDate}
                    onChange={(e) => { const v = e.target.value; setFormData(f => ({ ...f, birthDate: v, birthDateLunar: v && !birthLunarManual ? solarToLunar(v) : f.birthDateLunar })); }}
                    className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                  />
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
                      value={formData.deathDate}
                      onChange={(e) => { const v = e.target.value; setFormData(f => ({ ...f, deathDate: v, deathDateLunar: v && !deathLunarManual ? solarToLunar(v) : f.deathDateLunar })); }}
                      className="w-full border rounded-lg p-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Ngày giỗ Âm lịch *
                      {formData.deathDateLunar && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Tự động</span>}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Tự động tính khi chọn ngày mất"
                      value={formData.deathDateLunar}
                      onChange={(e) => { setDeathLunarManual(e.target.value !== ""); setFormData(f => ({ ...f, deathDateLunar: e.target.value })); }}
                      className="w-full border rounded-lg p-2 bg-emerald-50 focus:outline-emerald-400 text-emerald-800"
                    />
                  </div>
                </div>
              )}

              {/* SĐT và Nghề nghiệp — chỉ hiện khi còn sống */}
              {formData.livingStatus === LivingStatus.ALIVE && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                    placeholder="09xxxxxxxx"
                  />
                </div>
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
              </div>
              )}

              {formData.livingStatus === LivingStatus.ALIVE && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nghề nghiệp</label>
                  <input
                    type="text"
                    value={formData.job}
                    onChange={(e) => setFormData({ ...formData, job: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                    placeholder="VD: Giáo viên, Kỹ sư..."
                  />
                </div>
              </div>
              )}

              {!addSpouseMode && members.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <input
                    id="chk-is-new-founder"
                    type="checkbox"
                    checked={formData.isNewFounder}
                    onChange={(e) => setFormData({
                      ...formData,
                      isNewFounder: e.target.checked,
                      // Cụ tổ mới không có cha/mẹ riêng trong phả
                      fatherId: e.target.checked ? "" : formData.fatherId,
                      motherId: e.target.checked ? "" : formData.motherId,
                      spouseId: e.target.checked ? "" : formData.spouseId,
                    })}
                    className="mt-0.5 w-4 h-4 accent-amber-600 cursor-pointer"
                  />
                  <label htmlFor="chk-is-new-founder" className="text-xs text-amber-800 cursor-pointer">
                    <span className="font-semibold">Đặt làm Cụ tổ mới (Đời 1)</span> — tự động gắn toàn bộ
                    các nhánh gốc hiện có trên cây làm con của thành viên này, và dồn lại đời (thế hệ)
                    của các nhánh con phía dưới cho khớp vị trí mới.
                  </label>
                </div>
              )}

              {!addSpouseMode && !formData.isNewFounder && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Bố liên kết trong phả (Cha)
                    {addParentId && formData.fatherId && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">Tự động</span>}
                  </label>
                  {addParentId && formData.fatherId ? (
                    <div className="w-full border rounded-lg p-2 bg-blue-50 text-blue-800 text-sm font-medium">
                      Đời {members.find(m => m.id === formData.fatherId)?.generation} – {members.find(m => m.id === formData.fatherId)?.fullName}
                    </div>
                  ) : (
                    <select
                      value={formData.fatherId}
                      onChange={(e) => setFormData({ ...formData, fatherId: e.target.value })}
                      className="w-full border rounded-lg p-2 bg-slate-50"
                    >
                      <option value="">Không có / Thủy tổ dòng họ</option>
                      {members.filter(m => m.gender === Gender.MALE).map(m => (
                        <option key={m.id} value={m.id}>Đời {getEffectiveGeneration(m)} - {m.fullName}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Mẹ liên kết trong phả
                    {addParentId && formData.motherId && <span className="ml-2 text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded font-semibold">Tự động</span>}
                  </label>
                  {addParentId && formData.motherId ? (
                    <div className="w-full border rounded-lg p-2 bg-pink-50 text-pink-800 text-sm font-medium">
                      Đời {members.find(m => m.id === formData.motherId)?.generation} – {members.find(m => m.id === formData.motherId)?.fullName}
                    </div>
                  ) : (
                    <select
                      value={formData.motherId}
                      onChange={(e) => setFormData({ ...formData, motherId: e.target.value })}
                      className="w-full border rounded-lg p-2 bg-slate-50"
                    >
                      <option value="">Không rõ hoặc dâu ngoài</option>
                      {members.filter(m => m.gender === Gender.FEMALE).map(m => (
                        <option key={m.id} value={m.id}>Đời {getEffectiveGeneration(m)} - {m.fullName}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              )}

              <div>
                <label className="block text-slate-700 font-medium mb-1">Ghi chú lai lịch</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50 h-16 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  id="btn-submit-tree-add"
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Ghi lại và vẽ phả
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2.4 MODAL CHỈNH SỬA THÀNH VIÊN (EDIT MEMBER DIALOG) */}
      {showEditModal && selectedMember && (
        <div id="modal-tree-edit-member" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
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
                  <label className="block text-slate-700 font-medium mb-1">Quê quán cổ tích</label>
                  <input
                    type="text"
                    value={formData.originAddress}
                    onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 gap-3">
                <div className={formData.livingStatus === LivingStatus.DECEASED ? "col-span-2" : ""}>
                  <label className="block text-slate-700 font-medium mb-1">Chức vị tộc / Chức phong</label>
                  <input
                    type="text"
                    value={formData.representativeRole}
                    onChange={(e) => setFormData({ ...formData, representativeRole: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                  />
                </div>
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
                    {members.filter(m => m.gender === Gender.MALE && m.id !== selectedMember.id).map(m => (
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
                    {members.filter(m => m.gender === Gender.FEMALE && m.id !== selectedMember.id).map(m => (
                      <option key={m.id} value={m.id}>Đời {getEffectiveGeneration(m)} - {m.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Vợ/Chồng liên kết</label>
                  <select
                    value={formData.spouseId}
                    onChange={(e) => setFormData({ ...formData, spouseId: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                  >
                    <option value="">Chưa có vợ/chồng trên cây</option>
                    {members
                      .filter(m => m.id !== selectedMember.id && m.gender !== formData.gender && (!hasSpouse(m.id) || m.id === selectedMember.spouseId))
                      .map(m => (
                        <option key={m.id} value={m.id}>Đời {getEffectiveGeneration(m)} - {m.fullName} ({m.gender === Gender.MALE ? "Nam" : "Nữ"})</option>
                      ))}
                  </select>
                </div>
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

              {/* Bước 5 / Alt Flow 4a (UC2.4): Quản lý trạng thái liên kết tài khoản của Node */}
              <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3">
                <label className="block text-xs font-bold text-blue-800 mb-1.5">🔗 Liên kết tài khoản ứng dụng</label>
                {(() => {
                  const linkedAcc = getLinkedAccount(selectedMember.id);
                  if (linkedAcc) {
                    // Trường hợp B (4a): Node đã có tài khoản liên kết → cho phép hủy
                    return (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-blue-800">
                          Đang liên kết với <strong>{linkedAcc.fullName}</strong> ({linkedAcc.phone})
                        </span>
                        <button
                          type="button"
                          id="btn-edit-unlink-account"
                          onClick={() => {
                            if (confirm(`Hủy liên kết tài khoản ${linkedAcc.fullName} khỏi thành viên này?`)) {
                              onUnlinkAccount(linkedAcc.id);
                            }
                          }}
                          className="px-3 py-1.5 text-[10px] uppercase font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Hủy liên kết tài khoản {linkedAcc.fullName}
                        </button>
                      </div>
                    );
                  }
                  // Trường hợp A (4a): Node đang trống tài khoản → cho chọn tài khoản Hoạt động đang chờ map
                  const unmappedActive = allAccounts.filter(a => a.status === AccountStatus.ACTIVE && a.role !== "ADMIN" && !a.mappedMemberId);
                  if (unmappedActive.length === 0) {
                    return <p className="text-[10px] text-blue-600 italic">Hiện không có tài khoản Hoạt động nào đang chờ xếp vị trí.</p>;
                  }
                  return (
                    <select
                      value={editLinkAccountId}
                      onChange={(e) => setEditLinkAccountId(e.target.value)}
                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="">-- Chọn tài khoản để liên kết với thành viên này --</option>
                      {unmappedActive.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.fullName} · {acc.phone} · {acc.role}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setBirthDateError(false); setEditLinkAccountId(""); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  id="btn-submit-tree-edit"
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

      {/* 2.5 MODAL XÓA THÀNH VIÊN (DELETE CONFIRMATION DIALOG) */}
      {showDeleteModal && (
        <div id="modal-tree-delete-member" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-md">
            <h3 className="font-sans font-semibold text-slate-900 text-base mb-2">Xác nhận xóa thành viên phả?</h3>

            <p className="text-xs text-slate-600 leading-relaxed mb-1">
              Bạn có chắc chắn muốn xóa thành viên{" "}
              <strong>[{selectedMember?.fullName || ""}]</strong> khỏi cây gia phả?{" "}
              <span className="text-red-600 font-semibold">Hành động này không thể hoàn tác.</span>
            </p>

            {selectedMember && getLinkedAccount(selectedMember.id) && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 mb-1 leading-relaxed">
                ⚠️ Thành viên này đang liên kết với tài khoản{" "}
                <strong>{getLinkedAccount(selectedMember.id)?.fullName}</strong>. Nếu tiếp tục xóa, liên kết tài khoản
                này sẽ tự động bị gỡ bỏ khỏi Nút phả hệ.
              </p>
            )}

            <form onSubmit={handleDeleteSubmit} className="flex flex-col gap-3 text-xs font-sans mt-3">
              <div>
                <label className="block text-red-700 font-bold mb-1">Lý do xóa vị trí phả hệ (Bắt buộc) *</label>
                <input
                  id="input-delete-reason"
                  type="text"
                  required
                  placeholder="Ví dụ: Nhập trùng dữ liệu / Đính chính quan hệ..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full border border-red-300 bg-red-50/20 rounded-lg p-2 focus:outline-red-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Ghi chú thêm (không bắt buộc)</label>
                <textarea
                  id="input-delete-note"
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
                  id="btn-confirm-delete-tree"
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

      {/* 2.6 MODAL LIÊN KẾT TÀI KHOẢN (ACCOUNT LINK MODAL) */}
      {linkAccountModal && selectedMember && (
        <div id="modal-tree-link-account" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center pb-3 border-b mb-4">
              <h3 className="font-sans font-semibold text-slate-900 text-sm uppercase">Ánh xạ tài khoản ứng dụng</h3>
              <button onClick={() => setLinkAccountModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLinkAccountSubmit} className="flex flex-col gap-3 text-xs font-sans">
              <p className="text-slate-500 mb-2 leading-relaxed">
                Khi thực hiện ánh xạ, đinh nam trên sơ đồ gia phả [<strong>{selectedMember.fullName}</strong>] sẽ được kết nối với tài khoản đăng nhập tương ứng để họ có toàn quyền cập nhật tiểu sử cá nhân và phản hồi sự kiện dòng họ.
              </p>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Chọn tài khoản đang chờ phê duyệt phả</label>
                <select
                  required
                  value={linkAccountId}
                  onChange={(e) => setLinkAccountId(e.target.value)}
                  className="w-full border rounded-lg p-2.5 bg-slate-50 text-sm focus:outline-rose-500"
                >
                  {pendingLeaderAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.fullName} ({acc.phone} - Mã mời: {acc.inviteCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setLinkAccountModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  id="btn-submit-link-account"
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer"
                >
                  Lưu & Cấp phát quyền con cháu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ERROR MODAL */}
      {errorModal.show && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Thông báo lỗi</h3>
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
    </div>
  );
}