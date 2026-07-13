import { useState } from "react";
import api from "../services/api";
import { X, Send, Loader } from "lucide-react";

const ShareModal = ({ post, onClose, onShareSuccess }) => {
    const [shareText, setShareText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Gửi yêu cầu chia sẻ bài đăng
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await api.post(`/posts/${post.id}/share`, {
                content: shareText.trim()
            });

            if (res.data && res.data.success) {
                // Kích hoạt callback thông báo thành công
                if (onShareSuccess) {
                    onShareSuccess(res.data.data);
                }
                onClose();
            }
        } catch (error) {
            console.error("❌ Lỗi chia sẻ bài viết:", error.message);
            alert(error.response?.data?.message || "Lỗi khi chia sẻ bài đăng!");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
            {/* Hộp thoại chính */}
            <div className="bg-slate-900 border border-white/10 w-full max-w-lg p-6 rounded-2xl shadow-2xl space-y-4 relative">
                {/* Header modal */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-lg font-bold text-white">Chia sẻ bài viết</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white cursor-pointer transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form nhập lời dẫn */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-slate-400 text-xs mb-2">Lời dẫn của bạn (Không bắt buộc)</label>
                        <textarea
                            value={shareText}
                            onChange={(e) => setShareText(e.target.value)}
                            placeholder="Nói gì đó về bài viết này..."
                            rows="3"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 transition resize-none"
                        />
                    </div>

                    {/* Preview Bài đăng gốc được nhúng */}
                    <div className="border border-white/10 rounded-xl p-4 bg-slate-950/40 text-xs space-y-2 pointer-events-none">
                        <div className="flex items-center space-x-2">
                            <img
                                src={post.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                className="w-6 h-6 rounded-full"
                                alt="Author Avatar"
                            />
                            <span className="font-semibold text-white">{post.author?.displayName}</span>
                        </div>
                        <p className="text-slate-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                    </div>

                    {/* Nút gửi */}
                    <div className="flex items-center justify-end space-x-3 pt-2 border-t border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-slate-300 transition cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-violet-500 to-pink-500 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                            {isSubmitting ? (
                                <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>Chia sẻ ngay</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShareModal;
