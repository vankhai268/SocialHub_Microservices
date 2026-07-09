import { useState, useRef } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Image, Send, X, Loader } from "lucide-react";

const CreatePost = ({ onPostCreated }) => {
    const { user } = useAuth();
    const [content, setContent] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    // 1. Xử lý khi người dùng chọn file ảnh
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file)); // Tạo link xem trước tạm thời
        }
    };

    // 2. Xóa ảnh đã chọn
    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // 3. Đăng bài viết
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim() && !imageFile) return;

        setIsSubmitting(true);
        let mediaIds = [];

        try {
            // Bước A: Nếu có ảnh, upload lên media-service qua Gateway trước
            if (imageFile) {
                setIsUploading(true);
                const formData = new FormData();
                formData.append("file", imageFile);

                const uploadRes = await api.post("/media/upload", formData, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                });

                if (uploadRes.data && uploadRes.data.id) {
                    mediaIds.push(uploadRes.data.id);
                }
                setIsUploading(false);
            }

            // Bước B: Gửi bài viết kèm ID ảnh sang post-service qua Gateway
            const postRes = await api.post("/posts", {
                content,
                mediaIds,
                visibility: "friends" // hoặc public
            });

            if (postRes.data && postRes.data.success) {
                setContent("");
                handleRemoveImage();
                if (onPostCreated) onPostCreated(postRes.data.data); // Refresh danh sách bài viết ở trang cha
            }
        } catch (error) {
            console.error("❌ Lỗi khi đăng bài:", error);
            alert("Không thể đăng bài viết. Vui lòng thử lại!");
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl mb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-start space-x-4">
                    <img
                        src={user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt="Avatar"
                        className="w-10 h-10 rounded-full border border-white/20"
                    />
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={`${user?.displayName} ơi, hôm nay bạn đang nghĩ gì thế?`}
                        className="flex-1 bg-transparent border-none text-white placeholder-slate-500 focus:outline-none resize-none min-h-[80px] text-lg"
                    />
                </div>

                {/* Phần hiển thị ảnh xem trước (Preview) */}
                {imagePreview && (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 max-h-[300px]">
                        <img src={imagePreview} alt="Preview" className="w-full object-cover max-h-[300px]" />
                        <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    {/* Nút chọn ảnh ẩn */}
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSubmitting}
                        className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 transition cursor-pointer disabled:opacity-50 text-sm"
                    >
                        <Image className="w-5 h-5 text-emerald-400" />
                        <span>Hình ảnh</span>
                    </button>

                    {/* Nút Đăng Bài */}
                    <button
                        type="submit"
                        disabled={isSubmitting || (!content.trim() && !imageFile)}
                        className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 rounded-xl text-white font-semibold transition duration-200 transform active:scale-95 disabled:opacity-50 cursor-pointer text-sm"
                    >
                        {isSubmitting ? (
                            <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        <span>{isSubmitting ? "Đang đăng..." : "Đăng bài"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreatePost;
