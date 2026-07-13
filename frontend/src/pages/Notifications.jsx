import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { Bell, Heart, MessageSquare, UserPlus, UserCheck, Share2, Eye, Check, Loader } from "lucide-react";

const Notifications = () => {
    const { setUnreadCount } = useSocket();
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Tải danh sách thông báo
    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/notifications");
            if (res.data && res.data.success) {
                setNotifications(res.data.data || []);
            }
        } catch (error) {
            console.error("❌ Lỗi khi tải danh sách thông báo:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    // 2. Đánh dấu một thông báo là đã đọc
    const handleMarkAsRead = async (notification) => {
        if (notification.isRead) {
            // Nếu đã đọc rồi, chuyển hướng thẳng
            handleRedirect(notification);
            return;
        }

        try {
            const res = await api.put(`/notifications/${notification.id}/read`);
            if (res.data && res.data.success) {
                // Cập nhật state cục bộ
                setNotifications(prev =>
                    prev.map(n => (n.id === notification.id ? { ...n, isRead: true } : n))
                );
                // Giảm số lượng chưa đọc ở Sidebar
                setUnreadCount(prev => Math.max(0, prev - 1));
                
                // Chuyển hướng người dùng
                handleRedirect(notification);
            }
        } catch (error) {
            console.error("❌ Lỗi khi đánh dấu đã đọc:", error);
            // Vẫn cho chuyển hướng dù lỗi mạng API
            handleRedirect(notification);
        }
    };

    // 3. Đánh dấu tất cả là đã đọc
    const handleMarkAllAsRead = async () => {
        try {
            const res = await api.put("/notifications/read-all");
            if (res.data && res.data.success) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
            }
        } catch (error) {
            console.error("❌ Lỗi khi đánh dấu đọc tất cả:", error);
        }
    };

    // 4. Hàm điều hướng tùy theo loại thông báo
    const handleRedirect = (notif) => {
        if (notif.type === "friend_request") {
            navigate("/friends");
        } else if (notif.type === "friend_accepted") {
            navigate(`/profile/${notif.fromUser?.id}`);
        } else if (["post_liked", "post_commented", "post_shared"].includes(notif.type)) {
            // Chuyển về trang chủ (hoặc trang chi tiết post nếu có)
            navigate("/");
        }
    };

    // 5. Trả về Icon tương ứng với loại tương tác
    const getIcon = (type) => {
        switch (type) {
            case "post_liked":
                return <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />;
            case "post_commented":
                return <MessageSquare className="w-5 h-5 text-violet-400 fill-violet-400/20" />;
            case "post_shared":
                return <Share2 className="w-5 h-5 text-sky-400" />;
            case "friend_request":
                return <UserPlus className="w-5 h-5 text-amber-500" />;
            case "friend_accepted":
                return <UserCheck className="w-5 h-5 text-emerald-400" />;
            default:
                return <Bell className="w-5 h-5 text-slate-400" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header thông báo */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-violet-400 to-pink-500 bg-clip-text text-transparent">Thông báo</h1>
                    <p className="text-slate-400 text-sm mt-1">Nơi lưu lại các lượt tương tác của mọi người với bạn.</p>
                </div>
                
                {notifications.some(n => !n.isRead) && (
                    <button
                        onClick={handleMarkAllAsRead}
                        className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-slate-300 transition cursor-pointer"
                    >
                        <Check className="w-4 h-4" />
                        <span>Đánh dấu đọc tất cả</span>
                    </button>
                )}
            </div>

            {/* Danh sách thông báo */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader className="w-8 h-8 text-violet-500 animate-spin" />
                </div>
            ) : notifications.length > 0 ? (
                <div className="space-y-3">
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => handleMarkAsRead(notif)}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition duration-200 cursor-pointer ${
                                notif.isRead
                                    ? "bg-slate-900/20 border-white/5 hover:bg-slate-900/40 text-slate-300"
                                    : "bg-white/5 border-violet-500/20 shadow-md shadow-violet-500/5 hover:bg-white/10 text-white"
                            }`}
                        >
                            <div className="flex items-center space-x-4">
                                {/* Khung Avatar tròn kèm badge Icon tương tác đè góc */}
                                <div className="relative">
                                    <img
                                        src={notif.fromUser?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                        alt="Avatar"
                                        className="w-12 h-12 rounded-full border border-white/10 object-cover"
                                    />
                                    <div className="absolute -bottom-1 -right-1 p-1 bg-slate-900 rounded-full border border-white/10 shadow-sm">
                                        {getIcon(notif.type)}
                                    </div>
                                </div>
                                
                                <div>
                                    <p className="text-sm font-medium leading-relaxed">{notif.message}</p>
                                    <p className="text-xs text-slate-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Dấu chấm xanh báo hiệu chưa đọc */}
                            {!notif.isRead && (
                                <div className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-pulse shadow-md shadow-violet-500/50 mr-2"></div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl p-8">
                    <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">Hộp thư thông báo của bạn trống</p>
                    <p className="text-slate-500 text-sm mt-1">Khi có người tương tác, kết bạn hoặc bình luận bài đăng của bạn, chúng sẽ xuất hiện ở đây.</p>
                </div>
            )}
        </div>
    );
};

export default Notifications;
