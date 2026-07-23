import multer from 'multer';
import { config } from '../config/index.js';
import { BadRequestError } from '../utils/error.js';

const storage = multer.memoryStorage();

const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/wav',
  'audio/mpeg',
  'audio/ogg',
  'audio/mp3',
  'audio/mp4',
  'audio/aac',
  'audio/m4a',
  'audio/x-m4a'
];

const fileFilter = (req, file, cb) => {
  const isImage = config.ALLOWED_IMAGE_TYPES.includes(file.mimetype);
  const isVideo = config.ALLOWED_VIDEO_TYPES.includes(file.mimetype);
  const isAudio = ALLOWED_AUDIO_TYPES.includes(file.mimetype) || file.mimetype.startsWith('audio/');

  if (isImage || isVideo || isAudio) {
    // Gắn loại file vào request để controller biết xử lý thế nào
    req.fileCategory = isImage ? 'image' : isVideo ? 'video' : 'audio';
    cb(null, true);
  } else {
    cb(new BadRequestError(
      `Invalid file type: ${file.mimetype}. ` +
      `Allowed: JPG, PNG, GIF, WEBP (image) | MP4, WEBM, MOV, AVI (video) | WEBM, WAV, MP3, M4A, AAC (audio).`
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

