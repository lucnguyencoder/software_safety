/**
 * pages/LandingPage.tsx
 * Trang chủ — hiển thị cho tất cả người dùng (kể cả chưa đăng nhập)
 */
import React, { useState } from "react";
import {
  ArrowRight, Trees, Shield, Wallet, Calendar, Users, BookOpen,
  Lock, MapPin, ChevronDown, ChevronUp, Star
} from "lucide-react";
import { useApp, CLAN_PROFILE } from "../context/AppContext";

// ── Dữ liệu tính năng ────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Trees,
    title: "Cây gia phả trực quan",
    desc: "Sơ đồ phả hệ nhiều thế hệ với giao diện tương tác rõ ràng, dễ tra cứu mối quan hệ huyết thống.",
  },
  {
    icon: Users,
    title: "Quản lý thành viên",
    desc: "Danh sách đầy đủ thông tin tộc viên, tìm kiếm nhanh theo tên, đời, trạng thái.",
  },
  {
    icon: Calendar,
    title: "Lịch giỗ chạp & sự kiện",
    desc: "Tự động tạo lịch giỗ theo âm lịch, thông báo họp mặt, tảo mộ và các hoạt động tập thể.",
  },
  {
    icon: Wallet,
    title: "Quản lý quỹ minh bạch",
    desc: "Ghi nhận thu chi, báo cáo tổng hợp, định mức niên liễm rõ ràng và công khai.",
  },
  {
    icon: Shield,
    title: "Phân quyền chặt chẽ",
    desc: "5 vai trò rõ ràng: Quản trị viên, Trưởng họ, Thủ quỹ, Tộc viên, Khách — mỗi vai chỉ thấy những gì cần thiết.",
  },
  {
    icon: BookOpen,
    title: "Tộc ước & hương ước",
    desc: "Lưu trữ quy ước dòng họ, thông tin tổ đường, nguồn gốc và lịch sử dòng tộc.",
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "Ai có thể tạo tài khoản trên hệ thống?",
    a: "Bất kỳ tộc viên nào đều có thể đăng ký. Sau khi đăng ký, tài khoản sẽ được Trưởng họ hoặc Quản trị viên xét duyệt để đảm bảo tính chính xác của thông tin dòng tộc.",
  },
  {
    q: "Dữ liệu gia phả có được bảo mật không?",
    a: "Có. Toàn bộ thông tin được mã hóa và lưu trữ an toàn. Chỉ thành viên đã được xác thực mới có quyền truy cập. Dữ liệu không bao giờ được chia sẻ với bên thứ ba.",
  },
  {
    q: "Tôi có thể xem gia phả trên điện thoại không?",
    a: "Có. Giao diện được tối ưu cho cả máy tính và điện thoại, giúp bạn tra cứu gia phả mọi lúc, mọi nơi.",
  },
  {
    q: "Làm thế nào để thêm thành viên mới vào gia phả?",
    a: "Trưởng họ hoặc Quản trị viên có thể thêm trực tiếp. Tộc viên cũng có thể đề xuất bổ sung thành viên, chờ phê duyệt.",
  },
];

