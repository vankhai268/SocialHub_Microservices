import { useState, useEffect } from "react";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { X, Send, Loader, MessageSquare, Search, Check } from "lucide-react";

const ShareModal = ({ post, onClose, onShareSuccess }) => {
    const { chatSocket } = useSocket();
    const [activeTab, setActiveTab] = useState("feed"); // "feed" | "chat"
    const [shareText, setShareText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Trạng thái cho tab Chat
    const [conversations, setConversations] = useState([]);
    const [isLoadingConvs, setIsLoadingConvs] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sentConvs, setSentConvs] = useState({}); // { convId: true }

    // Load danh sách cuộc hội thoại khi mở tab Chat
    useEffect(() => {
        if (activeTab === "chat" && conversations.length === 0) {
            const fetchConversations = async () => {
                setIsLoadingConvs(true);
                try {
                    const res = await api.get("/conversations");
                    if (res.data && res.data.success) {
                        setConversations(res.data.data || []);
                    }
                } catch (err) {
                    console.error("❌ Lỗi lấy danh sách hội thoại để share:", err.message);
                } finally {
                    setIsLoadingConvs(false);
                }
            };
            fetchConversations();
        }
    }, [activeTab, conversations.length]);

    // Xử lý chia sẻ lên Feed
    const handleShareToFeed = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await api.post(`/posts/${post.id}/share`, {
                content: shareText.trim()
            });

            if (res.data && res.data.success) {
                if (onShareSuccess) {
                    onShareSuccess(res.data.data);
                }
                alert("Đã chia sẻ lên bảng tin thành công!");
                onClose();
            }
        } catch (error) {
            console.error("❌ Lỗi chia sẻ bài viết:", error.message);
            alert(error.response?.data?.message || "Lỗi khi chia sẻ bài đăng!");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Gửi link bài viết vào cuộc trò chuyện chat qua WebSocket
    const handleSendToChat = (convId) => {
        if (!chatSocket || !chatSocket.connected) {
            alert("Lỗi kết nối máy chủ tin nhắn. Vui lòng thử lại!");
            return;
        }

        const shareData = {
            postId: post.id || post._id,
            postContent: post.content || "",
            authorName: post.author?.displayName || "Người dùng SocialHub",
            authorAvatar: post.author?.avatarUrl || null,
            shareText: shareText.trim(),
            mediaId: post.media_ids && post.media_ids.length > 0 ? post.media_ids[0] : null
        };

        // Gửi qua WebSocket với type: "share"
        chatSocket.emit("message:send", {
            conversationId: convId,
            content: JSON.stringify(shareData),
            type: "share"
        });

        // Đánh dấu đã gửi
        setSentConvs(prev => ({ ...prev, [convId]: true }));
    };

    // Helper trích xuất thông tin đối phương từ conversation
    const getConvInfo = (conv) => {
        const isGroup = conv.type === "group";
        const cId = conv._id || conv.id;
        
        // Lấy thông tin thành viên đối phương cho chat đơn
        const other = conv.participants?.[0] || {
            displayName: "Người dùng SocialHub",
            avatarUrl: null
        };

        const title = isGroup ? conv.groupRef?.name || "Cuộc trò chuyện nhóm" : other.displayName;
        const avatar = isGroup
            ? conv.groupRef?.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${cId}`
            : other.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${other.userId || cId}`;

        return { title, avatar, isGroup };
    };

    // Lọc danh sách hội thoại theo thanh tìm kiếm
    const filteredConvs = conversations.filter(conv => {
        const { title } = getConvInfo(conv);
        return title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-slate-900 border border-white/10 w-full max-w-lg p-6 rounded-2xl shadow-2xl space-y-4 relative">
                {/* Header modal */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Chia sẻ bài viết</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white cursor-pointer transition">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Thanh chọn Tab */}
                <div className="flex bg-slate-950/60 p-1 rounded-xl border border-white/5">
                    <button
                        type="button"
                        onClick={() => setActiveTab("feed")}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer text-center ${
                            activeTab === "feed"
                                ? "bg-violet-600 text-white shadow-lg font-bold"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        Chia sẻ lên Bảng tin
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("chat")}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer text-center ${
                            activeTab === "chat"
                                ? "bg-violet-600 text-white shadow-lg font-bold"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        Gửi qua Tin nhắn
                    </button>
                </div>

                {/* Phần viết lời dẫn chung */}
                <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2">
                        Lời dẫn đi kèm (Không bắt buộc)
                    </label>
                    <textarea
                        value={shareText}
                        onChange={(e) => setShareText(e.target.value)}
                        placeholder="Nói gì đó về bài viết này..."
                        rows="2"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-violet-500 transition resize-none"
                    />
                </div>

                {/* Nội dung Tab Bảng tin */}
                {activeTab === "feed" && (
                    <form onSubmit={handleShareToFeed} className="space-y-4">
                        {/* Preview Bài đăng gốc */}
                        <div className="border border-white/10 rounded-xl p-4 bg-slate-950/40 text-xs space-y-2 pointer-events-none">
                            <div className="flex items-center space-x-2">
                                <img
                                    src={post.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                    className="w-6 h-6 rounded-full object-cover border border-white/10"
                                    alt="Author Avatar"
                                />
                                <span className="font-semibold text-white">{post.author?.displayName}</span>
                            </div>
                            <p className="text-slate-350 line-clamp-3 leading-relaxed whitespace-pre-wrap">{post.content}</p>
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
                                className="flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-violet-500 to-pink-500 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-violet-500/20"
                            >
                                {isSubmitting ? (
                                    <Loader className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Đăng ngay</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* Nội dung Tab Tin nhắn */}
                {activeTab === "chat" && (
                    <div className="space-y-3.5">
                        {/* Thanh tìm kiếm hội thoại */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm kiếm cuộc trò chuyện..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                            />
                        </div>

                        {/* Danh sách hội thoại */}
                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                            {isLoadingConvs ? (
                                <div className="flex justify-center items-center py-8">
                                    <Loader className="w-6 h-6 text-violet-500 animate-spin" />
                                </div>
                            ) : filteredConvs.length > 0 ? (
                                filteredConvs.map((conv) => {
                                    const cId = conv._id || conv.id;
                                    const { title, avatar } = getConvInfo(conv);
                                    const isSent = sentConvs[cId] === true;

                                    return (
                                        <div key={cId} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl transition">
                                            <div className="flex items-center space-x-2.5 min-w-0">
                                                <img
                                                    src={avatar}
                                                    className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                                                    alt="Conv Avatar"
                                                />
                                                <span className="text-xs font-semibold text-slate-200 truncate">{title}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleSendToChat(cId)}
                                                disabled={isSent}
                                                className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                                    isSent
                                                        ? "bg-emerald-650/20 text-emerald-400 border border-emerald-500/30 cursor-default"
                                                        : "bg-violet-600 hover:bg-violet-750 text-white shadow-md shadow-violet-600/10"
                                                }`}
                                            >
                                                {isSent ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Đã gửi</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-3 h-3" />
                                                        <span>Gửi</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-[10px] text-slate-500 italic text-center py-6">Không tìm thấy cuộc trò chuyện nào.</p>
                            )}
                        </div>

                        {/* Nút đóng */}
                        <div className="flex justify-end pt-2 border-t border-white/5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-slate-300 transition cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShareModal;
