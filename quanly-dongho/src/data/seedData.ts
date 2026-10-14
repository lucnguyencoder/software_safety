/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Gender, 
  LivingStatus, 
  UserRole, 
  AccountStatus, 
  UserAccount, 
  ClanMember, 
  ClanEvent, 
  EventType, 
  EventStatus, 
  FundTransaction, 
  FundCategory, 
  TransactionType,
  AnnualQuota,
  AuditLog,
  RSVPStatus
} from "../types";

// Thông tin chung của dòng họ (Thông tin cơ bản chuẩn)
export const CLAN_PROFILE = {
  name: "Nguyễn Bá Tộc",
  origin: "Làng Cổ Am, huyện Vụ Bản, tỉnh Nam Định",
  ancestorName: "Cụ tổ Nguyễn Bá Cao (Húy tự Minh Đức)",
  templeAddress: "Số 88, Đường Cổ Am, xã Liên Minh, huyện Vụ Bản, Nam Định",
  generalNotes: "Họ Nguyễn Bá hưng thịnh khởi nguồn từ vùng đất hiếu học Vụ Bản, Nam Định. Trải qua nhiều thế hệ phò vua giúp nước, dòng họ luôn giữ vững truyền thống văn hóa hiếu kính tâm linh, khuyến học khuyến tài và bảo tồn nguyên vẹn hương hỏa tổ đường cổ kính.",
  anniversaryDayLunar: "10 tháng 03 Âm lịch hằng năm (Lễ Giỗ tổ)",
  regulations: [
    "Một lòng hiếu kính cha mẹ, tôn thờ phụng sự tổ tiên.",
    "Khuyến học khuyến tài, vinh danh nâng đỡ con cháu đỗ đạt.",
    "Gia đình hòa thuận, tương thân tương ái lúc hoạn nạn khó khăn.",
    "Bảo tồn gìn giữ tôn nghiêm từ đường dòng họ.",
    "Tham gia đầy đủ các kỳ giỗ chạp, tảo mộ và tế lễ thường niên."
  ]
};

// Tài khoản người dùng cơ bản của hệ thống
export const INITIAL_ACCOUNTS: UserAccount[] = [
  {
    id: "acc_admin",
    phone: "0901234567",
    email: "admin.nam@gmail.com",
    fullName: "Nguyễn Hoàng Nam",
    password: "123456",
    role: UserRole.ADMIN,
    status: AccountStatus.ACTIVE,
    inviteCode: "SYSTEM_ROOT",
    registeredAt: "2026-01-01 08:30"
  },
  {
    id: "acc_leader",
    phone: "0983111222",
    email: "trungho.nguyenba@gmail.com",
    fullName: "Nguyễn Bá Trung",
    password: "123456",
    role: UserRole.LEADER,
    status: AccountStatus.ACTIVE,
    inviteCode: "NGUYEN_BA_TRUONG",
    registeredAt: "2026-01-02 09:15",
    mappedMemberId: "m_gen3_trung"
  },
  {
    id: "acc_treasurer",
    phone: "0912444555",
    email: "hoangfinance@gmail.com",
    fullName: "Nguyễn Bá Hoàng",
    password: "123456",
    role: UserRole.TREASURER,
    status: AccountStatus.ACTIVE,
    inviteCode: "QUY_DONG_HO_2026",
    registeredAt: "2026-01-05 14:20",
    mappedMemberId: "m_gen4_hoang"
  },
  {
    id: "acc_member_haituan",
    phone: "0977888999",
    email: "tuanba.nguyen@gmail.com",
    fullName: "Nguyễn Bá Anh Tuấn",
    password: "123456",
    role: UserRole.MEMBER,
    status: AccountStatus.ACTIVE,
    inviteCode: "CONCHAU_BUI_GIA",
    registeredAt: "2026-01-10 10:45",
    mappedMemberId: "m_gen4_anhtuan"
  }
];

