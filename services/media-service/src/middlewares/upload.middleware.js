import multer from 'multer';
import { config } from '../config/index.js';
import { BadRequestError } from '../utils/error.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const isImage = config.ALLOWED_IMAGE_TYPES.includes(file.mimetype);
  const isVideo = config.ALLOWED_VIDEO_TYPES.includes(file.mimetype);

  if (isImage || isVideo) {
    // Gắn loại file vào request để controller biết xử lý thế nào
    req.fileCategory = isImage ? 'image' : 'video';
    cb(null, true);
  } else {
    cb(new BadRequestError(
      `Invalid file type: ${file.mimetype}. ` +
      `Allowed: JPG, PNG, GIF, WEBP (image) | MP4, WEBM, MOV, AVI (video).`
    ));
  }
};

// Dùng giới hạn lớn nhất (video 100MB), controller sẽ tự kiểm tra lại theo loại file
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.MAX_VIDEO_SIZE,
  },
  fileFilter: fileFilter,
});

// Middleware xử lý 1 file với field name là "file"
export const uploadSingle = upload.single('file');

