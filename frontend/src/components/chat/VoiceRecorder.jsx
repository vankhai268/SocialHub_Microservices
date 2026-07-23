import { useEffect, useRef, useState } from "react";
import { Trash2, Send } from "lucide-react";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const VoiceRecorder = ({ onSend, onCancel }) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const recordingTimeRef = useRef(0);

  useEffect(() => {
    recordingTimeRef.current = recordingTime;
  }, [recordingTime]);

  // Ghi âm bắt đầu ngay khi mount component
  useEffect(() => {
    let isMounted = true;

    const startRecording = async () => {
      audioChunksRef.current = [];
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          if (audioBlob.size > 0) {
            onSend(audioBlob, recordingTimeRef.current || 1);
          }
        };

        // Ghi âm liên tục để âm thanh không bị giật hay đứt quãng
        mediaRecorder.start();
        setIsRecording(true);

        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);

      } catch (err) {
        console.error("❌ Không thể truy cập micro để ghi âm:", err.message);
        alert("Không thể truy cập Microphone. Vui lòng cấp quyền micro trong cài đặt trình duyệt!");
        if (isMounted) onCancel();
      }
    };

    startRecording();

    return () => {
      isMounted = false;
      stopStreamsAndTimers();
    };
  }, []);

  const stopStreamsAndTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
  };

  const handleStopAndSend = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      stopStreamsAndTimers();
      setIsRecording(false);
    }
  };

  const handleCancel = () => {
    stopStreamsAndTimers();
    setIsRecording(false);
    onCancel();
  };

  return (
    <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 flex-1 animate-fadeIn">
      {/* Biểu tượng Micro nhấp nháy phát sáng đỏ báo hiệu đang ghi âm */}
      <div className="relative shrink-0 flex items-center justify-center">
        <span className="absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75 animate-ping" />
        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500" />
      </div>

      {/* Hiệu ứng Sóng âm chuyển động (Animated CSS Waveform Visualizer) */}
      <div className="flex-1 flex items-center justify-center space-x-[3px] h-6 px-4">
        {[...Array(12)].map((_, i) => {
          const delay = (i % 3) * 0.15;
          return (
            <div
              key={i}
              className="w-[2.5px] bg-red-500 rounded-full animate-wave"
              style={{
                animationDelay: `${delay}s`,
                height: isRecording ? '100%' : '15%'
              }}
            />
          );
        })}
      </div>

      {/* Bộ đếm thời gian */}
      <div className="text-xs font-mono font-bold text-slate-600 shrink-0">
        {formatTime(recordingTime)}
      </div>

      {/* Nút hủy bỏ (Thùng rác) */}
      <button
        type="button"
        onClick={handleCancel}
        className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-xl cursor-pointer transition shrink-0"
        title="Hủy ghi âm"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Nút gửi tin nhắn thoại */}
      <button
        type="button"
        onClick={handleStopAndSend}
        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition shadow-md shrink-0 active:scale-95"
        title="Gửi tin nhắn thoại"
      >
        <Send className="w-3.5 h-3.5" />
      </button>

      <style>{`
        @keyframes waveAnimation {
          0%, 100% {
            transform: scaleY(0.2);
          }
          50% {
            transform: scaleY(1);
          }
        }
        .animate-wave {
          animation: waveAnimation 0.8s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>
    </div>
  );
};

export default VoiceRecorder;
