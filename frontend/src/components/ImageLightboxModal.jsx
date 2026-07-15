import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";

/**
 * Component Cửa sổ Xem Ảnh Toàn Màn Hình (Image Lightbox Modal)
 * Cho phép phóng to ngắm ảnh sắc nét 100% với giao diện nền đen mờ sang trọng.
 */
const ImageLightboxModal = ({ imageUrl, onClose, altText = "Fullsize Image" }) => {
    // Đóng modal khi nhấn phím Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    if (!imageUrl) return null;

    return (
        <div 
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none"
            onClick={onClose}
        >
            {/* Nút Đóng */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer z-50 backdrop-blur-md border border-white/10"
                title="Đóng (Esc)"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Nút Mở Tab Mới */}
            <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-4 right-16 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer z-50 backdrop-blur-md border border-white/10"
                title="Mở tab mới"
            >
                <ExternalLink className="w-6 h-6" />
            </a>

            {/* Khung Hiển thị Ảnh Sắc Nét */}
            <div 
                className="relative max-w-7xl max-h-[90vh] flex items-center justify-center overflow-hidden rounded-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={imageUrl}
                    alt={altText}
                    className="max-h-[88vh] max-w-full object-contain rounded-xl shadow-2xl animate-scaleUp"
                />
            </div>
        </div>
    );
};

export default ImageLightboxModal;
