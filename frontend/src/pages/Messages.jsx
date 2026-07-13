import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import api from "../services/api";
import {
    MessageSquare,
    Send,
    Image as ImageIcon,
    Users,
    X,
    Loader,
    MessageSquarePlus,
    Circle,
    ChevronRight
} from "lucide-react";

// Component con tải ảnh an toàn bằng blob đính kèm JWT Token
const ChatImage = ({ mediaId }) => {
    const [imageUrl, setImageUrl] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchImage = async () => {
            try {
                const response = await api.get(`/media/file/${mediaId}`, {
                    responseType: "blob"
                });
                if (isMounted) {
                    const objectUrl = URL.createObjectURL(response.data);
                    setImageUrl(objectUrl);
                }
            } catch (err) {
                console.error("❌ Lỗi tải ảnh đính kèm chat:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchImage();

        return () => {
            isMounted = false;
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
    }, [mediaId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-4 bg-slate-900/50 rounded-lg">
                <Loader className="w-4 h-4 text-violet-500 animate-spin" />
            </div>
        );
    }

    if (!imageUrl) {
        return <p className="text-[10px] text-red-400 italic">Không tải được ảnh</p>;
    }

    return (
        <img
            src={imageUrl}
            alt="Attached"
            className="rounded-lg max-h-60 max-w-full object-contain cursor-pointer hover:opacity-95 transition"
            onClick={() => window.open(imageUrl, "_blank")}
        />
    );
};

const Messages = () => {
    const { user: currentUser } = useAuth();
    const { onlineUsers, chatSocket } = useSocket();
    
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    
    const [isLoadingConvs, setIsLoadingConvs] = useState(true);
    const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);
    
    // Group Chat Modal
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    
    // Image attachment
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isSending, setIsSending] = useState(false);
    
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 1. Tải danh sách hội thoại
    const fetchConversationsList = async () => {
        setIsLoadingConvs(true);
        try {
            const res = await api.get("/conversations?limit=50");
            if (res.data && res.data.success) {
                setConversations(res.data.data || []);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy danh sách hội thoại:", err);
        } finally {
            setIsLoadingConvs(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            fetchConversationsList();
        }
    }, [currentUser]);

    // 2. Tải danh sách bạn bè cho Modal Tạo nhóm
    useEffect(() => {
        const fetchFriends = async () => {
            try {
                const res = await api.get("/friends");
                if (res.data && res.data.success) {
                    setFriends(res.data.data || []);
                }
            } catch (err) {
                console.error("❌ Lỗi tải bạn bè:", err);
            }
        };
        if (showGroupModal) {
            fetchFriends();
        }
    }, [showGroupModal]);

    // 3. Tải tin nhắn khi chọn hội thoại
    useEffect(() => {
        if (!selectedConv) return;
        
        const convId = selectedConv._id || selectedConv.id;
        const fetchMessages = async () => {
            setIsLoadingMsgs(true);
            try {
                const res = await api.get(`/conversations/${convId}/messages?limit=50`);
                if (res.data && res.data.success) {
                    setMessages(res.data.data?.data ? [...res.data.data.data].reverse() : []);
                }
            } catch (err) {
                console.error("❌ Lỗi lấy tin nhắn:", err);
            } finally {
                setIsLoadingMsgs(false);
            }
        };

        fetchMessages();

        // Join room websocket
        if (chatSocket) {
            chatSocket.emit("conversation:join", { conversationId: convId });
        }

        // Đánh dấu đã đọc hội thoại này
        const markAsRead = async () => {
            try {
                await api.post(`/conversations/${convId}/read`);
                // Cập nhật lại unread count ở sidebar cục bộ
                setConversations(prev => prev.map(c => {
                    const cId = c._id || c.id;
                    if (cId === convId) {
                        return { ...c, unreadCount: 0 };
                    }
                    return c;
                }));
            } catch (err) {
                // Silently fail
            }
        };
        markAsRead();

    }, [selectedConv, chatSocket]);

    // 4. Lắng nghe tin nhắn mới từ Socket
    useEffect(() => {
        if (!chatSocket) return;

        const handleIncomingMsg = (message) => {
            const currentSelectedId = selectedConv?._id || selectedConv?.id;
            
            // Nếu tin nhắn thuộc hội thoại đang mở
            if (String(message.conversationId) === String(currentSelectedId)) {
                setMessages(prev => [...prev, message]);
                // Đọc tin nhắn luôn
                chatSocket.emit("message:read", { conversationId: currentSelectedId, messageId: message.id || message._id });
            }

            // Đồng thời cập nhật danh sách hội thoại ngoài sidebar
            setConversations(prev => {
                return prev.map(c => {
                    const cId = c._id || c.id;
                    if (String(cId) === String(message.conversationId)) {
                        return {
                            ...c,
                            lastMessage: message,
                            unreadCount: String(cId) === String(currentSelectedId) ? 0 : (c.unreadCount || 0) + 1,
                            updatedAt: new Date().toISOString()
                        };
                    }
                    return c;
                }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            });
        };

        chatSocket.on("message:received", handleIncomingMsg);
        return () => {
            chatSocket.off("message:received", handleIncomingMsg);
        };
    }, [chatSocket, selectedConv]);

    // 5. Thêm/Xóa thành viên khỏi nhóm chat
    const handleToggleFriend = (id) => {
        setSelectedFriends(prev => 
            prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
        );
    };

    // 6. Gửi tạo nhóm chat mới
    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupName.trim() || selectedFriends.length === 0) return;

        try {
            const res = await api.post("/groups", {
                name: groupName.trim(),
                memberIds: selectedFriends
            });
            if (res.data && res.data.success) {
                const newGroup = res.data.data;
                
                // Reset form
                setGroupName("");
                setSelectedFriends([]);
                setShowGroupModal(false);

                // Tải lại danh sách hội thoại và chọn nhóm mới
                const convRes = await api.get(`/conversations/${newGroup.conversationId}`);
                if (convRes.data && convRes.data.success) {
                    const newConversation = convRes.data.data;
                    setConversations(prev => [newConversation, ...prev]);
                    setSelectedConv(newConversation);
                }
            }
        } catch (err) {
            console.error("❌ Lỗi tạo nhóm chat:", err);
            alert("Tạo nhóm chat thất bại!");
        }
    };

    // 7. Gửi tin nhắn
    const handleSendMessage = async (e) => {
        e.preventDefault();
        const convId = selectedConv?._id || selectedConv?.id;
        if (!convId || (!inputText.trim() && !imageFile) || !chatSocket) return;

        setIsSending(true);
        let mediaId = null;

        try {
            // Tải ảnh lên trước
            if (imageFile) {
                const formData = new FormData();
                formData.append("file", imageFile);
                const uploadRes = await api.post("/media/upload", formData, {
                    headers: {
                        "Content-Type": "multipart/form-data"
                    }
                });
                if (uploadRes.data && uploadRes.data.id) {
                    mediaId = uploadRes.data.id;
                }
            }

            // Gửi qua socket
            chatSocket.emit("message:send", {
                conversationId: convId,
                content: inputText.trim(),
                type: mediaId ? "image" : "text",
                mediaId
            });

            setInputText("");
            handleRemoveImage();
        } catch (err) {
            console.error("❌ Lỗi gửi tin nhắn:", err);
            alert("Gửi tin nhắn thất bại!");
        } finally {
            setIsSending(false);
        }
    };

    // Xử lý đính kèm ảnh
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = () => {
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Phân giải tiêu đề và avatar hội thoại
    const getConvInfo = (conv) => {
        const isGroup = conv.type === "group";
        const cId = conv._id || conv.id;
        const other = conv.participants?.find(p => p.userId !== currentUser.id) || {
            displayName: "Người dùng",
            avatarUrl: null,
            userId: ""
        };

        const title = isGroup ? conv.groupRef?.name || "Cuộc trò chuyện nhóm" : other.displayName;
        const avatar = isGroup
            ? conv.groupRef?.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${cId}`
            : other.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix";
        const isOnline = !isGroup && onlineUsers[other.userId] === true;

        return { title, avatar, isOnline, other };
    };

    return (
        <div className="flex-1 flex bg-white rounded-3xl border border-slate-200 overflow-hidden h-[calc(100vh-120px)] mt-4 ml-6 mr-6 shadow-sm">
            
            {/* Cột trái: Danh sách hội thoại */}
            <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50">
                
                {/* Header */}
                <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                        <MessageSquare className="w-5 h-5 text-violet-600" />
                        <span>Hội thoại</span>
                    </h2>
                    <button
                        onClick={() => setShowGroupModal(true)}
                        title="Tạo nhóm mới"
                        className="p-2 bg-white hover:bg-slate-100 text-slate-650 hover:text-violet-600 border border-slate-200 rounded-xl transition cursor-pointer shadow-sm"
                    >
                        <MessageSquarePlus className="w-5 h-5" />
                    </button>
                </div>

                {/* Danh sách */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {isLoadingConvs ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader className="w-6 h-6 text-violet-500 animate-spin" />
                        </div>
                    ) : conversations.length > 0 ? (
                        conversations.map(conv => {
                            const cId = conv._id || conv.id;
                            const isSelected = selectedConv && (selectedConv._id === cId || selectedConv.id === cId);
                            const { title, avatar, isOnline } = getConvInfo(conv);
                            
                            return (
                                <div
                                    key={cId}
                                    onClick={() => setSelectedConv(conv)}
                                    className={`flex items-center space-x-3.5 p-3 rounded-2xl cursor-pointer transition group ${
                                        isSelected
                                            ? "bg-violet-50 border border-violet-200"
                                            : "hover:bg-slate-100 border border-transparent"
                                    }`}
                                >
                                    <div className="relative flex-shrink-0">
                                        <img
                                            src={avatar}
                                            className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                                            alt="Avatar"
                                        />
                                        {isOnline && (
                                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-violet-600 transition">
                                                {title}
                                            </h4>
                                            {conv.unreadCount > 0 && (
                                                <span className="bg-rose-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full shadow-md shadow-rose-500/20 min-w-[16px] text-center">
                                                    {conv.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                                            {conv.lastMessage?.content || (conv.lastMessage?.type === "image" ? "Đã gửi một ảnh" : "Chưa có tin nhắn...")}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center text-slate-400 text-xs py-12">Không tìm thấy cuộc trò chuyện nào.</div>
                    )}
                </div>
            </div>

            {/* Cột phải: Chi tiết hội thoại */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {selectedConv ? (
                    <>
                        {/* Header Chat */}
                        {(() => {
                            const { title, avatar, isOnline, other } = getConvInfo(selectedConv);
                            const isGroup = selectedConv.type === "group";
                            
                            return (
                                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                                    <div className="flex items-center space-x-3.5">
                                        <img
                                            src={avatar}
                                            className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                                            alt="Avatar"
                                        />
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-850">{title}</h3>
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                {isGroup
                                                    ? `${selectedConv.participants?.length || 0} thành viên`
                                                    : (isOnline ? "Đang hoạt động" : "Ngoại tuyến")
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Vùng nội dung tin nhắn */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
                            {isLoadingMsgs ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader className="w-7 h-7 text-violet-500 animate-spin" />
                                </div>
                            ) : messages.length > 0 ? (
                                messages.map((msg, index) => {
                                    const isMe = msg.senderId === currentUser.id;
                                    const isGroup = selectedConv.type === "group";
                                    const sender = selectedConv.participants?.find(p => p.userId === msg.senderId) || {
                                        displayName: "Thành viên",
                                        avatarUrl: null
                                    };
                                    const msgTime = new Date(msg.createdAt || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                    return (
                                        <div key={msg.id || msg._id || index} className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-1`}>
                                            {!isMe && isGroup && (
                                                <span className="text-[9px] text-slate-500 font-semibold ml-9 select-none">
                                                    {sender.displayName}
                                                </span>
                                            )}
                                            
                                            <div className={`flex items-end space-x-2.5 ${isMe ? "justify-end" : "justify-start"} max-w-[70%]`}>
                                                {!isMe && (
                                                    <img
                                                        src={sender.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.senderId}`}
                                                        className="w-7.5 h-7.5 rounded-full object-cover border border-slate-200 flex-shrink-0"
                                                        alt="Sender Avatar"
                                                    />
                                                )}
                                                
                                                <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                                                    isMe
                                                        ? "bg-violet-600 text-white rounded-br-none"
                                                        : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"
                                                }`}>
                                                    {msg.type === "image" && msg.mediaId ? (
                                                        <div className="space-y-2">
                                                            <ChatImage mediaId={msg.mediaId} />
                                                            {msg.content && msg.content !== "Sent an image" && (
                                                                <p className="mt-1 text-slate-800">{msg.content}</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        msg.content
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`text-[8px] text-slate-400 select-none ${isMe ? "mr-1" : "ml-10"}`}>
                                                {msgTime}
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic">
                                    Chưa có tin nhắn nào. Gửi lời chào để bắt đầu cuộc trò chuyện!
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Ô nhập tin nhắn */}
                        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-3">
                            
                            {/* Khung ảnh xem trước */}
                            {imagePreview && (
                                <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-h-24 max-w-[160px] flex items-center bg-slate-100 p-1">
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-contain max-h-24 rounded-xl" />
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/85 text-white rounded-full transition cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            {/* Dòng điều khiển */}
                            <div className="flex items-center space-x-3.5">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-650 hover:text-violet-600 rounded-xl transition cursor-pointer flex-shrink-0"
                                >
                                    <ImageIcon className="w-4 h-4" />
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    accept="image/*"
                                    className="hidden"
                                />

                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Nhập tin nhắn..."
                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-600 transition"
                                />
                                
                                <button
                                    type="submit"
                                    disabled={isSending || (!inputText.trim() && !imageFile)}
                                    className="p-2.5 bg-violet-600 disabled:opacity-50 hover:bg-violet-700 text-white rounded-xl transition cursor-pointer flex-shrink-0"
                                >
                                    {isSending ? (
                                        <Loader className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 select-none">
                        <div className="p-4 bg-violet-50 border border-violet-100 rounded-3xl mb-4 animate-pulse">
                            <MessageSquare className="w-12 h-12 text-violet-500" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base">Chào mừng tới Trung tâm Tin nhắn!</h3>
                        <p className="text-slate-500 text-xs max-w-sm mt-2 leading-relaxed">
                            Hãy chọn một cuộc hội thoại ở danh sách bên trái hoặc nhấn vào biểu tượng Tạo nhóm để bắt đầu tán gẫu với bạn bè.
                        </p>
                    </div>
                )}
            </div>

            {/* Modal Tạo nhóm từ trung tâm tin nhắn */}
            {showGroupModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fadeIn">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="font-bold text-slate-850 text-sm">Tạo nhóm chat mới</h3>
                            <button
                                onClick={() => {
                                    setShowGroupModal(false);
                                    setGroupName("");
                                    setSelectedFriends([]);
                                }}
                                className="text-slate-400 hover:text-slate-800 transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateGroup} className="p-4 space-y-4">
                            <div>
                                <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1">Tên nhóm</label>
                                <input
                                    type="text"
                                    required
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Nhập tên nhóm..."
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-600 transition"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-[10px] text-slate-500 font-semibold uppercase mb-1.5">
                                    Chọn thành viên ({selectedFriends.length})
                                </label>
                                {friends.length > 0 ? (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {friends.map(friend => (
                                            <div
                                                key={friend.id}
                                                onClick={() => handleToggleFriend(friend.id)}
                                                className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer ${
                                                    selectedFriends.includes(friend.id)
                                                        ? "bg-violet-50 border border-violet-200"
                                                        : "bg-slate-50 border-transparent hover:bg-slate-100"
                                                }`}
                                            >
                                                <div className="flex items-center space-x-2.5">
                                                    <img
                                                        src={friend.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                        className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                                        alt="Avatar"
                                                    />
                                                    <span className="text-xs text-slate-700 font-medium">{friend.displayName}</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFriends.includes(friend.id)}
                                                    readOnly
                                                    className="w-3.5 h-3.5 accent-violet-600 rounded border-slate-200 cursor-pointer"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-slate-450 text-[10px] py-4">Không tìm thấy bạn bè nào.</p>
                                )}
                            </div>
                            
                            <button
                                type="submit"
                                disabled={!groupName.trim() || selectedFriends.length === 0}
                                className="w-full bg-violet-600 disabled:opacity-50 hover:bg-violet-700 text-white font-semibold py-2 px-4 rounded-xl text-xs transition cursor-pointer shadow-md shadow-violet-500/10"
                            >
                                Tạo nhóm
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Messages;
