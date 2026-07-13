import { useState, useEffect } from "react";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import ChatBox from "./ChatBox";
import { Users, Loader } from "lucide-react";

const ChatWidget = () => {
    const { user: currentUser } = useAuth();
    const { onlineUsers, chatSocket } = useSocket();
    const [friends, setFriends] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Quản lý các ô chat đang được mở nổi dưới đáy màn hình (Mở tối đa 3 ô thoại cùng lúc)
    const [openChats, setOpenChats] = useState([]);

    // 1. Tải danh sách bạn bè
    useEffect(() => {
        const fetchFriendsList = async () => {
            setIsLoading(true);
            try {
                const res = await api.get("/friends");
                if (res.data && res.data.success) {
                    setFriends(res.data.data || []);
                }
            } catch (error) {
                console.error("❌ Lỗi lấy danh sách bạn bè ở ChatWidget:", error.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (currentUser) {
            fetchFriendsList();
        }
    }, [currentUser]);

    // 2. Xử lý mở một cuộc trò chuyện khi click vào người bạn
    const handleOpenChat = async (friend) => {
        try {
            // Gọi API lấy hoặc tạo mới cuộc trò chuyện 1-1
            const res = await api.post("/conversations", { participantId: friend.id });
            if (res.data && res.data.success) {
                const conversation = res.data.data;

                // Nếu cuộc trò chuyện này chưa có trong danh sách mở chat
                if (!openChats.some(c => c._id === conversation._id || c.id === conversation.id)) {
                    // Mở thêm ô chat, giới hạn tối đa 3 ô chat nổi
                    setOpenChats(prev => {
                        const newChats = [...prev, conversation];
                        if (newChats.length > 3) {
                            newChats.shift(); // Tự động đóng ô chat lâu nhất
                        }
                        return newChats;
                    });
                }
            }
        } catch (error) {
            console.error("❌ Lỗi mở cuộc hội thoại:", error);
            alert("Không thể khởi tạo cuộc trò chuyện!");
        }
    };

    // 3. Đóng một ô chat
    const handleCloseChat = (conversationId) => {
        setOpenChats(prev => prev.filter(c => (c._id !== conversationId && c.id !== conversationId)));
    };

    if (!currentUser) return null;

    return (
        <>
            {/* Sidebar cố định bên phải (Right Sidebar) hiển thị danh sách bạn bè */}
            <aside className="w-64 bg-slate-900/40 backdrop-blur-md border-l border-white/10 p-5 fixed right-0 top-0 h-screen flex flex-col pt-20">
                <div className="flex items-center space-x-2 border-b border-white/10 pb-3 mb-4">
                    <Users className="w-5 h-5 text-violet-400" />
                    <h3 className="font-bold text-white text-sm">Bạn bè ({friends.length})</h3>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader className="w-5 h-5 text-violet-500 animate-spin" />
                    </div>
                ) : friends.length > 0 ? (
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {friends.map(friend => {
                            // Xem trạng thái trực tuyến của bạn bè qua onlineUsers trong SocketContext
                            const isOnline = onlineUsers[friend.id] === true;

                            return (
                                <div
                                    key={friend.id}
                                    onClick={() => handleOpenChat(friend)}
                                    className="flex items-center space-x-3 p-2 rounded-xl hover:bg-white/5 transition cursor-pointer group"
                                >
                                    <div className="relative">
                                        <img
                                            src={friend.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                            className="w-9 h-9 rounded-full object-cover border border-white/10"
                                            alt="Avatar"
                                        />
                                        {/* Chấm tròn báo trạng thái online/offline */}
                                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                                            isOnline ? "bg-emerald-500" : "bg-slate-500"
                                        }`} />
                                    </div>
                                    <div className="truncate flex-1">
                                        <p className="text-xs font-semibold text-slate-300 group-hover:text-white truncate transition">
                                            {friend.displayName}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-center text-slate-500 text-xs py-8">Chưa có bạn bè để nhắn tin.</p>
                )}
            </aside>

            {/* Container chứa các ô chat nổi ở góc dưới bên phải màn hình */}
            <div className="fixed bottom-0 right-72 z-40 flex items-end space-x-4 pointer-events-none">
                {openChats.map(conv => (
                    <div key={conv._id || conv.id} className="pointer-events-auto">
                        {/* Map trạng thái online vào cuộc trò chuyện */}
                        <ChatBox
                            conversation={{
                                ...conv,
                                isOnline: conv.participants?.some(p => p.userId !== currentUser.id && onlineUsers[p.userId] === true)
                            }}
                            onClose={() => handleCloseChat(conv._id || conv.id)}
                            currentUserId={currentUser.id}
                        />
                    </div>
                ))}
            </div>
        </>
    );
};

export default ChatWidget;
