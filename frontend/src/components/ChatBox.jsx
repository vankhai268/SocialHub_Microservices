import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { X, Send, Loader } from "lucide-react";

const ChatBox = ({ conversation, onClose, currentUserId }) => {
    const { chatSocket } = useSocket();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
    const messageEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const conversationId = conversation._id || conversation.id;
    
    // Tìm người trò chuyện đối phương
    const otherParticipant = conversation.participants?.find(p => p.userId !== currentUserId) || {
        displayName: "Người dùng",
        avatarUrl: null,
        userId: ""
    };

    // 1. Tải lịch sử tin nhắn và join room Websocket
    useEffect(() => {
        const fetchMessages = async () => {
            setIsLoading(true);
            try {
                const res = await api.get(`/conversations/${conversationId}/messages?limit=40`);
                if (res.data && res.data.success) {
                    // Cấu trúc trả về là res.data.data chứa danh sách tin nhắn
                    setMessages(res.data.data || []);
                }
            } catch (error) {
                console.error("❌ Lỗi lấy tin nhắn lịch sử:", error.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMessages();

        // Join room chat trên socket
        if (chatSocket) {
            chatSocket.emit("conversation:join", { conversationId });
            console.log(`📡 Đã gửi yêu cầu join conversation room: ${conversationId}`);
        }

    }, [conversationId, chatSocket]);

    // 2. Lắng nghe tin nhắn mới & typing indicators từ socket
    useEffect(() => {
        if (!chatSocket) return;

        // Nhận tin nhắn mới
        const handleNewMessage = (message) => {
            if (message.conversationId === conversationId) {
                setMessages(prev => [...prev, message]);
                // Đánh dấu đã đọc gửi ngược lại
                chatSocket.emit("message:read", { conversationId, messageId: message.id || message._id });
            }
        };

        // Nhận chỉ số đang gõ
        const handleTypingIndicator = (data) => {
            if (data.conversationId === conversationId && data.userId !== currentUserId) {
                setIsOtherUserTyping(data.isTyping);
            }
        };

        chatSocket.on("message:received", handleNewMessage);
        chatSocket.on("typing:indicator", handleTypingIndicator);

        return () => {
            chatSocket.off("message:received", handleNewMessage);
            chatSocket.off("typing:indicator", handleTypingIndicator);
        };
    }, [chatSocket, conversationId, currentUserId]);

    // 3. Cuộn xuống cuối khi có tin mới
    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOtherUserTyping]);

    // 4. Xử lý gõ phím & báo hiệu "đang gõ..."
    const handleInputChange = (e) => {
        setInputText(e.target.value);

        if (!chatSocket) return;

        if (!isTyping) {
            setIsTyping(true);
            chatSocket.emit("typing:start", { conversationId });
        }

        // Tạo trễ tắt chỉ số đang gõ sau 1.5 giây không nhập
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            chatSocket.emit("typing:stop", { conversationId });
        }, 1500);
    };

    // 5. Gửi tin nhắn
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim() || !chatSocket) return;

        // Gửi qua socket
        chatSocket.emit("message:send", {
            conversationId,
            content: inputText.trim(),
            type: "text"
        });

        // Dọn dẹp trạng thái gõ chữ
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setIsTyping(false);
        chatSocket.emit("typing:stop", { conversationId });

        setInputText("");
    };

    return (
        <div className="w-80 bg-slate-900 border border-white/10 rounded-t-2xl shadow-2xl flex flex-col h-[400px]">
            {/* Header hộp thoại */}
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-slate-950/60 rounded-t-2xl">
                <div className="flex items-center space-x-2.5">
                    <img
                        src={otherParticipant.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        className="w-8 h-8 rounded-full object-cover"
                        alt="Avatar"
                    />
                    <div className="truncate max-w-[150px]">
                        <h4 className="font-semibold text-white text-xs truncate">{otherParticipant.displayName}</h4>
                        <p className="text-[10px] text-slate-400">
                            {conversation.isOnline || otherParticipant.isOnline ? "Trực tuyến" : "Ngoại tuyến"}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition cursor-pointer">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Vùng tin nhắn */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-slate-950/20">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader className="w-6 h-6 text-violet-500 animate-spin" />
                    </div>
                ) : messages.length > 0 ? (
                    messages.map((msg, index) => {
                        const isMe = msg.senderId === currentUserId;
                        return (
                            <div key={msg.id || msg._id || index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                                    isMe
                                        ? "bg-violet-600 text-white rounded-br-none"
                                        : "bg-slate-800 text-slate-200 rounded-bl-none border border-white/5"
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center text-slate-500 text-[10px] py-12">Chưa có tin nhắn nào. Gửi tin nhắn đầu tiên!</div>
                )}
                
                {/* Chỉ chỉ số đang gõ */}
                {isOtherUserTyping && (
                    <div className="flex items-center space-x-2 text-slate-400 text-[10px] italic">
                        <div className="flex space-x-1">
                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                        <span>Đang nhập...</span>
                    </div>
                )}
                <div ref={messageEndRef} />
            </div>

            {/* Input gõ tin nhắn */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-slate-950/40">
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={inputText}
                        onChange={handleInputChange}
                        placeholder="Aa..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="p-2 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 disabled:opacity-50 text-white rounded-xl transition cursor-pointer"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatBox;
