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
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: options.video,
      audio: options.audio
    });
    return { stream, isMock: false };
  } catch (error) {
    console.error("Camera/Mic access denied or missing. Activating Canvas emulation:", error);
    // return mock stream
    const mock = createMockStream(username);
    return { stream: mock, isMock: true };
  }
}