// ── Component FAQ Item ────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-stone-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-stone-50 transition-colors cursor-pointer"
      >
        <span className="text-sm font-semibold text-stone-800">{q}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-stone-500 leading-relaxed bg-stone-50/60 border-t border-stone-100">
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Component chính ───────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isLoggedIn, setActiveTab, setShowLoginModal, setShowRegisterModal } = useApp();

  return (
    <div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO: Tiêu đề & Slogan
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center py-8 md:py-14">

        {/* Cột trái */}
        <div className="lg:col-span-6 flex flex-col items-start text-left">

          {/* Badge nhận diện */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100/80 text-[11px] font-semibold text-stone-600 border border-stone-200/50 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[#8c4f2b] inline-block animate-pulse" />
            Hệ thống quản lý gia phả số
          </div>

          {/* ── Tiêu đề chính (H1) ── */}
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-stone-900 leading-[1.12] tracking-tight mt-5 font-semibold">
            Gìn giữ{" "}
            <span className="italic font-normal text-[#8c4f2b]">Lịch sử</span>
            <br />
            Nối dài{" "}
            <span className="italic font-normal text-[#8c4f2b]">Cội nguồn</span>
          </h1>

          {/* ── Slogan / tagline ── */}
          <p className="mt-3 text-base md:text-lg font-serif italic text-[#8c4f2b] font-medium">
            "Uống nước nhớ nguồn — Số hóa để trường tồn"
          </p>

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 2 — THÔNG ĐIỆP / SỨ MỆNH
          ══════════════════════════════════════════════════════════════════ */}
          <p className="text-stone-500 leading-relaxed text-sm md:text-base max-w-lg mt-5">
            Mỗi dòng họ là một mạch nguồn văn hóa không thể đứt gãy. Nền tảng{" "}
            <strong className="text-stone-700">Mộc Bản</strong> ra đời
            để gìn giữ ký ức tổ tiên, kết nối con cháu muôn phương, và truyền lại
            di sản huyết thống cho các thế hệ mai sau — bởi{" "}
            <span className="text-stone-700 font-medium">
              "cây có gốc mới nở cành xanh ngọn, nước có nguồn mới bể rộng sông sâu."
            </span>
          </p>

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 5 — CTA BUTTONS (Call to Action)
          ══════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full sm:w-auto">
            {isLoggedIn ? (
              <button
                onClick={() => setActiveTab("giamap")}
                className="w-full sm:w-auto justify-center bg-[#8c4f2b] hover:bg-[#723e20] text-white px-8 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer"
              >
                Xem cây gia phả <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="w-full sm:w-auto justify-center bg-[#8c4f2b] hover:bg-[#723e20] text-white px-8 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer"
                >
                  Tìm hiểu ngay <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#features"
                  className="w-full sm:w-auto justify-center border border-[#8c4f2b]/30 hover:bg-[#8c4f2b]/5 text-[#8c4f2b] px-8 py-3.5 rounded-xl text-sm font-semibold transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  Giới thiệu chung <ChevronDown className="w-4 h-4" />
                </a>
              </>
            )}
          </div>

          {/* Trust bar */}
          <div className="flex items-center gap-4 mt-10 pt-6 border-t border-stone-200/60 w-full sm:w-auto">
            <div className="flex -space-x-3">
              {[
                "photo-1534528741775-53994a69daeb",
                "photo-1507003211169-0a1dd7228f2d",
                "photo-1494790108377-be9c29b29330",
                "photo-1472099645785-5658abf4ff4e",
              ].map((id) => (
                <img
                  key={id}
                  className="w-9 h-9 rounded-full ring-2 ring-white object-cover"
                  src={`https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=100`}
                  referrerPolicy="no-referrer"
                  alt=""
                />
              ))}
            </div>
            <p className="text-xs text-stone-500 font-semibold">
              <span className="text-[#8c4f2b] font-bold">500+</span> dòng họ đã số hóa
            </p>
          </div>
        </div>

        {/* Cột phải — ảnh hero */}
        <div className="lg:col-span-6 relative flex justify-center py-4 lg:py-0">
          <div className="absolute top-4 -left-4 md:-left-8 bg-white text-stone-800 p-4 rounded-2xl shadow-xl border border-stone-100 flex items-center gap-3 z-10 max-w-[220px]">
            <span className="font-serif text-3xl font-extrabold text-[#5c3e35] leading-none">
              100+
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 leading-tight">
              ĐỒNG HÀNH CÙNG <br />
              <span className="text-stone-800 text-xs italic font-serif font-normal">
                Thế hệ mai sau
              </span>
            </span>
          </div>
          <div className="w-full max-w-sm md:max-w-md h-[460px] rounded-[2.25rem] overflow-hidden shadow-2xl relative border border-stone-200/50">
            <img
              src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800"
              alt="Gia phả"
              className="w-full h-full object-cover brightness-75"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-4 left-4 right-4 bg-stone-900/85 backdrop-blur-md border border-white/10 p-5 rounded-3xl">
              <p className="font-serif italic text-stone-200 text-sm leading-relaxed">
                &ldquo;Cây có gốc mới nở cành xanh ngọn, nước có nguồn mới bể rộng sông sâu.&rdquo;
              </p>
              <p className="text-stone-400 text-xs mt-2 text-right font-medium">
                Gia huấn cố nhân
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — TÍNH NĂNG NỔI BẬT
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-16">
        {/* Heading */}
        <div className="text-center mb-12">
          <span className="inline-block text-[11px] uppercase tracking-widest font-bold text-[#8c4f2b] bg-[#8c4f2b]/8 px-3 py-1 rounded-full mb-3">
            Tính năng
          </span>
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-stone-900">
            Lưu truyền giá trị - Kết nối gia đình
          </h2>
          <p className="text-stone-500 text-sm mt-3 max-w-xl mx-auto leading-relaxed">
            Một nền tảng toàn diện để lưu trữ, kết nối và lan tỏa di sản dòng tộc
            đến tận từng thành viên, bất kể khoảng cách địa lý.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group bg-white border border-stone-100 rounded-2xl p-6 hover:shadow-lg hover:border-[#8c4f2b]/20 transition-all duration-200"
            >
              <div className="w-11 h-11 rounded-xl bg-[#8c4f2b]/10 flex items-center justify-center mb-4 group-hover:bg-[#8c4f2b]/15 transition-colors">
                <Icon className="w-5 h-5 text-[#8c4f2b]" />
              </div>
              <h3 className="font-semibold text-stone-900 text-sm mb-2">{title}</h3>
              <p className="text-stone-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — CAM KẾT BẢO MẬT
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="my-4 mb-16">
        <div className="bg-gradient-to-br from-stone-900 to-[#3b1f10] rounded-3xl px-8 py-10 md:py-14 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            {/* Icon bảo mật lớn */}
            <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
              <Lock className="w-9 h-9 text-white" />
            </div>

            {/* Nội dung */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="font-serif text-2xl md:text-3xl font-semibold text-white leading-snug">
                Dữ liệu gia đình bạn — riêng tư & an toàn tuyệt đối
              </h2>
              <p className="text-stone-300 text-sm leading-relaxed mt-3 max-w-2xl">
                Thông tin huyết thống, tài chính dòng họ và hồ sơ cá nhân của từng tộc viên
                đều được mã hóa và bảo vệ nghiêm ngặt. Chúng tôi cam kết{" "}
                <strong className="text-white">không bao giờ chia sẻ dữ liệu</strong> với
                bất kỳ bên thứ ba nào. Chỉ những thành viên được xác thực mới có quyền
                truy cập — đúng người, đúng quyền hạn.
              </p>

              {/* Các điểm cam kết */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                {[
                  { icon: Shield, text: "Mã hóa đầu cuối" },
                  { icon: Users, text: "Phân quyền 5 cấp" },
                  { icon: Lock, text: "Không chia sẻ bên thứ ba" },
                ].map(({ icon: Ico, text }) => (
                  <div
                    key={text}
                    className="flex items-center gap-2.5 bg-white/10 rounded-xl px-4 py-3 border border-white/10"
                  >
                    <Ico className="w-4 h-4 text-stone-300 flex-shrink-0" />
                    <span className="text-stone-200 text-xs font-medium">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          BONUS — TESTIMONIAL / ĐÁNH GIÁ (tăng độ tin cậy)
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-10 mb-10">
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold text-stone-900">
            Các dòng họ nói gì về chúng tôi?
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              name: "Trưởng họ Nguyễn Văn Minh",
              clan: "Dòng họ Nguyễn, Hà Nam",
              quote: "Trước đây sổ gia phả bị ẩm mốc, nhiều tên tuổi thất lạc. Kể từ khi dùng hệ thống, mọi thứ được lưu trữ ngăn nắp, con cháu ở xa cũng tra cứu được.",
            },
            {
              name: "Thủ quỹ Lê Thị Hương",
              clan: "Dòng họ Lê, Thanh Hóa",
              quote: "Quản lý quỹ dòng họ chưa bao giờ dễ dàng đến vậy. Mọi khoản thu chi đều minh bạch, tộc viên đóng niên liễm đúng hạn hơn hẳn.",
            },
            {
              name: "Tộc viên Phạm Đức Long",
              clan: "Dòng họ Phạm, Nghệ An",
              quote: "Tôi công tác xa nhà nhưng vẫn biết lịch giỗ, tảo mộ nhờ thông báo từ ứng dụng. Cảm giác gắn kết với quê hương và dòng tộc rõ hơn nhiều.",
            },
          ].map(({ name, clan, quote }) => (
            <div
              key={name}
              className="bg-white border border-stone-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-stone-600 text-sm leading-relaxed italic mb-4">
                &ldquo;{quote}&rdquo;
              </p>
              <div>
                <p className="text-stone-900 text-xs font-bold">{name}</p>
                <p className="text-stone-400 text-[11px] mt-0.5">{clan}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          BONUS — FAQ
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-10 mb-10">
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold text-stone-900">
            Câu hỏi thường gặp
          </h2>
        </div>
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5 (lặp lại) — CTA CUỐI TRANG
      ══════════════════════════════════════════════════════════════════════ */}
      {!isLoggedIn && (
        <section className="mb-16">
          <div className="bg-[#fdf6ee] border border-[#8c4f2b]/15 rounded-3xl px-8 py-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#8c4f2b]/10 mb-5">
              <MapPin className="w-6 h-6 text-[#8c4f2b]" />
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-semibold text-stone-900">
              Sẵn sàng lưu giữ ký ức dòng tộc?
            </h2>
            <p className="text-stone-500 text-sm mt-3 max-w-lg mx-auto leading-relaxed">
              Đăng ký miễn phí ngay hôm nay. Chỉ mất vài phút để bắt đầu hành trình
              số hóa gia phả và kết nối toàn bộ tộc viên.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <button
                onClick={() => setShowRegisterModal(true)}
                className="bg-[#8c4f2b] hover:bg-[#723e20] text-white px-10 py-3.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer"
              >
                Tạo lập gia phả mới <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowLoginModal(true)}
                className="border border-stone-200 hover:bg-white text-stone-700 px-10 py-3.5 rounded-xl text-sm font-semibold transition-all cursor-pointer bg-stone-50"
              >
                Đăng nhập tài khoản
              </button>
            </div>
            <p className="text-stone-400 text-xs mt-5">
              <Lock className="w-3 h-3 inline mr-1" />
              Thông tin của bạn được bảo mật tuyệt đối — không spam, không quảng cáo.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}