// Danh sách các đinh nam và thành viên trực hệ trong phả hệ dòng họ
export const INITIAL_MEMBERS: ClanMember[] = [
  // Thế hệ thứ 1 (Thủy Tổ)
  {
    id: "m_gen1_cao",
    fullName: "Nguyễn Bá Cao",
    gender: Gender.MALE,
    livingStatus: LivingStatus.DECEASED,
    birthDate: "1890-04-12",
    birthDateLunar: "15/03/Canh Dần",
    deathDate: "1965-11-03",
    deathDateLunar: "10/10/Ất Tỵ",
    originAddress: "Vụ Bản, Nam Định",
    currentAddress: "Đền thờ dòng họ Cổ Am, Liên Minh, Nam Định",
    notes: "Cụ Thủy tổ sáng khai dòng họ, là danh nho nho học mẫu mực.",
    generation: 1,
    representativeRole: "Thủy Tổ Tông dòng dòng"
  },
  {
    id: "m_gen1_mai",
    fullName: "Lê Thị Mai",
    gender: Gender.FEMALE,
    livingStatus: LivingStatus.DECEASED,
    birthDate: "1895-08-20",
    deathDate: "1978-05-02",
    deathDateLunar: "25/03/Mậu Ngọ",
    originAddress: "Vụ Bản, Nam Định",
    notes: "Chính thất Tổ Mẫu đức hạnh nhân hậu.",
    generation: 1,
    spouseId: "m_gen1_cao",
    representativeRole: "Chính thất Thủy Tổ Mẫu"
  },

  // Thế hệ thứ 2 (Nhánh trung gian kế thừa trực hệ)
  {
    id: "m_gen2_thao",
    fullName: "Nguyễn Bá Thao",
    gender: Gender.MALE,
    livingStatus: LivingStatus.DECEASED,
    birthDate: "1922-01-10",
    deathDate: "2005-05-15",
    deathDateLunar: "08/04/Ất Dậu",
    generation: 2,
    fatherId: "m_gen1_cao",
    motherId: "m_gen1_mai",
    notes: "Nhân vật kiệt xuất kế thừa, tham gia bảo vệ chính quyền từ nguyên sơ.",
    representativeRole: "Cố Trưởng tộc đời thứ 2"
  },
  {
    id: "m_gen2_hien",
    fullName: "Vũ Thị Hiền",
    gender: Gender.FEMALE,
    livingStatus: LivingStatus.DECEASED,
    birthDate: "1926-03-15",
    deathDate: "2012-09-18",
    deathDateLunar: "03/08/Nhâm Thìn",
    generation: 2,
    spouseId: "m_gen2_thao"
  },

  // Thế hệ thứ 3 (Tộc trưởng đương thời)
  {
    id: "m_gen3_trung",
    fullName: "Nguyễn Bá Trung",
    gender: Gender.MALE,
    livingStatus: LivingStatus.ALIVE,
    birthDate: "1955-09-15",
    phone: "0983111222",
    email: "trungho.nguyenba@gmail.com",
    originAddress: "Vụ Bản, Nam Định",
    currentAddress: "Trúc Bạch, Ba Đình, Hà Nội",
    notes: "Đương nhiệm Trưởng họ Nguyễn Bá Tộc, uy tín hiền dung đức độ hưng thâu.",
    generation: 3,
    fatherId: "m_gen2_thao",
    motherId: "m_gen2_hien",
    job: "Biên tập viên lão thành",
    representativeRole: "Tộc Trưởng đương nhiệm"
  },
  {
    id: "m_gen3_lan",
    fullName: "Trần Thị Lan",
    gender: Gender.FEMALE,
    livingStatus: LivingStatus.ALIVE,
    birthDate: "1958-10-12",
    originAddress: "Ba Đình, Hà Nội",
    currentAddress: "Ba Đình, Hà Nội",
    generation: 3,
    spouseId: "m_gen3_trung"
  },

  // Thế hệ thứ 4 (Hội đồng gia tộc)
  {
    id: "m_gen4_anhtuan",
    fullName: "Nguyễn Bá Anh Tuấn",
    gender: Gender.MALE,
    livingStatus: LivingStatus.ALIVE,
    birthDate: "1982-10-25",
    phone: "0977888999",
    email: "tuanba.nguyen@gmail.com",
    currentAddress: "Hoàn Kiếm, Hà Nội",
    generation: 4,
    fatherId: "m_gen3_trung",
    motherId: "m_gen3_lan",
    job: "Chuyên gia CNTT cấp cao",
    representativeRole: "Ban Khuyến học dòng họ"
  },
  {
    id: "m_gen4_hoang",
    fullName: "Nguyễn Bá Hoàng",
    gender: Gender.MALE,
    livingStatus: LivingStatus.ALIVE,
    birthDate: "1990-04-10",
    phone: "0912444555",
    email: "hoangfinance@gmail.com",
    currentAddress: "Thành phố Nam Định",
    generation: 4,
    fatherId: "m_gen3_trung",
    motherId: "m_gen3_lan",
    job: "Kiểm toán viên cao cấp",
    representativeRole: "Thủ Quỹ Ban tài chính dòng tộc"
  }
];

