// /hooks/useScreenRecorder.ts
import { useRef, useState } from "react";
import { createUploader, UploadController } from "@/lib/s3Uploader";
import { RecorderStatus } from "@/lib/types";

export function useScreenRecorder() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopFnRef = useRef<(() => Promise<void>) | null>(null);
  const uploaderRef = useRef<UploadController | null>(null);


  async function start(userId: string, finalKey: string) {
    try {
      setStatus("starting");
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });

      uploaderRef.current = await createUploader(userId, finalKey, "video/webm");

      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = async (e: BlobEvent) => {
        if (!e.data || e.data.size === 0) return;
        await uploaderRef.current?.pushChunk(e.data);
      };

      mr.onstart = () => setStatus("recording");
      mr.onstop = async () => {
        setStatus("finalizing");
        await uploaderRef.current?.stopAndFinalize();
        stream.getTracks().forEach((t) => t.stop());
        setStatus("uploaded");
      };

      mr.start(1000); // 1s timeslices
      setStatus("recording");
    } catch (err: any) {
      setError(err?.message || String(err));
      setStatus("error");
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      setStatus("stopping");
      recorderRef.current.stop();
    }
  }

  return { videoRef, status, error, start, stop };
}
