/**
 * EventMediaModal.tsx
 * Tư liệu / Hình ảnh sự kiện — lưu trữ tài liệu sau sự kiện.
 * Workflow: chọn nhiều tệp → kiểm tra định dạng/dung lượng (S-1) → nén ảnh phía client →
 *           tải lên kèm progress bar từng tệp → làm mới danh sách → lọc/sắp xếp/đổi chế độ xem.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  X, Upload, Image as ImageIcon, Film, FileText, Trash2, Download,
  Grid3x3, List as ListIcon, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";
import { ClanEvent, MediaFileType } from "../types";
import { eventMediaApi, getMediaUrl } from "../services/api";

interface EventMediaModalProps {
  event: ClanEvent;
  canManage: boolean; // Trưởng họ / Admin — được tải lên & xóa tư liệu
  onClose: () => void;
}

interface UploadItem {
  id: string;
  file: File;
  fileType: MediaFileType;
  progress: number;
  status: "pending" | "compressing" | "uploading" | "done" | "error";
  error?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB / tệp (S-1)
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const VIDEO_EXT = [".mp4", ".webm", ".mov", ".mkv"];
const DOC_EXT = [".pdf", ".doc", ".docx"];
const ACCEPT_ATTR = [...IMAGE_EXT, ...VIDEO_EXT, ...DOC_EXT].join(",");

const detectFileType = (file: File): MediaFileType | null => {
  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  if (file.type.startsWith("image/") || IMAGE_EXT.includes(ext)) return MediaFileType.IMAGE;
  if (file.type.startsWith("video/") || VIDEO_EXT.includes(ext)) return MediaFileType.VIDEO;
  if (file.type === "application/pdf" || file.type.includes("word") || DOC_EXT.includes(ext)) return MediaFileType.DOCUMENT;
  return null;
};

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// S-1 (nén tệp đối với hình ảnh): resize ảnh tối đa 1920px cạnh dài + re-encode JPEG ~78% chất
// lượng, thực hiện ngay trên trình duyệt trước khi tải lên để giảm dung lượng & băng thông.
// Bỏ qua GIF để không phá hoạt ảnh; nếu nén ra lớn hơn bản gốc thì giữ nguyên bản gốc.
const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (file.type === "image/gif") return resolve(file);
    const reader = new FileReader();
    reader.onerror = () => resolve(file); // đọc file thất bại → dùng bản gốc
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== "string") return resolve(file); // null/undefined → dùng bản gốc
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1920;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob || blob.size >= file.size) return resolve(file);
          const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
          resolve(new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() }));
        }, "image/jpeg", 0.78);
      };
      img.onerror = () => resolve(file);
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
};

const FILE_TYPE_META: Record<MediaFileType, { label: string; icon: React.ElementType; color: string }> = {
  [MediaFileType.IMAGE]: { label: "Hình ảnh", icon: ImageIcon, color: "text-blue-600 bg-blue-50" },
  [MediaFileType.VIDEO]: { label: "Video", icon: Film, color: "text-purple-600 bg-purple-50" },
  [MediaFileType.DOCUMENT]: { label: "Tài liệu", icon: FileText, color: "text-amber-600 bg-amber-50" },
};

export default function EventMediaModal({ event, canManage, onClose }: EventMediaModalProps) {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [rejectedMsgs, setRejectedMsgs] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | MediaFileType>("ALL");
  const [sortOrder, setSortOrder] = useState<"NEWEST" | "OLDEST">("NEWEST");
  const [viewMode, setViewMode] = useState<"GRID" | "LIST">("GRID");
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const data = await eventMediaApi.list(event.id);
      if (mountedRef.current) setMedia(data);
    } catch {
      // Giữ danh sách cũ nếu tải thất bại, không chặn UI
    }
    if (mountedRef.current) setLoading(false);
  };

  useEffect(() => { loadMedia(); }, [event.id]);

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    if (!mountedRef.current) return;
    setUploadQueue(q => q.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  // ── Step 3-7: nhận tệp (từ File Picker hoặc kéo-thả) → kiểm tra → nén → tải lên ──
  const handleFilesSelected = async (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const queue: UploadItem[] = [];
    const rejected: string[] = [];

    files.forEach(file => {
      const fileType = detectFileType(file);
      if (!fileType) { rejected.push(`"${file.name}": định dạng không được hỗ trợ.`); return; }
      if (file.size > MAX_FILE_SIZE) { rejected.push(`"${file.name}": vượt quá ${formatBytes(MAX_FILE_SIZE)} cho phép.`); return; }
      queue.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, file, fileType, progress: 0, status: "pending" });
    });

    setRejectedMsgs(rejected);
    setSuccessMsg("");
    if (queue.length === 0) return;

    setUploadQueue(queue);
    setIsUploading(true);

    for (const item of queue) {
      try {
        let fileToSend = item.file;
        if (item.fileType === MediaFileType.IMAGE) {
          updateItem(item.id, { status: "compressing" });
          fileToSend = await compressImage(item.file);
        }
        updateItem(item.id, { status: "uploading" });
        await eventMediaApi.upload(event.id, [fileToSend], (pct) => updateItem(item.id, { progress: pct }));
        updateItem(item.id, { status: "done", progress: 100 });
      } catch (e: any) {
        updateItem(item.id, { status: "error", error: e?.message || "Tải lên thất bại." });
      }
    }

    if (!mountedRef.current) return;
    setIsUploading(false);
    await loadMedia();
    setSuccessMsg("✅ Tải tư liệu thành công!");
    window.setTimeout(() => { if (mountedRef.current) setUploadQueue([]); }, 3000);
  };

  const handleDelete = async (mediaId: string, name: string) => {
    if (!window.confirm(`Xóa tư liệu "${name}"? Hành động này không thể hoàn tác.`)) return;
    setDeletingId(mediaId);
    try {
      await eventMediaApi.remove(event.id, mediaId);
      setMedia(m => m.filter(x => x.id !== mediaId));
    } catch (e: any) {
      alert(e?.message || "Xóa tư liệu thất bại.");
    }
    setDeletingId(null);
  };

  // ── Step 9: lọc nhanh + sắp xếp + đổi chế độ xem ──────────────────────────
  const counts = {
    ALL: media.length,
    [MediaFileType.IMAGE]: media.filter(m => m.fileType === MediaFileType.IMAGE).length,
    [MediaFileType.VIDEO]: media.filter(m => m.fileType === MediaFileType.VIDEO).length,
    [MediaFileType.DOCUMENT]: media.filter(m => m.fileType === MediaFileType.DOCUMENT).length,
  };
  const visibleMedia = media
    .filter(m => filterType === "ALL" || m.fileType === filterType)
    .sort((a, b) => sortOrder === "NEWEST"
      ? String(b.uploadedAt).localeCompare(String(a.uploadedAt))
      : String(a.uploadedAt).localeCompare(String(b.uploadedAt)));

  const filterTabs: { key: "ALL" | MediaFileType; label: string }[] = [
    { key: "ALL", label: "Tất cả" },
    { key: MediaFileType.IMAGE, label: "Hình ảnh" },
    { key: MediaFileType.VIDEO, label: "Video" },
    { key: MediaFileType.DOCUMENT, label: "Tài liệu" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div>
            <h3 className="font-serif font-bold text-stone-800 text-base">Tư liệu / Hình ảnh</h3>
            <p className="text-xs text-stone-500 mt-0.5 truncate max-w-md">{event.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* ── Step 2-3: khu vực tải lên (chỉ Trưởng họ/Admin) ── */}
          {canManage && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFilesSelected(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                isDragOver ? "border-[#8c4f2b] bg-[#8c4f2b]/5" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
              }`}
            >
              <input ref={fileInputRef} type="file" multiple accept={ACCEPT_ATTR} className="hidden"
                onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ""; }} />
              <Upload className="w-7 h-7 text-stone-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-stone-700">Tải lên tư liệu</p>
              <p className="text-[11px] text-stone-400 mt-1">Kéo-thả hoặc bấm để chọn nhiều tệp · Hình ảnh, Video, PDF, Word · Tối đa {formatBytes(MAX_FILE_SIZE)}/tệp</p>
            </div>
          )}

          {/* Cảnh báo tệp bị từ chối (S-1) */}
          {rejectedMsgs.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
              {rejectedMsgs.map((m, i) => (
                <p key={i} className="text-[11px] text-red-700 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {m}
                </p>
              ))}
            </div>
          )}

          {/* Hàng đợi tải lên + progress bar từng tệp (Step 6) */}
          {uploadQueue.length > 0 && (
            <div className="space-y-2">
              {uploadQueue.map(item => {
                const meta = FILE_TYPE_META[item.fileType];
                const Icon = meta.icon;
                return (
                  <div key={item.id} className="border border-stone-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`p-1 rounded-lg ${meta.color}`}><Icon className="w-3.5 h-3.5" /></span>
                      <span className="text-xs font-medium text-stone-700 truncate flex-1">{item.file.name}</span>
                      <span className="text-[10px] text-stone-400 flex-shrink-0">{formatBytes(item.file.size)}</span>
                      {item.status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                      {item.status === "error" && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      {(item.status === "compressing" || item.status === "uploading") && <Loader2 className="w-3.5 h-3.5 text-stone-400 animate-spin flex-shrink-0" />}
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-200 ${item.status === "error" ? "bg-red-400" : "bg-[#8c4f2b]"}`}
                        style={{ width: `${item.status === "compressing" ? 8 : item.progress}%` }} />
                    </div>
                    <p className="text-[10px] mt-1 text-stone-400">
                      {item.status === "pending" && "Đang chờ..."}
                      {item.status === "compressing" && "Đang nén ảnh..."}
                      {item.status === "uploading" && `Đang tải lên... ${item.progress}%`}
                      {item.status === "done" && "Hoàn tất"}
                      {item.status === "error" && <span className="text-red-500">{item.error}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl px-4 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {successMsg}
            </div>
          )}

          {/* ── Step 9: bộ lọc / sắp xếp / chế độ xem ── */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-stone-100">
            <div className="flex items-center gap-1 bg-stone-50 rounded-lg p-1 mt-3">
              {filterTabs.map(t => (
                <button key={t.key} onClick={() => setFilterType(t.key)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                    filterType === t.key ? "bg-white text-[#8c4f2b] shadow-sm" : "text-stone-500 hover:text-stone-700"
                  }`}>
                  {t.label} <span className="text-stone-400">({counts[t.key]})</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value as "NEWEST" | "OLDEST")}
                className="text-[11px] font-semibold bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none">
                <option value="NEWEST">Mới nhất</option>
                <option value="OLDEST">Cũ nhất</option>
              </select>
              <div className="flex items-center gap-1 bg-stone-50 rounded-lg p-1">
                <button onClick={() => setViewMode("GRID")} title="Dạng lưới"
                  className={`p-1.5 rounded-md cursor-pointer ${viewMode === "GRID" ? "bg-white shadow-sm text-[#8c4f2b]" : "text-stone-400 hover:text-stone-600"}`}>
                  <Grid3x3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setViewMode("LIST")} title="Dạng danh sách"
                  className={`p-1.5 rounded-md cursor-pointer ${viewMode === "LIST" ? "bg-white shadow-sm text-[#8c4f2b]" : "text-stone-400 hover:text-stone-600"}`}>
                  <ListIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Danh sách tư liệu ── */}
          {loading ? (
            <p className="text-xs text-stone-400 text-center py-10">Đang tải tư liệu...</p>
          ) : visibleMedia.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Chưa có tư liệu nào{filterType !== "ALL" ? " thuộc bộ lọc này" : ""}.</p>
            </div>
          ) : viewMode === "GRID" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {visibleMedia.map(m => {
                const meta = FILE_TYPE_META[m.fileType as MediaFileType] || FILE_TYPE_META[MediaFileType.DOCUMENT];
                const Icon = meta.icon;
                const url = getMediaUrl(m.fileUrl);
                return (
                  <div key={m.id} className="group relative border border-stone-100 rounded-xl overflow-hidden bg-stone-50">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square flex items-center justify-center bg-stone-100">
                      {m.fileType === MediaFileType.IMAGE ? (
                        <img src={url} alt={m.originalName} className="w-full h-full object-cover" />
                      ) : m.fileType === MediaFileType.VIDEO ? (
                        <video src={url} className="w-full h-full object-cover" muted />
                      ) : (
                        <Icon className="w-10 h-10 text-amber-400" />
                      )}
                    </a>
                    {canManage && (
                      <button onClick={() => handleDelete(m.id, m.originalName)} disabled={deletingId === m.id}
                        className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 hover:bg-red-50 text-red-500 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="p-2">
                      <p className="text-[10px] font-semibold text-stone-700 truncate" title={m.originalName}>{m.originalName}</p>
                      <p className="text-[9px] text-stone-400">{formatBytes(m.fileSize)} · {m.uploadedBy || "—"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {visibleMedia.map(m => {
                const meta = FILE_TYPE_META[m.fileType as MediaFileType] || FILE_TYPE_META[MediaFileType.DOCUMENT];
                const Icon = meta.icon;
                const url = getMediaUrl(m.fileUrl);
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2.5">
                    <span className={`p-2 rounded-lg flex-shrink-0 ${meta.color}`}><Icon className="w-4 h-4" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-700 truncate">{m.originalName}</p>
                      <p className="text-[10px] text-stone-400">
                        {meta.label} · {formatBytes(m.fileSize)} · {m.uploadedBy || "—"} · {m.uploadedAt ? new Date(m.uploadedAt).toLocaleString("vi-VN") : ""}
                      </p>
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" title="Mở / Tải xuống"
                      className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 cursor-pointer flex-shrink-0"><Download className="w-3.5 h-3.5" /></a>
                    {canManage && (
                      <button onClick={() => handleDelete(m.id, m.originalName)} disabled={deletingId === m.id}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 cursor-pointer flex-shrink-0 disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}