// Danh sách sự kiện ban đầu
export const INITIAL_EVENTS: ClanEvent[] = [
  {
    id: "eve_meeting_1",
    title: "Đại hội Nguyễn Bá Tộc niên khóa 2026",
    type: EventType.MEETING,
    startDate: "2026-06-15",
    startTime: "08:30",
    endDate: "2026-06-15",
    lunarDateLabel: "01 tháng 05 Âm lịch Bính Ngọ",
    location: "Sân từ đường dòng họ Nguyễn Bá, Liên Minh, Nam Định",
    description: "Kỳ họp toàn thể đại gia đình để tổng kết đóng góp tôn tạo và triển khai phát quỹ mừng thọ, khuyến học thường niên cho thế hệ trẻ.",
    status: EventStatus.UPCOMING,
    createdBy: "Trưởng họ Nguyễn Bá Trung",
    createdAt: "2026-05-15",
    rsvps: [
      { accountId: "acc_leader", fullName: "Nguyễn Bá Trung", status: RSVPStatus.ATTENDING, additionalGuests: 0, updatedAt: "2026-05-20" },
      { accountId: "acc_treasurer", fullName: "Nguyễn Bá Hoàng", status: RSVPStatus.ATTENDING, additionalGuests: 1, updatedAt: "2026-05-21" },
      { accountId: "acc_member_haituan", fullName: "Nguyễn Bá Anh Tuấn", status: RSVPStatus.ATTENDING, additionalGuests: 2, updatedAt: "2026-05-22" }
    ]
  },
  {
    id: "eve_gioto_2026",
    title: "Đại lễ Giỗ tổ Nguyễn Bá tộc (Chính võ kỵ)",
    type: EventType.DEATH_ANNIVERSARY,
    startDate: "2026-04-26", // 10/03 Âm lịch 2026 là 26/04 Dương lịch
    startTime: "09:00",
    endDate: "2026-04-26",
    lunarDateLabel: "10 tháng 03 Bính Ngọ",
    location: "Từ đường dòng họ Nguyễn Bá, Cổ Am, Nam Định",
    description: "Đại kỵ giỗ tổ thường niên tâm linh, dâng nén nhang thành kính tổ tiên dòng họ và tập trung ẩm thực phái đoàn nội tộc.",
    status: EventStatus.COMPLETED,
    createdBy: "Hội đồng gia tộc",
    createdAt: "2026-03-10",
    rsvps: [
      { accountId: "acc_leader", fullName: "Nguyễn Bá Trung", status: RSVPStatus.ATTENDING, additionalGuests: 1, updatedAt: "2026-04-01" },
      { accountId: "acc_treasurer", fullName: "Nguyễn Bá Hoàng", status: RSVPStatus.ATTENDING, additionalGuests: 2, updatedAt: "2026-04-02" }
    ],
    media: [
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600"
    ]
  }
];

