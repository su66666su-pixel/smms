/**
 * WebRTC and Media Stream Utilities
 */

/**
 * Creates an animated canvas stream and silent audio stream to emulate camera feed
 * for browsers inside sandboxed iframes or systems without cameras.
 */
export function createMockStream(username: string): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  
  let angle = 0;
  const intervalId = setInterval(() => {
    // Background Space Theme
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, 640, 480);
    
    // Glowing orbital paths
    ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(320, 240, 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(320, 240, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Glowing orbiting planet
    const orbX = 320 + Math.cos(angle) * 150;
    const orbY = 240 + Math.sin(angle) * 150;
    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(orbX, orbY, 10, 0, Math.PI * 2);
    ctx.fill();

    // Pulse wave for visual mic levels
    const pulse = 65 + Math.sin(angle * 3) * 10;
    const grad = ctx.createRadialGradient(320, 240, 10, 320, 240, pulse);
    grad.addColorStop(0, "rgba(59, 130, 246, 0.5)");
    grad.addColorStop(0.5, "rgba(99, 102, 241, 0.2)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(320, 240, pulse, 0, Math.PI * 2);
    ctx.fill();

    // Avatar Circle representing user image
    ctx.fillStyle = "#312e81";
    ctx.strokeStyle = "#4338ca";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(320, 240, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Human silhouette / Avatar icon
    ctx.fillStyle = "#818cf8";
    ctx.beginPath();
    ctx.arc(320, 222, 18, 0, Math.PI * 2); // Head
    ctx.fill();
    ctx.beginPath();
    ctx.arc(320, 275, 30, Math.PI, 0); // Shoulders
    ctx.fill();

    // Username & Status Badge
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.fillRect(160, 330, 320, 75);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
    ctx.strokeRect(160, 330, 320, 75);

    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(username, 320, 355);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#a5f3fc";
    ctx.fillText("تم تفعيل الاتصال عبر الويب (WebRTC)", 320, 375);

    // Live blink-ring
    ctx.fillStyle = (Math.floor(Date.now() / 500) % 2 === 0) ? "#10b981" : "rgba(16, 185, 129, 0.3)";
    ctx.beginPath();
    ctx.arc(280, 393, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "11px monospace";
    ctx.fillStyle = "#10b981";
    ctx.textAlign = "left";
    ctx.fillText("نشط الآن (CAM SIMULATOR)", 292, 396);

    angle += 0.03;
  }, 40);

  const streamCanvas = canvas as any;
  const videoTrack = typeof streamCanvas.captureStream === "function" 
    ? streamCanvas.captureStream(25).getVideoTracks()[0] 
    : streamCanvas.transferControlToOffscreen().captureStream(25).getVideoTracks()[0];
  
  // Audio oscillator for a silent, valid stream
  let stream: MediaStream;
  let stopAudio: (() => void) | null = null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const dst = audioCtx.createMediaStreamDestination();
      oscillator.connect(dst);
      oscillator.frequency.value = 440;
      // start without routing to output speakers, so it behaves as an input mic quietly
      oscillator.start();
      const audioTrack = dst.stream.getAudioTracks()[0];
      stream = new MediaStream([videoTrack, audioTrack]);
      stopAudio = () => {
        try {
          oscillator.stop();
          audioCtx.close();
        } catch (e) {}
      };
    } else {
      stream = new MediaStream([videoTrack]);
    }
  } catch (e) {
    stream = new MediaStream([videoTrack]);
  }

  (stream as any).stopMock = () => {
    clearInterval(intervalId);
    if (stopAudio) stopAudio();
  };

  return stream;
}

/**
 * Gets the actual user camera + mic stream if permissions are granted.
 * Fallbacks to canvas simulation if error occurs.
 */
export async function getMediaStream(username: string, options: { video: boolean; audio: boolean }): Promise<{
  stream: MediaStream;
  isMock: boolean;
  errorText?: string;
}> {
  const timeoutMs = 3000;

  try {
    // Media access promise
    const getStreamPromise = navigator.mediaDevices.getUserMedia({
      video: options.video,
      audio: options.audio
    });

    // Timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout starting video source")), timeoutMs);
    });

    // Race them so we never hang indefinitely or trigger long timeouts
    const stream = await Promise.race([getStreamPromise, timeoutPromise]);
    
    // Log success as requested in step 9
    console.log("camera started");
    console.log("mic started");
    return { stream, isMock: false };
  } catch (error: any) {
    console.error("Camera/Mic access failed or timed out. Activating Canvas emulation:", error);
    
    // Determine friendly text based on error message
    let errorText = "تعذر تشغيل الصوت أو الصورة";
    const errStr = String(error?.message || error?.name || "").toLowerCase();
    const isDeviceMissing = errStr.includes("notfound") || errStr.includes("device") || errStr.includes("overconstrained") || errStr.includes("requested device");

    if (isDeviceMissing && options.video && options.audio) {
      console.log("One of the devices is missing. Trying a fallback: audio-only (mic) with mock webcam...");
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log("Voice/mic captured successfully! Combining with simulated canvas video stream.");
        
        // Generate mock video track
        const mockStream = createMockStream(username);
        const videoTrack = mockStream.getVideoTracks()[0];
        const audioTrack = audioStream.getAudioTracks()[0];
        
        const hybridStream = new MediaStream([videoTrack, audioTrack]);
        // Also copy the cancel/stop handlers to avoid leaks
        (hybridStream as any).stopMock = () => {
          if ((mockStream as any).stopMock) (mockStream as any).stopMock();
          audioTrack.stop();
        };
        
        return { stream: hybridStream, isMock: true, errorText: "تم تشغيل الصوت فقط لعدم توفر كاميرا" };
      } catch (audioErr) {
        console.warn("Audio-only fallback failed too, trying video-only with simulated audio...", audioErr);
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          console.log("Webcam captured successfully! Combining with simulated silent audio track.");
          
          const mockStream = createMockStream(username);
          const videoTrack = videoStream.getVideoTracks()[0];
          const audioTrack = mockStream.getAudioTracks()[0];
          
          const hybridStream = new MediaStream([videoTrack, audioTrack]);
          (hybridStream as any).stopMock = () => {
            if ((mockStream as any).stopMock) (mockStream as any).stopMock();
            videoTrack.stop();
          };
          
          return { stream: hybridStream, isMock: true, errorText: "تم تشغيل الكاميرا فقط لعدم توفر مايكروفون" };
        } catch (videoErr) {
          console.warn("Video-only fallback failure too. Reverting to full simulator.");
        }
      }
    }
    
    if (errStr.includes("permission") || errStr.includes("allowed") || errStr.includes("notallowed")) {
      errorText = "المايك والكاميرا مرفوضة أو غير مدعومة";
    } else if (errStr.includes("timeout")) {
      errorText = "انتهت مهلة تشغيل مصادر الفيديو والصوت (بيئة افتراضية)";
    }

    // return mock stream instantly to resume without lag
    const mock = createMockStream(username);
    return { stream: mock, isMock: true, errorText };
  }
}
