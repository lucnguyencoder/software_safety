/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  TrendingUp, TrendingDown, DollarSign, Plus, Search, Filter, 
  Settings, User, Clock, CheckCircle, HelpCircle, X, Percent, Download, BarChart3
} from "lucide-react";
import { FundTransaction, FundCategory, TransactionType, UserRole, UserAccount, AnnualQuota, ClanMember } from "../types";
import QuotaSettingPage from "./QuotaSettingPage";
import AnnualFeeCollectionPage from "./AnnualFeeCollectionPage";
import ExtraContributionPage from "./ExtraContributionPage";
import IncomeReportPage from "./IncomeReportPage";
import ExpenseReportPage from "./ExpenseReportPage";

interface FinanceFundProps {
  transactions: FundTransaction[];
  annualQuota: AnnualQuota;
  currentAccount: UserAccount;
  allMembers: ClanMember[];
  onAddTransaction: (newTx: Omit<FundTransaction, "id">) => void;
  onUpdateQuota: (updatedQuota: AnnualQuota) => Promise<void>;
}

export default function FinanceFund({
  transactions,
  annualQuota,
  currentAccount,
  allMembers,
  onAddTransaction,
  onUpdateQuota,
}: FinanceFundProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<FundCategory | "ALL">("ALL");

  // State Modal Thêm giao dịch tài khóa
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"fund" | "quota_setting" | "fee_collection" | "extra_contribution" | "income_report" | "expense_report">("fund");

  const [txForm, setTxForm] = useState({
    type: TransactionType.INCOME,
    category: FundCategory.ANNUAL_FEE,
    amount: 500000,
    date: new Date().toISOString().split("T")[0],
    payerOrReceiver: "",
    memberId: "",
    description: "",
  });

  const [quotaForm, setQuotaForm] = useState({
    amountPerMember: annualQuota.amountPerMember,
    description: annualQuota.description,
  });

const isTreasurerOrLeader = currentAccount.role === UserRole.TREASURER;
  // Xuất CSV báo cáo thu/chi (R4.4, R4.7)
  const exportCSV = (type: "income" | "expense" | "all") => {
    const data = filteredTxs.filter(t =>
      type === "all" ? true : type === "income" ? t.type === TransactionType.INCOME : t.type === TransactionType.EXPENSE
    );
    const header = ["Mã phiếu", "Loại", "Danh mục", "Số tiền (VNĐ)", "Ngày", "Người nộp/nhận", "Nội dung", "Ghi bởi"];
    const catLabel: Record<string, string> = {
      ANNUAL_FEE: "Niên liễm", VOLUNTARY: "Tự nguyện", SPONSORSHIP: "Tài trợ",
      EVENT_ORGANIZATION: "Chi sự kiện", TEMPLE_REPAIR: "Xây dựng từ đường",
      CHARITY_STUDY: "Khuyến học", OTHER: "Khác"
    };
    const rows = data.map(t => [
      t.id, t.type === TransactionType.INCOME ? "Thu" : "Chi",
      catLabel[t.category] || t.category,
      t.amount.toString(), t.date, t.payerOrReceiver,
      t.description, t.recordedBy || ""
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-${type}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 1. TÍNH TOÁN CÁC CHỈ SỐ QUỸ
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === TransactionType.INCOME) income += t.amount;
      else expense += t.amount;
    });
    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense
    };
  }, [transactions]);

  // Bộ lọc danh mục
  const filteredTxs = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = t.payerOrReceiver.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === "ALL" || t.type === typeFilter;
      const matchCat = categoryFilter === "ALL" || t.category === categoryFilter;
      return matchSearch && matchType && matchCat;
    });
  }, [transactions, searchTerm, typeFilter, categoryFilter]);

  // Định dạng hiển thị tiền vệ VNĐ gọn gàng
  const formatVND = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (txForm.amount <= 0) {
      alert("Số tiền sắm sanh giao giao tịch bắt buộc phải lớn hơn 0 VNĐ!");
      return;
    }

    onAddTransaction({
      type: txForm.type,
      category: txForm.category,
      amount: txForm.amount,
      date: txForm.date,
      payerOrReceiver: txForm.payerOrReceiver,
      memberId: txForm.memberId || undefined,
      description: txForm.description,
      recordedBy: currentAccount.fullName,
      createdAt: new Date().toISOString().split("T")[0],
    });

    setShowAddTxModal(false);
  };

  const handleQuotaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateQuota({
      year: 2026,
      amountPerMember: quotaForm.amountPerMember,
      description: quotaForm.description,
    });
    setShowQuotaModal(false);
  };

  // 2. VẼ BIỂU ĐỒ DIỄN BIẾN SỐ TIỀN THU CHI BẰNG CUSTOM RESPONSIVE SVG
  // Gộp dữ liệu THẬT theo từng tháng (T1 → T12) của năm hiện tại, lấy trực tiếp
  // từ danh sách `transactions` — đồng bộ với mọi nơi khác trong hệ thống.
  const chartData = useMemo(() => {
    const year = new Date().getFullYear();
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({ month: `T${i + 1}`, thu: 0, chi: 0 }));

    transactions.forEach(t => {
      const d = new Date(t.date);
      if (d.getFullYear() !== year) return;
      const idx = d.getMonth();
      if (idx < 0 || idx > 11) return;
      if (t.type === TransactionType.INCOME) monthlyStats[idx].thu += t.amount;
      else monthlyStats[idx].chi += t.amount;
    });

    return monthlyStats;
  }, [transactions]);

  // Các điểm tọa độ vẽ biểu đồ
  const chartWidth = 720;
  const chartHeight = 160;
  const xStep = chartWidth / (chartData.length - 1);
  // Mốc tối đa trục Y luôn bám theo giá trị thu/chi cao nhất thực tế (tối thiểu 1 triệu để biểu đồ không bị dẹt khi chưa có dữ liệu)
  const maxVal = Math.max(...chartData.map(d => Math.max(d.thu, d.chi)), 1000000);
  const fmtTr = (v: number) => `${(v / 1000000).toFixed(1)} Tr`;

  const pointsThu = chartData.map((d, i) => {
    const x = 40 + i * xStep;
    const y = chartHeight - 20 - (d.thu / maxVal) * (chartHeight - 40);
    return { x, y };
  });

  const pointsChi = chartData.map((d, i) => {
    const x = 40 + i * xStep;
    const y = chartHeight - 20 - (d.chi / maxVal) * (chartHeight - 40);
    return { x, y };
  });

  const pathDThu = `M ${pointsThu[0].x} ${pointsThu[0].y} ` + pointsThu.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
  const pathDChi = `M ${pointsChi[0].x} ${pointsChi[0].y} ` + pointsChi.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");

  return (
    <div className="flex flex-col gap-6">
      {/* ── Tab navigation ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("fund")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "fund"
              ? "bg-white text-rose-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Thống kê tổng hợp
        </button>
        <button
          onClick={() => setActiveTab("quota_setting")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "quota_setting"
              ? "bg-white text-rose-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Thiết lập định mức
        </button>
        <button
          onClick={() => setActiveTab("fee_collection")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "fee_collection"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> Thu quỹ định mức
        </button>
        <button
          onClick={() => setActiveTab("extra_contribution")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "extra_contribution"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" /> Đóng góp ngoài định mức
        </button>
        <button
          onClick={() => setActiveTab("income_report")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "income_report"
              ? "bg-white text-rose-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Báo cáo tiền thu
        </button>
        <button
          onClick={() => setActiveTab("expense_report")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "expense_report"
              ? "bg-white text-orange-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" /> Báo cáo tiền chi
        </button>
      </div>

      {/* ── Tab: Báo cáo tiền thu ── */}
      {activeTab === "income_report" && (
        <IncomeReportPage
          members={allMembers}
          transactions={transactions}
          annualQuota={annualQuota}
          currentAccount={currentAccount}
          onAddTransaction={onAddTransaction}
        />
      )}

      {/* ── Tab: Báo cáo tiền chi ── */}
      {activeTab === "expense_report" && (
        <ExpenseReportPage
          transactions={transactions}
          currentAccount={currentAccount}
          onAddTransaction={onAddTransaction}
        />
      )}

      {/* ── Tab: Thiết lập định mức ── */}
      {activeTab === "quota_setting" && (
        <QuotaSettingPage
          currentAccount={currentAccount}
          annualQuota={annualQuota}
          onUpdateQuota={onUpdateQuota}
        />
      )}

      {/* ── Tab: Thu quỹ định mức ── */}
      {activeTab === "fee_collection" && (
        <AnnualFeeCollectionPage
          members={allMembers}
          transactions={transactions}
          annualQuota={annualQuota}
          currentAccount={currentAccount}
          onAddTransaction={onAddTransaction}
        />
      )}

      {/* ── Tab: Đóng góp ngoài định mức ── */}
      {activeTab === "extra_contribution" && (
        <ExtraContributionPage
          members={allMembers}
          transactions={transactions}
          currentAccount={currentAccount}
          onAddTransaction={onAddTransaction}
        />
      )}

      {/* ── Tab: Sổ thu chi quỹ (toàn bộ nội dung gốc) ── */}
      {activeTab === "fund" && (<>
      {/* 3.1 CHỈ SỐ TÀI CHÍNH (METRICS SUMMARY CARDS) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Số dư hiện dụng */}
        <div id="finance-metric-balance" className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-[#10b981] font-bold uppercase">SỐ DƯ QUỸ HIỆN DỤNG</p>
              <h2 className="text-xl font-sans font-bold mt-1 text-emerald-400">{formatVND(stats.balance)}</h2>
            </div>
            <span className="p-2.5 bg-slate-800 rounded-xl text-[#10b981] border border-slate-700">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-4">
            Bảo chứng minh bạch tài chính gia tộc.
          </div>
        </div>

        {/* Tổng thu */}
        <div id="finance-metric-income" className="bg-white border rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-emerald-600 font-semibold uppercase">TỔNG SỐ TIỀN THU</p>
              <h2 className="text-xl font-sans font-bold mt-1 text-slate-900">{formatVND(stats.totalIncome)}</h2>
            </div>
            <span className="p-2.5 bg-emerald-50 rounded-xl text-emerald-700">
              <Plus className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-4">
            Bao gồm niên liễm + tài trợ vàng.
          </div>
        </div>

        {/* Tổng chi */}
        <div id="finance-metric-expense" className="bg-white border rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-mono tracking-wider text-red-600 font-semibold uppercase">TỔNG SỐ TIỀN CHI</p>
              <h2 className="text-xl font-sans font-bold mt-1 text-slate-900">{formatVND(stats.totalExpense)}</h2>
            </div>
            <span className="p-2.5 bg-red-50 rounded-xl text-red-700">
              <TrendingDown className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-4">
            Mục đích phụng thờ trùng tu mộ phần.
          </div>
        </div>

        {/* Định mức thu hằng năm */}
        <div id="finance-metric-quota" className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-mono tracking-wider text-rose-700 font-bold uppercase">NIÊN LIỄM CỐ ĐỊNH 2026</p>
                {isTreasurerOrLeader && (
                  <button onClick={() => setShowQuotaModal(true)} className="p-1 text-rose-700 hover:bg-rose-100 rounded">
                    <Settings className="w-3 h-3" />
                  </button>
                )}
              </div>
              <h2 className="text-xl font-sans font-bold mt-1 text-rose-955">{formatVND(annualQuota.amountPerMember)}</h2>
            </div>
            <span className="p-2.5 bg-rose-100 rounded-xl text-rose-700">
              <Percent className="w-5 h-5" />
            </span>
          </div>
          <div className="text-[10px] text-rose-600/90 font-sans mt-4">
            {annualQuota.description}
          </div>
        </div>
      </div>

      {/* 3.2 BIỂU ĐỒ BÁO CÁO DIỄN BIẾN SỐ TIỀN (CUSTOM ANALYTICS SVG CHART) */}
      <div className="bg-white border border-rose-105 rounded-2xl p-6 shadow-xs">
        <h3 className="font-sans font-semibold text-slate-900 text-xs uppercase tracking-wider mb-4">Biểu đồ đối soát ngân sách thu chi hằng tháng — Năm {new Date().getFullYear()} (đơn vị: vnđ)</h3>
        <div className="w-full overflow-x-auto">
          <svg className="w-[760px] h-[180px] overflow-visible">
            {/* Đường trục phụ trợ */}
            <line x1="40" y1="20" x2={40 + chartWidth} y2="20" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="80" x2={40 + chartWidth} y2="80" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="140" x2={40 + chartWidth} y2="140" stroke="#f1f5f9" strokeWidth="1.5" />

            {/* Chú giải trục Y — luôn bám theo dữ liệu thật (maxVal) */}
            <text x="5" y="25" fill="#94a3b8" className="text-[8px] font-mono">{fmtTr(maxVal)}</text>
            <text x="5" y="85" fill="#94a3b8" className="text-[8px] font-mono">{fmtTr(maxVal / 2)}</text>
            <text x="5" y="145" fill="#94a3b8" className="text-[8px] font-mono">0 VNĐ</text>

            {/* Các nhãn tháng trục X */}
            {chartData.map((d, i) => (
              <text key={i} x={40 + i * xStep} y="165" fill="#64748b" className="text-[9px] font-mono font-bold" textAnchor="middle">
                {d.month}
              </text>
            ))}

            {/* BIỂU ĐỒ THU (Line Thẫm Màu Xanh Ngọc) */}
            <path d={pathDThu} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
            {pointsThu.map((p, idx) => (
              <g key={`point-thu-${idx}`}>
                <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
                <text x={p.x} y={p.y - 8} fill="#059669" className="text-[8px] font-bold" textAnchor="middle">
                  {chartData[idx].thu > 0 ? fmtTr(chartData[idx].thu) : ""}
                </text>
              </g>
            ))}

            {/* BIỂU ĐỒ CHI (Line Huyết Trệt Màu Đỏ Đậm) */}
            <path d={pathDChi} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
            {pointsChi.map((p, idx) => (
              <g key={`point-chi-${idx}`}>
                <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
                <text x={p.x} y={p.y - 8} fill="#dc2626" className="text-[8px] font-bold" textAnchor="middle">
                  {chartData[idx].chi > 0 ? fmtTr(chartData[idx].chi) : ""}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="flex gap-4 items-center justify-center mt-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-700 font-bold">
            <span className="w-3 h-1.5 bg-emerald-500 rounded-full inline-block"></span> Mức Thu
          </span>
          <span className="flex items-center gap-1 text-red-600 font-bold">
            <span className="w-3 h-1.5 bg-red-400 rounded-full inline-block"></span> Chi Tiêu thực tế
          </span>
        </div>
      </div>

      {/* 3.3 SỔ QUYẾT TOÁN ĐÓNG GÓP (DETAILED ACCOUNTING JOURNAL TABLE) */}
      <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center pb-4 border-b border-rose-50 mb-4">
          <div>
            <h4 className="font-sans font-bold text-slate-900 text-xs uppercase tracking-wider">Sổ quyết toán ngân khố (Sổ thu chi)</h4>
            <p className="text-[10px] text-slate-500 font-sans mt-0.5">Nhật ký hiển thị toàn bộ phiếu thu và chi tương ứng của các thành viên gia tộc.</p>
          </div>

          <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
            <div className="relative w-full lg:w-52">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                id="ledger-search"
                type="text"
                placeholder="Tìm người đóng, nội dung..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-rose-500"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-205 rounded-lg p-1.5"
            >
              <option value="ALL">Mọi loại phiếu</option>
              <option value="INCOME">Phiếu Thu (+)</option>
              <option value="EXPENSE">Phiếu Chi (-)</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-205 rounded-lg p-1.5"
            >
              <option value="ALL">Mọi danh mục</option>
              <option value={FundCategory.ANNUAL_FEE}>Đóng định mức niên liễm</option>
              <option value={FundCategory.VOLUNTARY}>Thu quyên góp tự nguyện</option>
              <option value={FundCategory.SPONSORSHIP}>Thu tài trợ lớn</option>
              <option value={FundCategory.EVENT_ORGANIZATION}>Chi phí sự kiện</option>
              <option value={FundCategory.TEMPLE_REPAIR}>Chi xây dựng từ đường</option>
              <option value={FundCategory.CHARITY_STUDY}>Chi khuyến học/Mừng thọ</option>
            </select>



            {/* Nút xuất báo cáo CSV (R4.4, R4.7) */}
            <div className="flex gap-1">
              <button
                onClick={() => exportCSV("income")}
                title="Xuất báo cáo thu"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Thu
              </button>
              <button
                onClick={() => exportCSV("expense")}
                title="Xuất báo cáo chi"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Chi
              </button>
              <button
                onClick={() => exportCSV("all")}
                title="Xuất toàn bộ"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Tất cả
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-50 text-slate-400 font-bold tracking-wider">
                <th className="p-3">Mã phiếu</th>
                <th className="p-3">Phân loại</th>
                <th className="p-3">Danh mục kiểm toán</th>
                <th className="p-3 text-right">Số tiền sắm quả</th>
                <th className="p-3">Đối tượng dâng cúng / Thụ nhận</th>
                <th className="p-3">Nội dung chi tiết diễn giải</th>
                <th className="p-3">Ngày hạch toán</th>
                <th className="p-3">Ủy viên ban tài chính ghi sổ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50/50">
              {filteredTxs.length > 0 ? (
                filteredTxs.map(t => {
                  const isIncome = t.type === TransactionType.INCOME;
                  return (
                    <tr key={t.id} className="hover:bg-rose-50/20 text-slate-700">
                      <td className="p-3 font-mono text-[10px] text-slate-500 font-bold">{t.id}</td>
                      <td className="p-3">
                        {isIncome ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold text-[10px]">THU (+)</span>
                        ) : (
                          <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded font-bold text-[10px]">CHI (-)</span>
                        )}
                      </td>
                      <td className="p-3 font-medium">
                        {t.category === FundCategory.ANNUAL_FEE && "Niên liễm cố định"}
                        {t.category === FundCategory.VOLUNTARY && "Phát tâm quyên góp"}
                        {t.category === FundCategory.SPONSORSHIP && "Công đức/Tài trợ lớn"}
                        {t.category === FundCategory.EVENT_ORGANIZATION && "Hương hỏa/Tế lễ"}
                        {t.category === FundCategory.TEMPLE_REPAIR && "Sửa chữa từ đường"}
                        {t.category === FundCategory.CHARITY_STUDY && "Khuyến học học bổng"}
                        {t.category === FundCategory.OTHER && "Chi tiêu khác"}
                      </td>
                      <td className={`p-3 text-right font-bold font-mono text-sm ${isIncome ? "text-emerald-600" : "text-red-600"}`}>
                        {isIncome ? "+" : "-"}{formatVND(t.amount)}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{t.payerOrReceiver}</td>
                      <td className="p-3 text-slate-500 italic max-w-xs truncate" title={t.description}>{t.description}</td>
                      <td className="p-3 font-medium text-slate-600">{t.date}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <User className="w-3 h-3" /> {t.recordedBy}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-sans italic">
                    Không tìm thấy phiếu hạch toán ngân quỹ nào hợp lệ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3.4 MODAL THÊM PHIẾU THU/CHI QUỸ */}
      {showAddTxModal && (
        <div id="modal-finance-add-tx" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center pb-2 border-b mb-4">
              <h3 className="font-sans font-semibold text-slate-900 text-sm uppercase">Lập phiếu hạch toán hương hỏa quỹ</h3>
              <button onClick={() => setShowAddTxModal(false)} className="p-1 hover:bg-slate-100 rounded animate-pulse">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTxSubmit} className="flex flex-col gap-3 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Loại chứng từ</label>
                  <select
                    value={txForm.type}
                    onChange={(e) => {
                      const type = e.target.value as TransactionType;
                      setTxForm({ 
                        ...txForm, 
                        type, 
                        category: type === TransactionType.INCOME ? FundCategory.ANNUAL_FEE : FundCategory.EVENT_ORGANIZATION 
                      });
                    }}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                  >
                    <option value={TransactionType.INCOME}>Phiếu THU (+) nhập quỹ</option>
                    <option value={TransactionType.EXPENSE}>Phiếu CHI (-) xuất quỹ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Dành mục hạch toán</label>
                  <select
                    value={txForm.category}
                    onChange={(e) => setTxForm({ ...txForm, category: e.target.value as FundCategory })}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                  >
                    {txForm.type === TransactionType.INCOME ? (
                      <>
                        <option value={FundCategory.ANNUAL_FEE}>Đóng đóng định mức niên liễm</option>
                        <option value={FundCategory.VOLUNTARY}>Thu quyên góp tự nguyện phát tâm</option>
                        <option value={FundCategory.SPONSORSHIP}>Thu tài trợ phước lớn</option>
                      </>
                    ) : (
                      <>
                        <option value={FundCategory.EVENT_ORGANIZATION}>Chi sự kiện cúng giỗ cơm tế</option>
                        <option value={FundCategory.TEMPLE_REPAIR}>Chi xây dựng tu bổ từ đường</option>
                        <option value={FundCategory.CHARITY_STUDY}>Chi giải thưởng khuyến học tộc</option>
                        <option value={FundCategory.OTHER}>Quyên chi khác</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mức tiền (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    value={txForm.amount}
                    onChange={(e) => setTxForm({ ...txForm, amount: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 bg-slate-50 font-bold font-mono focus:outline-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Ngày lập phiếu</label>
                  <input
                    type="date"
                    required
                    value={txForm.date}
                    onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  {txForm.type === TransactionType.INCOME ? "Hộ gia tộc dâng cúng hương hỏa *" : "Đại diện nhận chi / Sắm sanh vật phẩm *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={txForm.type === TransactionType.INCOME ? "Nhập tên tộc viên dâng mâm quả" : "Tên bên thiết kế thầu sơn son..."}
                  value={txForm.payerOrReceiver}
                  onChange={(e) => setTxForm({ ...txForm, payerOrReceiver: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50 focus:outline-rose-500"
                />
              </div>

              {txForm.type === TransactionType.INCOME && (
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Liên kết đinh nam đóng (nếu có)</label>
                  <select
                    value={txForm.memberId}
                    onChange={(e) => {
                      const mId = e.target.value;
                      const mSelected = allMembers.find(m => m.id === mId);
                      setTxForm({ 
                        ...txForm, 
                        memberId: mId,
                        payerOrReceiver: mSelected ? `${mSelected.fullName}` : txForm.payerOrReceiver
                      });
                    }}
                    className="w-full border rounded-lg p-2 bg-slate-50"
                  >
                    <option value="">Khách tự nguyện / Vô danh công đức</option>
                    {allMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.fullName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-medium mb-1">Lý dơ chi tiết diễn giải phiếu quyết toán *</label>
                <textarea
                  required
                  placeholder="Ghi diễn giải chi tiết sắm quả thắp hương thần linh, báo công học bổng..."
                  value={txForm.description}
                  onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-50 h-20 resize-none focus:outline-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  id="btn-submit-finance-add"
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                >
                  Ghi chứng từ nhập quỹ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3.5 MODAL THIẾT LẬP ĐỊNH MỨC THU NIÊN LIỄM */}
      {showQuotaModal && (
        <div id="modal-finance-quota" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center pb-2 border-b mb-4">
              <h3 className="font-sans font-semibold text-slate-900 text-sm uppercase">Thiết lập niên liễm dòng họ</h3>
              <button onClick={() => setShowQuotaModal(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuotaSubmit} className="flex flex-col gap-3 text-xs font-sans">
              <p className="text-slate-500 leading-relaxed">
                Định mức niên liễm áp dụng thống nhất cho các đinh nam, dòng nam thâu niên liễm cố định hằng năm của <strong>Nguyễn Bá Tộc</strong> làm tài chính dự phòng hương hỏa đại hội.
              </p>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Mức liễm đóng của mỗi đinh (VNĐ) *</label>
                <input
                  type="number"
                  required
                  value={quotaForm.amountPerMember}
                  onChange={(e) => setQuotaForm({ ...quotaForm, amountPerMember: Number(e.target.value) })}
                  className="w-full border rounded-lg p-2.5 font-bold font-mono text-sm bg-slate-50 focus:outline-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Lời văn miêu tả điều kiện thu niên liễm</label>
                <textarea
                  value={quotaForm.description}
                  onChange={(e) => setQuotaForm({ ...quotaForm, description: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-slate-200 h-16 resize-none focus:outline-rose-500 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowQuotaModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  id="btn-submit-finance-quota"
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                >
                  Xác nhận lưu định mức
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}