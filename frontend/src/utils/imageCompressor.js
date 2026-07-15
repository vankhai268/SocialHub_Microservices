/**
 * Nén & downscale ảnh tại Trình duyệt Client trước khi upload lên Server.
 * Giảm dung lượng file gốc từ 10MB-15MB xuống ~300KB-600KB trong thời gian cực ngắn.
 * Max Dimensions: 2048px | Quality: 88% WebP
 */
export const compressImageBeforeUpload = (file, maxWidth = 2048, maxHeight = 2048, quality = 0.88) => {
    return new Promise((resolve) => {
        if (!file || !file.type.startsWith("image/") || file.type === "image/gif") {
            return resolve(file);
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Tỷ lệ thu nhỏ bảo toàn aspect ratio
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                // Nén sang định dạng WebP hoặc giữ PNG
                const outputType = file.type === "image/png" ? "image/png" : "image/webp";

                canvas.toBlob(
                    (blob) => {
                        if (!blob || blob.size >= file.size) {
                            // Nếu file sau khi nén lớn hơn hoặc bằng file gốc thì giữ nguyên file gốc
                            return resolve(file);
                        }

                        const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                        const compressedFile = new File([blob], newFileName, {
                            type: outputType,
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    },
                    outputType,
                    quality
                );
            };

            img.onerror = () => resolve(file);
        };

        reader.onerror = () => resolve(file);
    });
};