// Định mức đóng quỹ niên liễm hằng năm của thành viên
export const INITIAL_QUOTA: AnnualQuota = {
  year: 2026,
  amountPerMember: 300000, // 300.000 VNĐ gieo mầm xuân sắc
  description: "Phí niên liễm thường niên phục vụ việc duy trì hương khói Từ đường cổ kính, chuẩn tế lễ thường kỳ và thăm hỏi tương trợ thành viên."
};

// Sổ giao dịch tài khố ngân quỹ dòng tộc ban đầu
export const INITIAL_TRANSACTIONS: FundTransaction[] = [
  {
    id: "tx_1",
    type: TransactionType.INCOME,
    category: FundCategory.ANNUAL_FEE,
    amount: 1500000,
    date: "2026-02-15",
    payerOrReceiver: "Gia đình đinh nam Nguyễn Bá Anh Tuấn",
    memberId: "m_gen4_anhtuan",
    description: "Hoàn tất nộp niên liễm năm học tế 2026 bảo chứng an cư gia tộc.",
    recordedBy: "Nguyễn Bá Hoàng",
    createdAt: "2026-02-15"
  },
  {
    id: "tx_2",
    type: TransactionType.INCOME,
    category: FundCategory.SPONSORSHIP,
    amount: 5000000,
    date: "2026-04-10",
    payerOrReceiver: "Hội đồng Viễn xứ Nguyễn Bá tộc",
    description: "Phát nguyện quyên góp đại phước cho từ đường sơn son thếp vàng hoành tráng.",
    recordedBy: "Nguyễn Bá Hoàng",
    createdAt: "2026-04-10"
  },
  {
    id: "tx_3",
    type: TransactionType.EXPENSE,
    category: FundCategory.EVENT_ORGANIZATION,
    amount: 2500000,
    date: "2026-04-25",
    payerOrReceiver: "Ban sắm lễ Nam Định",
    description: "Sắm sửa hương khói dâng hoa quả quả ngọt xôi gấc lễ Thần nông giỗ tuần kỵ cổ đại.",
    recordedBy: "Nguyễn Bá Hoàng",
    createdAt: "2026-04-25"
  }
];

// Nhật ký vận hành kiểm toán hệ thống ban đầu
export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: "log_1",
    timestamp: "2026-05-31 08:00:00",
    actorName: "Hệ thống (Gia Tộc Việt)",
    action: "KHỞI CHẠY HỆ THỐNG",
    module: "Core Engine",
    details: "Đồng bộ hóa thành công dòng tộc phả hệ Nguyễn Bá Tộc Liên Minh, Vụ Bản, Nam Định."
  }
];

// Logic chuyển đổi âm dương thô giản
export function convertLunarToSolar2026(lunarMonth: number, lunarDay: number): string {
  if (lunarMonth === 3 && lunarDay === 10) return "2026-04-26";
  if (lunarMonth === 10 && lunarDay === 10) return "2026-11-19";
  if (lunarMonth === 3 && lunarDay === 25) return "2026-05-11";
  if (lunarMonth === 4 && lunarDay === 8) return "2026-05-24";
  if (lunarMonth === 8 && lunarDay === 3) return "2026-09-13";
  if (lunarMonth === 12 && lunarDay === 29) return "2026-02-06";
  
  const dateObj = new Date(2026, lunarMonth - 1, lunarDay);
  dateObj.setDate(dateObj.getDate() + 35);
  return dateObj.toISOString().split("T")[0];
}

// Tự sinh dòng giỗ chạp tử nam
export function generateAutoAnniversaries(members: ClanMember[]): { member: ClanMember; solarDate: string }[] {
  return members
    .filter(m => m.livingStatus === LivingStatus.DECEASED && m.deathDateLunar)
    .map(m => {
      const parts = m.deathDateLunar!.split("/");
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const solarDate = convertLunarToSolar2026(month, day);
      return { member: m, solarDate };
    });
}
