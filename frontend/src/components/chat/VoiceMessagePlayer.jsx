import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import api from "../../services/api";

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Hàm hash đơn giản để tạo các cột sóng âm cố định, đẹp đẽ dựa trên URL hoặc ID
const generateStaticWaveforms = (seedStr, count = 28) => {
  const hash = seedStr.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const result = [];
  for (let i = 0; i < count; i++) {
    // Tạo chiều cao sóng ngẫu nhiên từ 15% đến 85%
    const val = 15 + Math.abs(Math.sin(hash + i * 2.3) * 70);
    result.push(val);
  }
  return result;
};

const VoiceMessagePlayer = ({ src, mediaId, durationProp, isMe }) => {
  const audioRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationProp || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [waveHeights, setWaveHeights] = useState([]);

  // Khởi tạo sóng âm cố định dựa trên nguồn hạt giống (seed) để mỗi tin nhắn thoại có hình dáng riêng biệt
  useEffect(() => {
    const seed = src || mediaId || "voice_msg";
    setWaveHeights(generateStaticWaveforms(seed));
  }, [src, mediaId]);
  // Đồng bộ durationProp từ props vào state local
  useEffect(() => {
    if (durationProp) {
      setDuration(durationProp);
    }
  }, [durationProp]);

  // Tải dữ liệu âm thanh an toàn bằng Axios (hỗ trợ JWT Authorization & ngrok bypass)
  useEffect(() => {
    // Nếu có presigned URL MinIO trực tiếp có signature, dùng luôn
    if (src && (src.includes("X-Amz-Signature") || src.startsWith("blob:"))) {
      setAudioUrl(src);
      return;
    }

    const targetMediaId = mediaId || src?.split('/').pop();
    if (!targetMediaId) return;

    let isMounted = true;
    let localUrl = "";

    const fetchAudioBlob = async () => {
      try {
        const res = await api.get(`/media/file/${targetMediaId}`, { responseType: "blob" });
        if (isMounted) {
          localUrl = URL.createObjectURL(res.data);
          setAudioUrl(localUrl);
        }
      } catch (err) {
        console.error("❌ Lỗi tải tệp âm thanh ghi âm:", err.message);
      }
    };

    fetchAudioBlob();

    return () => {
      isMounted = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [src, mediaId]);

  // Thiết lập sự kiện lắng nghe của Audio Node khi audioUrl thay đổi
  useEffect(() => {
    const audioNode = audioRef.current;
    if (!audioNode) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audioNode.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audioNode.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audioNode.addEventListener("timeupdate", handleTimeUpdate);
    audioNode.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioNode.addEventListener("ended", handleEnded);

    return () => {
      audioNode.removeEventListener("timeupdate", handleTimeUpdate);
      audioNode.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioNode.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  // Đồng bộ tốc độ phát
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Bật/tắt Play/Pause
  const handleTogglePlay = () => {
    const audioNode = audioRef.current;
    if (!audioNode) return;

    if (isPlaying) {
      audioNode.pause();
      setIsPlaying(false);
    } else {
      audioNode.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn("Audio play blocked:", err.message));
    }
  };

  // Thay đổi tốc độ phát: 1x -> 1.5x -> 2x
  const handleToggleSpeed = (e) => {
    e.stopPropagation();
    setPlaybackRate((prev) => {
      if (prev === 1) return 1.5;
      if (prev === 1.5) return 2;
      return 1;
    });
  };

  // Tua audio khi bấm vào cột sóng bất kỳ
  const handleWaveClick = (e, index) => {
    e.stopPropagation();
    const audioNode = audioRef.current;
    if (!audioNode || !duration) return;

    const ratio = (index + 0.5) / waveHeights.length;
    const newTime = ratio * duration;
    audioNode.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className={`flex items-center space-x-3 p-3 rounded-2xl max-w-[290px] shadow-sm select-none border transition-all ${
      isMe 
        ? "bg-violet-600 border-violet-500 text-white" 
        : "bg-slate-50 border-slate-200 text-slate-800"
    }`}>
      {/* Thẻ audio ẩn */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

      {/* Nút Play/Pause tròn */}
      <button
        onClick={handleTogglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer shadow-md ${
          isMe 
            ? "bg-white text-violet-600 hover:bg-slate-100" 
            : "bg-violet-600 text-white hover:bg-violet-750"
        }`}
      >
        {isPlaying ? (
          <Pause className={`w-4 h-4 fill-current ${isMe ? "text-violet-600" : "text-white"}`} />
        ) : (
          <Play className={`w-4 h-4 fill-current ${isMe ? "text-violet-600" : "text-white"} ml-0.5`} />
        )}
      </button>

      {/* Khung sóng âm Waveform + Thời gian */}
      <div className="flex-1 flex flex-col justify-center space-y-1">
        {/* Sóng âm gồm các vạch đứng */}
        <div className="flex items-end space-x-[2.5px] h-6 cursor-pointer">
          {waveHeights.map((height, idx) => {
            const ratio = duration ? currentTime / duration : 0;
            const barRatio = idx / waveHeights.length;
            const isPlayed = barRatio <= ratio;

            return (
              <div
                key={idx}
                onClick={(e) => handleWaveClick(e, idx)}
                className="w-[3px] rounded-full transition-colors duration-100"
                style={{
                  height: `${height}%`,
                  backgroundColor: isPlayed
                    ? (isMe ? "#ffffff" : "#8b5cf6") // Đã phát: trắng hoặc tím violet
                    : (isMe ? "rgba(255, 255, 255, 0.3)" : "rgba(139, 92, 246, 0.2)") // Chưa phát: mờ
                }}
              />
            );
          })}
        </div>

        {/* Thời gian */}
        <div className="flex justify-between items-center text-[10px] font-mono leading-none">
          <span className={isMe ? "text-slate-200" : "text-slate-500"}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Nút chỉnh Tốc độ phát (Speed toggle) */}
      <button
        onClick={handleToggleSpeed}
        className={`px-1.5 py-1 text-[9px] font-extrabold uppercase rounded-lg border font-mono tracking-wider shrink-0 transition active:scale-95 cursor-pointer ${
          isMe 
            ? "bg-white/10 border-white/20 text-white hover:bg-white/20" 
            : "bg-slate-200/50 border-slate-300 text-slate-700 hover:bg-slate-200"
        }`}
      >
        {playbackRate}x
      </button>
    </div>
  );
};

export default VoiceMessagePlayer;
