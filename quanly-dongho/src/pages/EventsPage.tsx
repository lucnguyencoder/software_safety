/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Eye, 
  MapPin, Clock, CheckCircle, X, AlertTriangle, Users, MessageSquare, RefreshCw, Megaphone,
  List, BarChart3, CalendarDays, Image as MediaIcon
} from "lucide-react";
import { ClanEvent, EventStatus, EventType, UserRole, UserAccount, RSVPStatus, ClanMember, LivingStatus } from "../types";
import { convertLunarToSolar2026 } from "../data/seedData";
import EventMediaModal from "../components/EventMediaModal";

interface CalendarMonthProps {
  events: ClanEvent[];
  members: ClanMember[];
  accounts: UserAccount[];
  currentAccount: UserAccount;
  onAddEvent: (newEvent: Omit<ClanEvent, "id">) => void | Promise<void>;
  onUpdateEvent: (updatedEvent: ClanEvent) => void | Promise<void>;
  onAutoGenerateGiocles: () => void;
  onRefresh: () => void | Promise<void>;
  onSubmitRsvp?: (eventId: string, status: string, additionalGuests?: number, reason?: string) => Promise<void>;
}

export default function CalendarMonth({
  events,
  members,
  accounts,
  currentAccount,
  onAddEvent,
  onUpdateEvent,
  onAutoGenerateGiocles,
  onRefresh,
  onSubmitRsvp,
}: CalendarMonthProps) {
  const [currentMonth, setCurrentMonth] = useState(3);
  const currentYear = 2026;

  // Chỉ những thành viên còn sống mới có thể được mời tham dự sự kiện.
  // Người đã khuất (ví dụ: nhân vật chính trong ngày giỗ) chỉ xuất hiện trong gia phả,
  // không thể trở thành khách mời của sự kiện.
  const livingMembers = useMemo(
    () => members.filter(m => m.livingStatus !== LivingStatus.DECEASED),
    [members]
  );

  const [selectedEvent, setSelectedEvent] = useState<ClanEvent | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showRsvpModal, setShowRsvpModal] = useState(false);
  // Step 6 (tùy chọn): chuyển đổi giữa Xem theo Tháng (lưới) và Dạng Danh sách.
  // Không làm Theo Tuần/Theo Ngày vì sự kiện dòng họ rất thưa (vài sự kiện/tháng),
  // lưới giờ-theo-tuần/ngày sẽ trống và trùng lặp thông tin với Theo Tháng.
  const [viewMode, setViewMode] = useState<"month" | "list">("month");

  const getDefaultEventData = () => ({
    title: "",
    type: EventType.DEATH_ANNIVERSARY,
    startDate: new Date().toISOString().split("T")[0],
    startTime: "08:00",
    endDate: "",
    endTime: "",
    lunarDateLabel: "",
    location: "Từ đường dòng họ",
    description: "",
    attendeeType: "ALL" as "ALL" | "ROLE" | "CUSTOM",
    attendeeRoles: [] as string[],
    attendeeIds: [] as string[],
  });

  const [eventData, setEventData] = useState(getDefaultEventData());

  const [formError, setFormError] = useState("");

  const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus>(RSVPStatus.ATTENDING);
  const [rsvpGuests, setRsvpGuests] = useState(0);
  const [rsvpReason, setRsvpReason] = useState("");
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([]);

  // UC3.5: Modal nhập lý do khi Hủy / Tạm hoãn sự kiện (thay cho prompt() mặc định của trình duyệt)
  const [statusChangeModal, setStatusChangeModal] = useState<{ eventId: string; newStatus: EventStatus; eventTitle: string } | null>(null);
  const [statusChangeReason, setStatusChangeReason] = useState("");
  const [statusChangeErr, setStatusChangeErr] = useState("");

  const isAdmin    = currentAccount.role === UserRole.ADMIN;
  const isLeader   = currentAccount.role === UserRole.LEADER;
  const isTreasurer = currentAccount.role === UserRole.TREASURER;
  const isMember   = currentAccount.role === UserRole.MEMBER;
  const isGuest    = currentAccount.role === UserRole.GUEST;
  const canManageEvent = isLeader;
  // Chỉ Thành viên và Ban tài chính mới phản hồi RSVP (UC3.7)
  const canRsvp = isMember || isTreasurer;

  const pushNotificationSimulation = (eventTitle: string, status: EventStatus, customReason?: string, isResume?: boolean) => {
    const timestamp = new Date().toLocaleTimeString();
    let text = "";
    if (status === EventStatus.CANCELLED) {
      text = `[${timestamp}] 🔔 THÔNG BÁO KHẨN: Sự kiện [${eventTitle}] đã bị HỦY với lý do: "${customReason || "Thay đổi đột xuất"}". Thư cáo lỗi đã gửi đến toàn thể dòng họ.`;
    } else if (status === EventStatus.POSTPONED) {
      text = `[${timestamp}] 🔔 THÔNG BÁO HOÃN LỊCH: Sự kiện [${eventTitle}] đã lùi ngày. Chi tiết: "${customReason}". Hãy kiểm tra lại lịch gia tộc mới.`;
    } else if (isResume) {
      text = `[${timestamp}] 🔔 THÔNG BÁO: Sự kiện [${eventTitle}] đã được TIẾP TỤC theo lịch trình ban đầu sau thời gian tạm hoãn.`;
    } else {
      text = `[${timestamp}] 🔔 HỆ THỐNG GIA TỘC: Đã tạo mới hành trình [${eventTitle}]. Hộp thư thông báo RSVP tự động quét gởi tới 25 thành viên.`;
    }
    setSimulatedLogs(prev => [text, ...prev]);
  };

  const monthNames = [
    "Tháng Một", "Tháng Hai", "Tháng Ba", "Tháng Tư", "Tháng Năm", "Tháng Sáu",
    "Tháng Bảy", "Tháng Tám", "Tháng Chín", "Tháng Mười", "Tháng Mười Một", "Tháng Mười Hai"
  ];

  const daysInMonthList = useMemo(() => {
    const days = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDay = new Date(currentYear, currentMonth, 1).getDay();
    const list = [];
    for (let i = 0; i < startDay; i++) list.push(null);
    for (let d = 1; d <= days; d++) list.push(d);
    return list;
  }, [currentMonth]);

  const getLunarDayLabel = (day: number) => {
    if (currentMonth === 3) {
      if (day === 4) return "17/02";
      if (day === 17) return "01/03";
      if (day === 26) return "10/03";
      if (day < 17) return `${day + 13}/02`;
      return `${day - 16}/03`;
    }
    if (currentMonth === 4) {
      if (day === 1) return "15/03";
      if (day === 17) return "01/04";
      if (day < 17) return `${day + 14}/03`;
      return `${day - 16}/04`;
    }
    if (currentMonth === 10) {
      if (day === 19) return "10/10";
      return "Âm";
    }
    return "";
  };

  const handlePrevMonth = () => setCurrentMonth(m => (m === 0 ? 11 : m - 1));
  const handleNextMonth = () => setCurrentMonth(m => (m === 11 ? 0 : m + 1));
  // Step 6 (tùy chọn): quay nhanh về tháng hiện tại (năm hệ thống đang cố định là 2026,
  // trùng với năm thực tế nên chỉ cần đồng bộ lại tháng theo ngày hệ thống).
  const handleGoToday = () => setCurrentMonth(new Date().getMonth());

  const getEventsForDay = (day: number) => {
    if (!day) return [];
    const datestr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(e => (e.startDate || "").split("T")[0] === datestr);
  };

  // Step 5: mỗi danh mục sự kiện có một màu riêng để phân biệt trên lịch (Giỗ chạp/Họp tộc/
  // Tảo mộ/Khác); trạng thái Tạm hoãn/Hủy sẽ ưu tiên đè màu lên trên để cảnh báo rõ hơn.
  const getEventColorClasses = (e: ClanEvent) => {
    let colorClass = "bg-blue-50 text-blue-700 border-blue-200"; // MEETING (Họp tộc / Đại hội)
    if (e.type === EventType.DEATH_ANNIVERSARY) colorClass = "bg-red-50 text-red-700 border-red-200";
    else if (e.type === EventType.GRAVE_VISIT) colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    else if (e.type === EventType.OTHER) colorClass = "bg-purple-50 text-purple-700 border-purple-200";
    if (e.status === EventStatus.POSTPONED) colorClass = "bg-amber-50 text-amber-800 border-amber-200 animate-pulse";
    if (e.status === EventStatus.CANCELLED) colorClass = "bg-slate-100 text-slate-500 border-slate-300 line-through";
    return colorClass;
  };
  const eventTypeLabel = (t: EventType) => {
    if (t === EventType.DEATH_ANNIVERSARY) return "Giỗ chạp";
    if (t === EventType.MEETING) return "Họp tộc / Đại hội";
    if (t === EventType.GRAVE_VISIT) return "Tảo mộ";
    return "Khác";
  };
  const eventStatusLabel = (s: EventStatus) => {
    if (s === EventStatus.UPCOMING) return "Sắp diễn ra";
    if (s === EventStatus.COMPLETED) return "Đã hoàn thành";
    if (s === EventStatus.POSTPONED) return "Tạm hoãn";
    return "Đã hủy";
  };

  // Sự kiện thuộc tháng/năm đang xem (dùng cho Dạng Danh sách + Bảng thống kê).
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const monthEvents = useMemo(
    () => events
      .filter(e => ((e.startDate || "").split("T")[0]).startsWith(currentMonthPrefix))
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || "")),
    [events, currentMonthPrefix]
  );

  // Bảng "Thống kê sự kiện": tổng số sự kiện trong tháng, chia theo danh mục và trạng thái.
  const monthStats = useMemo(() => {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    monthEvents.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    });
    return { total: monthEvents.length, byType, byStatus };
  }, [monthEvents]);

  // Danh sách "Sự kiện sắp tới": gom toàn bộ sự kiện chưa diễn ra (không phụ thuộc tháng đang
  // xem), phân nhóm theo tiến độ thời gian để người dùng nắm nhanh việc gì cần chuẩn bị trước.
  const upcomingGroups = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayDate = new Date(todayStr);
    const future = events
      .filter(e => e.status !== EventStatus.CANCELLED && (e.startDate || "").split("T")[0] >= todayStr)
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
    const groups: { label: string; items: ClanEvent[] }[] = [
      { label: "Hôm nay", items: [] },
      { label: "7 ngày tới", items: [] },
      { label: "30 ngày tới", items: [] },
      { label: "Xa hơn", items: [] },
    ];
    future.forEach(e => {
      const d = new Date((e.startDate || "").split("T")[0]);
      const diffDays = Math.round((d.getTime() - todayDate.getTime()) / 86400000);
      if (diffDays <= 0) groups[0].items.push(e);
      else if (diffDays <= 7) groups[1].items.push(e);
      else if (diffDays <= 30) groups[2].items.push(e);
      else groups[3].items.push(e);
    });
    return groups.filter(g => g.items.length > 0);
  }, [events]);

  // Click vào một sự kiện trong danh sách "Sắp tới" hoặc Dạng Danh sách: nhảy lịch đến đúng
  // tháng của sự kiện đó và mở panel chi tiết — để người dùng không cần tự bấm next/prev tìm.
  const openEventFromList = (ev: ClanEvent) => {
    const d = new Date((ev.startDate || "").split("T")[0]);
    if (!isNaN(d.getTime())) setCurrentMonth(d.getMonth());
    setSelectedEvent(ev);
  };

  // Tính số lượng khách mời dự kiến (Step 5)
  // Với mỗi vai trò được chọn (Trưởng họ/Ban tài chính/Thành viên...), tìm các tài khoản
  // đang giữ vai trò đó, rồi quy ra người thật (qua mappedMemberId trong gia phả nếu có,
  // nếu tài khoản chưa liên kết gia phả thì vẫn hiện theo tên tài khoản để không bị "mất" người).
  const roleBasedInvitees = useMemo(() => {
    if (eventData.attendeeRoles.length === 0) return [] as { id: string; fullName: string; generation?: number }[];
    const matchingAccounts = accounts.filter(a => eventData.attendeeRoles.includes(a.role));
    const seen = new Set<string>();
    const result: { id: string; fullName: string; generation?: number }[] = [];
    matchingAccounts.forEach(a => {
      const member = a.mappedMemberId ? livingMembers.find(m => m.id === a.mappedMemberId) : undefined;
      // Nếu tài khoản đã liên kết gia phả nhưng người đó đã khuất, bỏ qua —
      // không mời người đã khuất tham dự sự kiện.
      if (a.mappedMemberId && !member) return;
      const key = member ? member.id : `acc-${a.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(member
        ? { id: member.id, fullName: member.fullName, generation: member.generation }
        : { id: a.id, fullName: a.fullName });
    });
    return result;
  }, [eventData.attendeeRoles, accounts, livingMembers]);

  const computedInvitees = useMemo(() => {
    if (eventData.attendeeType === "ALL") return livingMembers;
    if (eventData.attendeeType === "ROLE") return roleBasedInvitees;
    if (eventData.attendeeType === "CUSTOM") {
      return livingMembers.filter(m => eventData.attendeeIds.includes(m.id));
    }
    return [];
  }, [eventData.attendeeType, eventData.attendeeIds, livingMembers, roleBasedInvitees]);

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // SubFlow S-1: Kiểm tra tính hợp lệ
    if (!eventData.title.trim()) {
      setFormError("Tên sự kiện không được để trống.");
      return;
    }
    if (!eventData.startDate) {
      setFormError("Vui lòng chọn ngày bắt đầu.");
      return;
    }
    if (eventData.endDate && eventData.endDate < eventData.startDate) {
      setFormError("Thời gian kết thúc không được trước thời gian bắt đầu.");
      return;
    }
    if (eventData.endDate === eventData.startDate && eventData.endTime && eventData.startTime && eventData.endTime <= eventData.startTime) {
      setFormError("Giờ kết thúc phải sau giờ bắt đầu trong cùng một ngày.");
      return;
    }
    if (!eventData.location.trim()) {
      setFormError("Địa điểm không được để trống.");
      return;
    }
    if (eventData.attendeeType === "ROLE" && eventData.attendeeRoles.length === 0) {
      setFormError("Vui lòng chọn ít nhất một vai trò được mời.");
      return;
    }
    if (eventData.attendeeType === "CUSTOM" && eventData.attendeeIds.length === 0) {
      setFormError("Vui lòng chọn ít nhất một thành viên.");
      return;
    }
    // Kiểm tra trùng tên sự kiện cùng ngày (bỏ qua chính sự kiện đang sửa)
    const duplicate = events.find(ev =>
      ev.id !== editingEventId &&
      ev.title.trim().toLowerCase() === eventData.title.trim().toLowerCase() &&
      (ev.startDate || "").split("T")[0] === eventData.startDate
    );
    if (duplicate) {
      setFormError(`Đã tồn tại sự kiện "${eventData.title}" vào ngày này. Vui lòng kiểm tra lại.`);
      return;
    }

    if (editingEventId) {
      // ====== CHẾ ĐỘ SỬA: cập nhật sự kiện đã có, KHÔNG tạo bản ghi mới ======
      const targetEvent = events.find(ev => ev.id === editingEventId);
      if (!targetEvent) { setFormError("Không tìm thấy sự kiện cần sửa."); return; }

      const updatedEvent = {
        ...targetEvent,
        title: eventData.title.trim(),
        type: eventData.type,
        startDate: eventData.startDate,
        startTime: eventData.startTime,
        endDate: eventData.endDate || undefined,
        endTime: eventData.endTime || undefined,
        lunarDateLabel: eventData.lunarDateLabel,
        location: eventData.location.trim(),
        description: eventData.description,
        attendeeType: eventData.attendeeType,
        attendeeRoles: eventData.attendeeRoles,
        attendeeIds: eventData.attendeeIds,
      };

      try {
        await onUpdateEvent(updatedEvent as any);
      } catch (err: any) {
        setFormError(`❌ Không thể lưu chỉnh sửa: ${err?.message || "Lỗi không xác định"}.`);
        return; // Giữ modal mở, không báo thành công giả
      }

      pushNotificationSimulation(eventData.title, EventStatus.UPCOMING);
      setSelectedEvent(prev => prev && prev.id === editingEventId ? { ...prev, ...updatedEvent } as any : prev);

      setShowAddEventModal(false);
      setEditingEventId(null);
      setEventData(getDefaultEventData());
      setFormError("");
      alert(`✅ Đã lưu chỉnh sửa sự kiện "${eventData.title}"!\nThông báo thay đổi đã được gửi đến khách mời.`);
      return;
    }

    // ====== CHẾ ĐỘ TẠO MỚI ======
    onAddEvent({
      title: eventData.title.trim(),
      type: eventData.type,
      startDate: eventData.startDate,
      startTime: eventData.startTime,
      endDate: eventData.endDate || undefined,
      endTime: eventData.endTime || undefined,
      lunarDateLabel: eventData.lunarDateLabel,
      location: eventData.location.trim(),
      description: eventData.description,
      status: EventStatus.UPCOMING,
      attendeeType: eventData.attendeeType,
      attendeeRoles: eventData.attendeeRoles,
      attendeeIds: eventData.attendeeIds,
      createdBy: currentAccount.fullName,
      createdAt: new Date().toISOString().split("T")[0],
      rsvps: []
    } as any);

    // Step 9: Gửi thông báo
    pushNotificationSimulation(eventData.title, EventStatus.UPCOMING);

    // Step 10: Thông báo thành công + đóng modal
    setShowAddEventModal(false);
    setEventData(getDefaultEventData());
    setFormError("");
    alert(`✅ Tạo sự kiện thành công!\nLời mời đã được gửi đi đến ${computedInvitees.length || "toàn bộ"} thành viên.`);
  };

  // Mở modal yêu cầu Trưởng họ nhập lý do trước khi Hủy/Hoãn (UC3.5)
  const openStatusChangeModal = (eventId: string, newStatus: EventStatus) => {
    const targetEvent = events.find(ev => ev.id === eventId);
    setStatusChangeModal({ eventId, newStatus, eventTitle: targetEvent?.title || "" });
    setStatusChangeReason("");
    setStatusChangeErr("");
  };

  // Xác nhận Hủy/Hoãn: lưu lý do, cập nhật sự kiện, phát thông báo tới toàn bộ khách mời
  const confirmStatusChange = async () => {
    if (!statusChangeModal) return;
    const { eventId, newStatus, eventTitle } = statusChangeModal;
    const targetEvent = events.find(ev => ev.id === eventId);
    if (!targetEvent) return;

    if (!statusChangeReason.trim()) {
      setStatusChangeErr(newStatus === EventStatus.CANCELLED
        ? "Quy ước dòng họ: Vui lòng nêu rõ lý do hủy sự kiện để thông báo đến khách mời."
        : "Vui lòng nêu rõ lý do tạm hoãn sự kiện để thông báo đến khách mời.");
      return;
    }
    const reason = statusChangeReason.trim();

    // Cắt bỏ phần giờ/timezone nếu có (vd "2026-06-26T17:00:00.000Z" -> "2026-06-26")
    // để tránh lỗi "Incorrect date value" khi ghi ngược ngày xuống MySQL.
    const normalizedStartDate = (targetEvent.startDate || "").split("T")[0];
    const normalizedEndDate = (targetEvent as any).endDate ? String((targetEvent as any).endDate).split("T")[0] : (targetEvent as any).endDate;

    // ⚠️ Chờ kết quả LƯU THẬT từ server trước khi coi là thành công.
    // Nếu không await/catch ở đây, lúc API lỗi (403/500/mất mạng...) UI vẫn sẽ
    // báo "thành công" trong khi server không lưu gì — lần sau tải lại sẽ thấy
    // sự kiện quay về trạng thái cũ.
    try {
      await onUpdateEvent({
        ...targetEvent,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        status: newStatus,
        // Dùng null (không phải undefined) để XÓA THẬT cột lý do còn lại trong DB —
        // undefined sẽ bị JSON.stringify bỏ qua, khiến server hiểu là "giữ nguyên giá trị cũ".
        cancelReason: newStatus === EventStatus.CANCELLED ? reason : null,
        postponeReason: newStatus === EventStatus.POSTPONED ? reason : null
      } as any);
    } catch (err: any) {
      setStatusChangeErr(
        `❌ Không thể lưu thay đổi xuống hệ thống: ${err?.message || "Lỗi không xác định"}. ` +
        `Vui lòng kiểm tra lại tài khoản đang đăng nhập có đúng quyền Trưởng họ/Quản trị viên không, ` +
        `hoặc xem tab Network (F12) để biết chi tiết lỗi.`
      );
      return; // Không đóng modal, không hiện "đã hủy thành công" giả
    }

    pushNotificationSimulation(eventTitle, newStatus, reason);
    setSelectedEvent(prev => prev && prev.id === eventId ? {
      ...prev, status: newStatus,
      cancelReason: newStatus === EventStatus.CANCELLED ? reason : undefined,
      postponeReason: newStatus === EventStatus.POSTPONED ? reason : undefined
    } as any : prev);

    const invitedCount = livingMembers.length; // Toàn bộ thành viên còn sống thuộc diện được mời tham dự sự kiện dòng họ
    setStatusChangeModal(null);
    setStatusChangeReason("");
    setStatusChangeErr("");

    // Hiển thị thông báo xác nhận cho Trưởng họ — kèm lý do vừa nhập
    if (newStatus === EventStatus.CANCELLED) {
      alert(`🚫 ĐÃ HỦY SỰ KIỆN\n\nSự kiện: "${eventTitle}"\nLý do (Trưởng họ): ${reason}\n\n📢 Thông báo hủy sự kiện kèm lý do trên đã được hiển thị tới toàn bộ ${invitedCount} khách mời tham dự — họ sẽ thấy ngay khi mở mục "Sự kiện".`);
    } else {
      alert(`⏸ ĐÃ TẠM HOÃN SỰ KIỆN\n\nSự kiện: "${eventTitle}"\nLý do (Trưởng họ): ${reason}\n\n📢 Thông báo tạm hoãn kèm lý do trên đã được hiển thị tới toàn bộ ${invitedCount} khách mời tham dự.`);
    }
  };

  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (rsvpStatus === RSVPStatus.ABSENT && !rsvpReason.trim()) {
      alert("Quy ước dòng họ: Nếu vắng mặt, bạn bắt buộc phải ghi rõ lý do!");
      return;
    }

    // Cập nhật UI tức thì (optimistic update)
    const currentRsvps = [...selectedEvent.rsvps];
    const userRsvpIndex = currentRsvps.findIndex(r => r.accountId === currentAccount.id);
    const newRsvp = {
      accountId: currentAccount.id,
      fullName: currentAccount.fullName,
      status: rsvpStatus,
      additionalGuests: rsvpStatus === RSVPStatus.ABSENT ? 0 : rsvpGuests,
      reason: rsvpStatus === RSVPStatus.ABSENT ? rsvpReason : undefined,
      updatedAt: new Date().toISOString().split("T")[0]
    };
    if (userRsvpIndex > -1) currentRsvps[userRsvpIndex] = newRsvp;
    else currentRsvps.push(newRsvp);
    setSelectedEvent(prev => prev ? { ...prev, rsvps: currentRsvps } : null);
    setShowRsvpModal(false);

    try {
      // Gọi API backend lưu RSVP
      if (onSubmitRsvp) {
        await onSubmitRsvp(
          selectedEvent.id,
          rsvpStatus,
          rsvpStatus === RSVPStatus.ABSENT ? 0 : rsvpGuests,
          rsvpStatus === RSVPStatus.ABSENT ? rsvpReason : undefined
        );
      } else {
        // Fallback: update toàn bộ event
        await onUpdateEvent({ ...selectedEvent, rsvps: currentRsvps });
      }
      alert("Phản hồi RSVP tham dự của bạn đã được ghi vào hệ thống thành công!");
    } catch {
      alert("Có lỗi khi lưu RSVP. Vui lòng thử lại.");
      // Rollback UI
      setSelectedEvent(prev => prev ? { ...prev, rsvps: selectedEvent.rsvps } : null);
    }
  };

  // Đồng bộ panel chi tiết với dữ liệu mới nhất mỗi khi `events` được tải lại (refresh định kỳ,
  // hoặc sau khi người khác RSVP/Trưởng họ hủy-hoãn ở phiên đăng nhập khác) — nếu không, panel
  // chi tiết sẽ "đứng hình" với dữ liệu cũ tại thời điểm bấm chọn sự kiện.
  useEffect(() => {
    if (!selectedEvent) return;
    const fresh = events.find(e => e.id === selectedEvent.id);
    if (fresh && fresh !== selectedEvent) setSelectedEvent(fresh);
    // selectedEvent không nằm trong deps để tránh lặp vô hạn — effect chỉ cần chạy lại khi `events` đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Mở form sửa thông tin sự kiện (dùng chung cho cả sự kiện UPCOMING và POSTPONED)
  const openEditModal = (ev: ClanEvent) => {
    setEventData({ title: ev.title, type: ev.type, startDate: (ev.startDate || "").split("T")[0], startTime: ev.startTime || "08:00", endDate: (ev as any).endDate || "", endTime: (ev as any).endTime || "", lunarDateLabel: ev.lunarDateLabel || "", location: ev.location, description: ev.description || "", attendeeType: "ALL", attendeeRoles: [], attendeeIds: [] });
    setEditingEventId(ev.id);
    setFormError("");
    setShowAddEventModal(true);
  };

  // UC3.6: Trưởng họ có thể đưa sự kiện đang Tạm hoãn quay lại TIẾP TỤC theo dự kiến —
  // không bắt buộc sự kiện tạm hoãn phải dừng vĩnh viễn.
  const resumeEvent = async (eventId: string) => {
    const targetEvent = events.find(ev => ev.id === eventId);
    if (!targetEvent) return;
    const dateLabel = `${(targetEvent.startDate || "").split("T")[0]}${targetEvent.startTime ? " " + targetEvent.startTime : ""}`;
    const ok = window.confirm(
      `Xác nhận TIẾP TỤC sự kiện "${targetEvent.title}" theo đúng lịch trình hiện tại (${dateLabel})?\n\n` +
      `Nếu muốn đổi sang ngày/giờ khác trước khi tiếp tục, hãy bấm "✏️ Chỉnh sửa" thay vì xác nhận ở đây.`
    );
    if (!ok) return;

    try {
      await onUpdateEvent({ ...targetEvent, status: EventStatus.UPCOMING, postponeReason: null } as any);
    } catch (err: any) {
      alert(`❌ Không thể tiếp tục sự kiện: ${err?.message || "Lỗi không xác định"}.`);
      return;
    }
    pushNotificationSimulation(targetEvent.title, EventStatus.UPCOMING, undefined, true);
    setSelectedEvent(prev => prev && prev.id === eventId ? { ...prev, status: EventStatus.UPCOMING, postponeReason: undefined } as any : prev);
    alert(`▶️ ĐÃ TIẾP TỤC SỰ KIỆN\n\nSự kiện "${targetEvent.title}" được tiếp tục theo lịch trình ban đầu (${dateLabel}).\n📢 Thông báo đã được gửi đến toàn bộ khách mời tham dự.`);
  };

  const myRsvp = useMemo(() => {
    if (!selectedEvent) return null;
    return selectedEvent.rsvps.find(r => r.accountId === currentAccount.id) || null;
  }, [selectedEvent, currentAccount]);

  // Thông báo cho khách mời: các sự kiện vừa bị Hủy/Tạm hoãn, hiển thị cho MỌI vai trò
  // ngay tại mục "Sự kiện" — không cần bấm vào từng ô lịch mới biết.
  const statusAlerts = useMemo(() => {
    return events
      .filter(e => (e.status === EventStatus.CANCELLED && e.cancelReason) ||
                   (e.status === EventStatus.POSTPONED && e.postponeReason))
      .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))
      .slice(0, 5);
  }, [events]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* LỊCH CHÍNH */}
      <div className="xl:col-span-2 bg-white border border-rose-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-rose-50 mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 text-rose-700 rounded-lg"><CalendarIcon className="w-5 h-5" /></span>
            <div>
              <h3 className="font-sans font-semibold text-slate-900 text-sm">LỊCH SỰ KIỆN GIA TỘC 2026</h3>
              <p className="text-[10px] text-slate-500 font-sans mt-0.5">Hiển thị song song lịch Dương (Số to) và lịch Âm (Chữ nhỏ) chuyên biệt.</p>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap justify-end">
            {canManageEvent && (
              <button id="btn-auto-anniversaries"
                onClick={() => { onAutoGenerateGiocles(); alert("Hệ thống đã tự động rà soát toàn bộ người đã mất trong gia phả và đồng bộ lập sự kiện tế kỵ Giỗ năm 2026!"); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer border border-rose-100">
                <RefreshCw className="w-3.5 h-3.5" /> Lập Lịch Giỗ Tự Động
              </button>
            )}
            <button id="btn-calendar-today" onClick={handleGoToday}
              className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer border border-rose-100">
              Hôm nay
            </button>
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
              <span className="text-xs font-bold font-sans text-slate-700 px-2 min-w-[90px] text-center">{monthNames[currentMonth]} {currentYear}</span>
              <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded"><ChevronRight className="w-4 h-4 text-slate-600" /></button>
            </div>
            {/* Step 6 (tùy chọn): chuyển đổi Xem theo Tháng / Dạng Danh sách */}
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1">
              <button id="btn-calendar-view-month" onClick={() => setViewMode("month")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${viewMode === "month" ? "bg-rose-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                <CalendarDays className="w-3 h-3" /> Theo Tháng
              </button>
              <button id="btn-calendar-view-list" onClick={() => setViewMode("list")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${viewMode === "list" ? "bg-rose-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                <List className="w-3 h-3" /> Danh sách
              </button>
            </div>
            {canManageEvent && (
              <button id="btn-calendar-add-event" onClick={() => { setEditingEventId(null); setEventData(getDefaultEventData()); setFormError(""); setShowAddEventModal(true); }}
                className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Step 5: chú giải màu sắc theo danh mục sự kiện */}
        <div className="flex items-center gap-3 flex-wrap mb-3 -mt-1">
          {[
            { label: "Giỗ chạp", dot: "bg-red-400" },
            { label: "Họp tộc / Đại hội", dot: "bg-blue-400" },
            { label: "Tảo mộ", dot: "bg-emerald-400" },
            { label: "Khác", dot: "bg-purple-400" },
          ].map(item => (
            <span key={item.label} className="flex items-center gap-1.5 text-[10px] font-sans text-slate-500">
              <span className={`w-2 h-2 rounded-full ${item.dot}`} /> {item.label}
            </span>
          ))}
        </div>

        {viewMode === "month" ? (
        <div className="grid grid-cols-7 gap-1 text-center font-sans">
          {["T2","T3","T4","T5","T6","T7","CN"].map(d => (
            <div key={d} className="text-[11px] font-bold text-slate-400 py-2">{d}</div>
          ))}
          {daysInMonthList.map((day, idx) => {
            const hasDay = day !== null;
            const dayEvents = hasDay ? getEventsForDay(day!) : [];
            const lunarLabel = hasDay ? getLunarDayLabel(day!) : "";
            return (
              <div key={idx} className={`min-h-[75px] rounded-xl p-1 border border-rose-50/50 flex flex-col justify-between text-left ${hasDay ? "bg-slate-50/50 hover:bg-rose-50/10" : "bg-transparent border-none"}`}>
                {hasDay && (
                  <>
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-slate-700">{day}</span>
                      {lunarLabel && <span className="text-[8px] font-mono text-emerald-600 font-bold bg-emerald-50 px-1 rounded">{lunarLabel}</span>}
                    </div>
                    <div className="flex flex-col gap-1 mt-1.5 overflow-hidden">
                      {dayEvents.map(e => (
                        <div id={`day-event-${e.id}`} key={e.id} onClick={() => setSelectedEvent(e)}
                          className={`p-1 text-[8px] font-sans font-bold leading-tight rounded-md border truncate cursor-pointer hover:shadow-xs ${getEventColorClasses(e)}`}>
                          {e.title}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        ) : (
          /* Step 6 (tùy chọn): Dạng Danh sách — toàn bộ sự kiện trong tháng đang xem, sắp theo ngày */
          <div id="calendar-list-view" className="space-y-2 max-h-[480px] overflow-y-auto pr-0.5">
            {monthEvents.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-10">Không có sự kiện nào trong {monthNames[currentMonth]} {currentYear}.</p>
            ) : monthEvents.map(e => (
              <div key={e.id} onClick={() => setSelectedEvent(e)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:shadow-sm font-sans ${getEventColorClasses(e)}`}>
                <div className="flex flex-col items-center justify-center w-12 flex-shrink-0 bg-white/60 rounded-lg py-1">
                  <span className="text-sm font-bold leading-none">{(e.startDate || "").split("T")[0].split("-")[2]}</span>
                  <span className="text-[8px] uppercase leading-none mt-0.5">Th.{currentMonth + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{e.title}</p>
                  <p className="text-[10px] opacity-80 truncate">{eventTypeLabel(e.type)} • {e.location}</p>
                </div>
                <span className="text-[9px] font-bold uppercase flex-shrink-0">{eventStatusLabel(e.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* CỘT PHẢI: SỰ KIỆN SẮP TỚI + THỐNG KÊ + THÔNG BÁO SỰ KIỆN + CHI TIẾT SỰ KIỆN */}
      <div className="flex flex-col gap-4">
        {/* SỰ KIỆN SẮP TỚI — phân nhóm theo tiến độ thời gian (Step 4) */}
        <div id="upcoming-events-panel" className="bg-white border border-rose-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-rose-50 mb-3">
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><List className="w-4 h-4" /></span>
            <h3 className="font-sans font-semibold text-slate-900 text-xs">Sự kiện sắp tới</h3>
          </div>
          {upcomingGroups.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic font-sans">Không có sự kiện nào sắp diễn ra.</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-0.5">
              {upcomingGroups.map(group => (
                <div key={group.label}>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-rose-400 mb-1">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map(e => (
                      <div key={e.id} onClick={() => openEventFromList(e)}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-rose-50/40 cursor-pointer font-sans">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          e.type === EventType.DEATH_ANNIVERSARY ? "bg-red-400" :
                          e.type === EventType.GRAVE_VISIT ? "bg-emerald-400" :
                          e.type === EventType.OTHER ? "bg-purple-400" : "bg-blue-400"}`} />
                        <span className="text-[11px] text-slate-700 truncate flex-1">{e.title}</span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {(e.startDate || "").split("T")[0].split("-").slice(1).reverse().join("/")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* THỐNG KÊ SỰ KIỆN trong tháng đang xem (Step 4) */}
        <div id="event-stats-panel" className="bg-white border border-rose-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-rose-50 mb-3">
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><BarChart3 className="w-4 h-4" /></span>
            <h3 className="font-sans font-semibold text-slate-900 text-xs">Thống kê sự kiện — {monthNames[currentMonth]}</h3>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-slate-500 font-sans">Tổng số sự kiện trong tháng</span>
            <span className="text-rose-600 font-bold text-sm">{monthStats.total}</span>
          </div>
          {monthStats.total === 0 ? (
            <p className="text-[11px] text-slate-400 italic font-sans">Chưa có sự kiện nào trong tháng này.</p>
          ) : (
            <div className="space-y-1.5 font-sans">
              {([EventType.DEATH_ANNIVERSARY, EventType.MEETING, EventType.GRAVE_VISIT, EventType.OTHER] as EventType[])
                .filter(t => monthStats.byType[t])
                .map(t => (
                  <div key={t} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        t === EventType.DEATH_ANNIVERSARY ? "bg-red-400" :
                        t === EventType.GRAVE_VISIT ? "bg-emerald-400" :
                        t === EventType.OTHER ? "bg-purple-400" : "bg-blue-400"}`} />
                      {eventTypeLabel(t)}
                    </span>
                    <span className="font-bold text-slate-700">{monthStats.byType[t]}</span>
                  </div>
                ))}
              <div className="flex items-center gap-1.5 flex-wrap pt-2 mt-1 border-t border-slate-50">
                {([EventStatus.UPCOMING, EventStatus.COMPLETED, EventStatus.POSTPONED, EventStatus.CANCELLED] as EventStatus[])
                  .filter(s => monthStats.byStatus[s])
                  .map(s => (
                    <span key={s} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500">
                      {eventStatusLabel(s)}: {monthStats.byStatus[s]}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* THÔNG BÁO HỦY / HOÃN SỰ KIỆN — tách riêng khỏi lịch để tránh rối mắt khi xem lịch */}
        {statusAlerts.length > 0 && (
          <div id="event-status-alerts" className="bg-white border border-rose-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-rose-50 mb-3">
              <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Megaphone className="w-4 h-4" /></span>
              <h3 className="font-sans font-semibold text-slate-900 text-xs">Thông báo sự kiện</h3>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
              {statusAlerts.map(e => {
                const isCancelled = e.status === EventStatus.CANCELLED;
                return (
                  <div key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer ${isCancelled ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                    <Megaphone className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isCancelled ? "text-red-600" : "text-amber-600"}`} />
                    <div className="text-xs font-sans leading-snug">
                      <p className={`font-bold ${isCancelled ? "text-red-700" : "text-amber-800"}`}>
                        {isCancelled ? "Thông báo: Sự kiện đã bị HỦY" : "Thông báo: Sự kiện đã TẠM HOÃN"} — "{e.title}"
                      </p>
                      <p className={`mt-0.5 ${isCancelled ? "text-red-600" : "text-amber-700"}`}>
                        Lý do (Trưởng họ): {isCancelled ? e.cancelReason : e.postponeReason}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* CHI TIẾT SỰ KIỆN — chỉ hiển thị khi đã chọn một sự kiện trên lịch
          (bỏ trạng thái rỗng/placeholder vì không có logic, chỉ chiếm chỗ khi chưa chọn gì) */}
      {selectedEvent && (
      <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col h-full justify-between gap-4">
            <div>
              <div className="flex justify-between items-start pb-2 border-b border-rose-50 mb-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-500">
                  {selectedEvent.type === EventType.DEATH_ANNIVERSARY ? "Hương kỵ giỗ tộc" : "Gặp mặt hành chính"}
                </span>
                <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400"><X className="w-4 h-4" /></button>
              </div>
              <h4 className="font-sans font-bold text-slate-900 text-sm mb-2">{selectedEvent.title}</h4>
              <div className="mb-4">
                {selectedEvent.status === EventStatus.UPCOMING && <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold">Chưa diễn ra / Sắp tế lễ</span>}
                {selectedEvent.status === EventStatus.COMPLETED && <span className="text-xs bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">Đã hoàn thành</span>}
                {selectedEvent.status === EventStatus.POSTPONED && <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">Tạm hoãn</span>}
                {selectedEvent.status === EventStatus.CANCELLED && <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">Đã hủy bỏ</span>}
              </div>

              {/* Tư liệu / Hình ảnh — lưu trữ tài liệu sau sự kiện (Trưởng họ tải lên, mọi người xem) */}
              <button id="btn-open-event-media" onClick={() => setShowMediaModal(true)}
                className="w-full flex items-center justify-center gap-1.5 mb-4 px-3 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 text-xs font-bold rounded-lg cursor-pointer transition-colors">
                <MediaIcon className="w-3.5 h-3.5" /> Tư liệu / Hình ảnh
              </button>

              <div className="space-y-2.5 text-xs text-slate-700 font-sans leading-relaxed">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>Dương lịch: {(selectedEvent.startDate || "").split("T")[0]} {selectedEvent.startTime || "08:00"}</span>
                </div>
                {selectedEvent.lunarDateLabel && (
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Clock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Lễ giỗ Âm lịch: {selectedEvent.lunarDateLabel}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span>{selectedEvent.location}</span>
                </div>
                {selectedEvent.postponeReason && <div className="bg-amber-50 border border-amber-200 p-2 text-amber-900 rounded-lg italic">📢 Lý do hoãn (Trưởng họ): {selectedEvent.postponeReason}</div>}
                {selectedEvent.cancelReason && <div className="bg-red-50 border border-red-200 p-2 text-red-900 rounded-lg italic">📢 Lý do hủy (Trưởng họ): {selectedEvent.cancelReason}</div>}
                {selectedEvent.description && <div className="p-3 bg-slate-50 border rounded-lg mt-3"><p className="text-xs text-slate-600">{selectedEvent.description}</p></div>}
              </div>
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center justify-between text-xs font-sans mb-2">
                  <strong className="text-slate-900">Danh sách RSVP ({selectedEvent.rsvps.length}):</strong>
                  <span className="text-[10px] text-slate-500">Thời gian thực</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1.5">
                  {selectedEvent.rsvps.length > 0 ? selectedEvent.rsvps.map((r, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] bg-rose-50/20 p-2 rounded border border-rose-50/40">
                      <span className="font-semibold text-slate-800">{r.fullName}</span>
                      {r.status === RSVPStatus.ATTENDING
                        ? <span className="text-emerald-700 bg-emerald-50 px-1.5 rounded font-bold">Đi ({r.additionalGuests + 1})</span>
                        : <span className="text-red-700 bg-red-50 px-1.5 rounded font-bold" title={r.reason}>Vắng</span>
                      }
                    </div>
                  )) : <p className="text-[11px] text-slate-400 italic">Chưa có ai phản hồi RSVP.</p>}
                </div>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="pt-4 border-t flex flex-col gap-2">
              {/* UC3.7: Chỉ Thành viên và Ban tài chính phản hồi RSVP */}
              {canRsvp && selectedEvent.status === EventStatus.UPCOMING && (
                <button id="btn-trigger-rsvp-overlay"
                  onClick={() => { setRsvpStatus(myRsvp?.status || RSVPStatus.ATTENDING); setRsvpGuests(myRsvp?.additionalGuests || 0); setRsvpReason(myRsvp?.reason || ""); setShowRsvpModal(true); }}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer">
                  <CheckCircle className="w-4 h-4" /> {myRsvp ? "Đổi phản hồi tham dự" : "Phản hồi tham dự"}
                </button>
              )}

              {/* UC3.5: Chỉnh sửa, Hủy, Tạm hoãn — chỉ Trưởng họ */}
              {canManageEvent && selectedEvent.status === EventStatus.UPCOMING && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => openEditModal(selectedEvent)} className="px-3 py-1.5 text-[10px] uppercase font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer">
                      ✏️ Chỉnh sửa
                    </button>
                    <button id="btn-calendar-cancel" onClick={() => openStatusChangeModal(selectedEvent.id, EventStatus.CANCELLED)}
                      className="px-3 py-1.5 text-[10px] uppercase font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer">
                      🚫 Hủy sự kiện
                    </button>
                  </div>
                  <button id="btn-calendar-postpone" onClick={() => openStatusChangeModal(selectedEvent.id, EventStatus.POSTPONED)}
                    className="w-full px-3 py-1.5 text-[10px] uppercase font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer">
                    ⏸ Tạm hoãn sự kiện
                  </button>
                </>
              )}

              {/* UC3.6: Sự kiện Tạm hoãn có thể được Trưởng họ cho TIẾP TỤC lại theo dự kiến,
                  thay vì bị dừng vĩnh viễn — hoặc đổi ngày mới / hủy hẳn nếu cần. */}
              {canManageEvent && selectedEvent.status === EventStatus.POSTPONED && (
                <>
                  <button id="btn-calendar-resume" onClick={() => resumeEvent(selectedEvent.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer">
                    <CheckCircle className="w-4 h-4" /> ▶️ Tiếp tục sự kiện theo dự kiến
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => openEditModal(selectedEvent)} className="px-3 py-1.5 text-[10px] uppercase font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer">
                      ✏️ Đổi ngày mới
                    </button>
                    <button id="btn-calendar-cancel-from-postponed" onClick={() => openStatusChangeModal(selectedEvent.id, EventStatus.CANCELLED)}
                      className="px-3 py-1.5 text-[10px] uppercase font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer">
                      🚫 Hủy hẳn sự kiện
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
      </div>
      )}
      </div>

      {/* MODAL THÊM/SỬA SỰ KIỆN */}
      {showAddEventModal && (
        <div id="modal-calendar-add-event" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="font-sans font-semibold text-slate-900 text-sm">{editingEventId ? "Chỉnh sửa sự kiện" : "Tạo sự kiện mới"}</h3>
              <button onClick={() => { setShowAddEventModal(false); setEditingEventId(null); setFormError(""); }} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
              {/* CỘT TRÁI: Form nhập liệu */}
              <form id="form-create-event" onSubmit={handleSubmitEvent} className="md:col-span-3 flex flex-col gap-3 text-xs font-sans p-6 border-r border-slate-100">

                {/* Lỗi validation */}
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-red-700 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tên sự kiện <span className="text-red-500">*</span></label>
                  <input type="text" required placeholder="Ví dụ: Giỗ tổ phụ Nguyễn Bá Cao..." value={eventData.title}
                    onChange={e => setEventData({ ...eventData, title: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500" />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Danh mục sự kiện</label>
                  <select value={eventData.type} onChange={e => setEventData({ ...eventData, type: e.target.value as any })} className="w-full border rounded-lg p-2 bg-slate-50">
                    <option value={EventType.DEATH_ANNIVERSARY}>Giỗ chạp</option>
                    <option value={EventType.MEETING}>Họp tộc / Đại hội</option>
                    <option value={EventType.GRAVE_VISIT}>Tảo mộ tổ tiên</option>
                    <option value={EventType.OTHER}>Lễ khác</option>
                  </select>
                </div>

                {/* Thời gian bắt đầu */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Ngày bắt đầu <span className="text-red-500">*</span></label>
                    <input type="date" required value={eventData.startDate}
                      onChange={e => setEventData({ ...eventData, startDate: e.target.value })}
                      className="w-full border rounded-lg p-2 bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Giờ bắt đầu</label>
                    <input type="time" value={eventData.startTime}
                      onChange={e => setEventData({ ...eventData, startTime: e.target.value })}
                      className="w-full border rounded-lg p-2 bg-slate-50" />
                  </div>
                </div>

                {/* Thời gian kết thúc */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Ngày kết thúc</label>
                    <input type="date" value={eventData.endDate}
                      min={eventData.startDate}
                      onChange={e => setEventData({ ...eventData, endDate: e.target.value })}
                      className="w-full border rounded-lg p-2 bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Giờ kết thúc</label>
                    <input type="time" value={eventData.endTime}
                      onChange={e => setEventData({ ...eventData, endTime: e.target.value })}
                      className="w-full border rounded-lg p-2 bg-slate-50" />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Ghi chú Âm lịch</label>
                  <input type="text" placeholder="VD: 10/03 Âm lịch" value={eventData.lunarDateLabel}
                    onChange={e => setEventData({ ...eventData, lunarDateLabel: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50" />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Địa điểm <span className="text-red-500">*</span></label>
                  <input type="text" required value={eventData.location}
                    onChange={e => setEventData({ ...eventData, location: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50" />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nội dung chi tiết</label>
                  <textarea value={eventData.description}
                    onChange={e => setEventData({ ...eventData, description: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50 h-20 resize-none"
                    placeholder="Ghi chú lễ sắm, chương trình cụ thể..." />
                </div>

                {/* Thành phần tham dự */}
                <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <label className="block text-slate-700 font-semibold text-xs">Thành phần tham dự</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: "ALL", label: "🏠 Toàn dòng họ" },
                      { value: "ROLE", label: "👤 Theo quyền" },
                      { value: "CUSTOM", label: "✏️ Tùy chọn cụ thể" },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setEventData(f => ({ ...f, attendeeType: opt.value as any, attendeeRoles: [], attendeeIds: [] }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${eventData.attendeeType === opt.value ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {eventData.attendeeType === "ROLE" && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[10px] text-slate-500">Chọn vai trò được mời:</p>
                      {[
                        { value: "LEADER", label: "Trưởng họ" },
                        { value: "TREASURER", label: "Ban tài chính" },
                        { value: "MEMBER", label: "Thành viên" },
                      ].map(r => (
                        <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={eventData.attendeeRoles.includes(r.value)}
                            onChange={e => { const roles = e.target.checked ? [...eventData.attendeeRoles, r.value] : eventData.attendeeRoles.filter(x => x !== r.value); setEventData(f => ({ ...f, attendeeRoles: roles })); }}
                            className="rounded" />
                          <span className="text-xs text-slate-700">{r.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {eventData.attendeeType === "CUSTOM" && (
                    <div className="space-y-1 pt-1 max-h-32 overflow-y-auto">
                      <p className="text-[10px] text-slate-500">Chọn thành viên cụ thể (chỉ thành viên còn sống):</p>
                      {livingMembers.map(m => (
                        <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={eventData.attendeeIds.includes(m.id)}
                            onChange={e => { const ids = e.target.checked ? [...eventData.attendeeIds, m.id] : eventData.attendeeIds.filter(x => x !== m.id); setEventData(f => ({ ...f, attendeeIds: ids })); }}
                            className="rounded" />
                          <span className="text-xs text-slate-700">{m.fullName} — Đời {m.generation}</span>
                        </label>
                      ))}
                      {livingMembers.length < members.length && (
                        <p className="text-[10px] text-slate-400 italic pt-1">
                          {members.length - livingMembers.length} thành viên đã khuất không hiển thị ở đây vì không thể mời tham dự.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button type="button" onClick={() => { setShowAddEventModal(false); setEditingEventId(null); setFormError(""); }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer">Hủy</button>
                  <button id="btn-submit-calendar-add" type="submit"
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg cursor-pointer">
                    {editingEventId ? "💾 Lưu thay đổi" : "Lưu và Tạo sự kiện"}
                  </button>
                </div>
              </form>

              {/* CỘT PHẢI: Tóm tắt sự kiện + Danh sách mời (Step 5) */}
              <div className="md:col-span-2 p-5 bg-slate-50/60 flex flex-col gap-4 text-xs font-sans">
                {/* Tóm tắt sự kiện */}
                <div className="bg-white border border-rose-100 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-3">Tóm tắt sự kiện</p>
                  <div className="space-y-2 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tên:</span>
                      <span className="font-semibold text-right max-w-[130px] truncate">{eventData.title || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Danh mục:</span>
                      <span className="font-semibold">
                        {eventData.type === EventType.DEATH_ANNIVERSARY ? "Giỗ chạp" :
                         eventData.type === EventType.MEETING ? "Họp tộc" :
                         eventData.type === EventType.GRAVE_VISIT ? "Tảo mộ" : "Lễ khác"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bắt đầu:</span>
                      <span className="font-semibold">{eventData.startDate ? `${eventData.startDate} ${eventData.startTime}` : "—"}</span>
                    </div>
                    {eventData.endDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Kết thúc:</span>
                        <span className="font-semibold">{`${eventData.endDate} ${eventData.endTime || ""}`}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Địa điểm:</span>
                      <span className="font-semibold text-right max-w-[130px] truncate">{eventData.location || "—"}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-1">
                      <span className="text-slate-500 font-semibold">Khách mời dự kiến:</span>
                      <span className="text-rose-600 font-bold text-sm">
                        {computedInvitees.length} người
                      </span>
                    </div>
                  </div>
                </div>

                {/* Danh sách sẽ được mời */}
                <div className="bg-white border border-rose-100 rounded-xl p-4 shadow-sm flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-2">Danh sách sẽ được mời</p>
                  {eventData.attendeeType === "ALL" && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {livingMembers.map(m => (
                        <div key={m.id} className="flex items-center gap-2 py-1 border-b border-slate-50">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                          <span className="text-slate-700 truncate">{m.fullName}</span>
                          <span className="text-slate-400 ml-auto">Đời {m.generation}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {eventData.attendeeType === "ROLE" && (
                    eventData.attendeeRoles.length === 0
                      ? <p className="text-slate-400 italic">Chưa chọn vai trò.</p>
                      : roleBasedInvitees.length === 0
                        ? <p className="text-slate-400 italic">Chưa có thành viên nào giữ vai trò này.</p>
                        : <div className="max-h-48 overflow-y-auto space-y-1">
                            {roleBasedInvitees.map(p => (
                              <div key={p.id} className="flex items-center gap-2 py-1 border-b border-slate-50">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                                <span className="text-slate-700 truncate">{p.fullName}</span>
                                {p.generation != null && <span className="text-slate-400 ml-auto">Đời {p.generation}</span>}
                              </div>
                            ))}
                          </div>
                  )}
                  {eventData.attendeeType === "CUSTOM" && (
                    eventData.attendeeIds.length === 0
                      ? <p className="text-slate-400 italic">Chưa chọn thành viên.</p>
                      : <div className="max-h-48 overflow-y-auto space-y-1">
                          {livingMembers.filter(m => eventData.attendeeIds.includes(m.id)).map(m => (
                            <div key={m.id} className="flex items-center gap-2 py-1 border-b border-slate-50">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                              <span className="text-slate-700 truncate">{m.fullName}</span>
                            </div>
                          ))}
                        </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RSVP */}
      {showRsvpModal && selectedEvent && (
        <div id="modal-calendar-rsvp" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center pb-2 border-b mb-4">
              <h3 className="font-sans font-semibold text-slate-900 text-sm">Phản hồi tham dự</h3>
              <button onClick={() => setShowRsvpModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleRsvpSubmit} className="flex flex-col gap-3 text-xs font-sans">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Xác nhận tham gia</label>
                <select value={rsvpStatus} onChange={e => setRsvpStatus(e.target.value as RSVPStatus)} className="w-full border rounded-lg p-2 bg-slate-50">
                  <option value={RSVPStatus.ATTENDING}>Đồng ý, tôi sẽ tham dự</option>
                  <option value={RSVPStatus.ABSENT}>Vắng mặt (bắt buộc ghi lý do)</option>
                  <option value={RSVPStatus.UNDECIDED}>Chưa chắc chắn</option>
                </select>
              </div>
              {rsvpStatus !== RSVPStatus.ABSENT ? (
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Số người đi kèm (tối đa 10)</label>
                  <input type="number" min="0" max="10" value={rsvpGuests} onChange={e => setRsvpGuests(Number(e.target.value))} className="w-full border rounded-lg p-2 bg-slate-50" />
                </div>
              ) : (
                <div>
                  <label className="block text-red-700 font-bold mb-1">Lý do vắng mặt *</label>
                  <textarea required placeholder="Ghi rõ lý do vắng mặt..." value={rsvpReason} onChange={e => setRsvpReason(e.target.value)} className="w-full border border-red-200 bg-red-50/10 rounded-lg p-2 h-20 resize-none" />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button type="button" onClick={() => setShowRsvpModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer">Hủy</button>
                <button id="btn-submit-rsvp" type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer">Ghi nhận RSVP</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LÝ DO HỦY / TẠM HOÃN — UC3.5 */}
      {statusChangeModal && (
        <div id="modal-event-status-change" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center pb-2 border-b mb-4">
              <h3 className="font-sans font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                {statusChangeModal.newStatus === EventStatus.CANCELLED
                  ? <><AlertTriangle className="w-4 h-4 text-red-600" /> Hủy sự kiện</>
                  : <><AlertTriangle className="w-4 h-4 text-amber-600" /> Tạm hoãn sự kiện</>}
              </h3>
              <button onClick={() => setStatusChangeModal(null)} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-600 font-sans mb-3">
              Sự kiện <strong className="text-slate-900">"{statusChangeModal.eventTitle}"</strong> sẽ được {statusChangeModal.newStatus === EventStatus.CANCELLED ? "đánh dấu HỦY" : "tạm HOÃN"}.
              Lý do dưới đây sẽ được hiển thị làm thông báo tới toàn bộ khách mời tham dự, ngay tại mục "Sự kiện" của họ.
            </p>
            <label className="block text-red-700 text-xs font-bold mb-1">
              Lý do {statusChangeModal.newStatus === EventStatus.CANCELLED ? "hủy" : "hoãn"} sự kiện <span>*</span>
            </label>
            <textarea
              autoFocus
              required
              placeholder={statusChangeModal.newStatus === EventStatus.CANCELLED ? "Ví dụ: Thay đổi kế hoạch ban tế tự..." : "Ví dụ: Thời tiết không thuận hòa..."}
              value={statusChangeReason}
              onChange={e => { setStatusChangeReason(e.target.value); setStatusChangeErr(""); }}
              className="w-full border border-red-200 bg-red-50/10 rounded-lg p-2 h-24 resize-none text-xs font-sans"
            />
            {statusChangeErr && (
              <p className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {statusChangeErr}</p>
            )}
            <div className="flex justify-end gap-3 pt-4 mt-2 border-t">
              <button type="button" onClick={() => setStatusChangeModal(null)} className="px-4 py-2 text-xs bg-slate-100 text-slate-700 rounded-lg cursor-pointer">Đóng</button>
              <button id="btn-confirm-status-change" type="button" onClick={confirmStatusChange}
                className={`px-4 py-2 text-xs text-white rounded-lg cursor-pointer font-bold ${statusChangeModal.newStatus === EventStatus.CANCELLED ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}>
                Xác nhận & Gửi thông báo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TƯ LIỆU / HÌNH ẢNH SỰ KIỆN */}
      {showMediaModal && selectedEvent && (
        <EventMediaModal
          event={selectedEvent}
          canManage={canManageEvent && selectedEvent.status !== EventStatus.CANCELLED}
          onClose={() => setShowMediaModal(false)}
        />
      )}

      {/* LOG BROADCAST */}
      <div className="xl:col-span-3 bg-slate-900 rounded-xl p-4 border border-slate-800 font-mono text-[10px] text-emerald-400">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <span className="font-bold tracking-widest text-[#059669]">SIMULATOR NOTIFICATION LOG CENTER (EMAIL / SMS BROADCAST MOCK)</span>
          <span className="text-slate-500">Mô phỏng phát sóng di động hỏa tốc tự động</span>
        </div>
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {simulatedLogs.length > 0
            ? simulatedLogs.map((log, i) => <div key={i} className="leading-relaxed">{log}</div>)
            : <div className="text-slate-600 italic">Chưa có bản ghi tin nhắn quảng bá nào phát sinh. Tạo mới sự kiện hoặc hoãn/hủy sự kiện để kiểm thử.</div>
          }
        </div>
      </div>
    </div>
  );
}