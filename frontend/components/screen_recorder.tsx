// 'use client'
// import React, { useRef, useState } from 'react';
// const ScreenRecorder = () => {
//
//   const screenRecording = useRef<HTMLVideoElement>(null);
//
//   const [Recorder, setRecorder] = useState<MediaRecorder | null>(null);
//   const [displayMedia, setDisplayMedia] = useState<MediaStreamTrack | null>(null);
//   const startScreenRecording = async () => {
//     const stream = await navigator.mediaDevices.getDisplayMedia({
//       audio: true, video: true
//     });
//     const recorder = new MediaRecorder(stream);
//     setRecorder(recorder);
//     setDisplayMedia(stream.getVideoTracks()[0]);
//     const screenRecordingChunks: Blob[] = [];
//     recorder.ondataavailable = (e) => {
//       if (e.data.size > 0) {
//         screenRecordingChunks.push(e.data);
//       }
//     }
//     recorder.onstop = () => {
//       const blob = new Blob(screenRecordingChunks,
//         { type: 'video/webm' });
//       const url = URL.createObjectURL(blob);
//       if (screenRecording.current) {
//         screenRecording.current.src = url;
//       }
//       if (displayMedia) {
//         displayMedia.stop();
//       }
//     }
//     recorder.start();
//   }
//   const ButtonStyle = {
//     backgroundColor: 'green',
//     color: 'white',
//     fontSize: '2em',
//   };
//
//   return (
//     <>
//       <button style={ButtonStyle} onClick={() =>
//         startScreenRecording()}>
//         Start Recording
//       </button>
//       <button style={ButtonStyle} onClick={() => { Recorder && Recorder.stop() }}>
//         Stop Recording
//       </button>
//       <br /><br /><br />
//       <video ref={screenRecording}
//         height={300}
//         width={600} controls />
//     </>
//   );
// };
// export default ScreenRecorder;
//


"use client";
import { useScreenRecorder } from "@/hooks/useScreenRecorder";

export default function ScreenRecorder() {
  const { videoRef, status, error, start, stop } = useScreenRecorder();
  const userId = "user-123"; // plug in your auth/actual user id
  const finalKey = `users/${userId}/finished/recording-${new Date().toISOString()}/recording.webm`;

  return (
    <div className="p-4 space-y-3">
      <div className="space-x-2">
        <button onClick={() => start(userId, finalKey)} disabled={status === "recording"} className="px-3 py-2 bg-black text-white rounded">
          {status === "starting" ? "Starting…" : "Start Recording"}
        </button>
        <button onClick={stop} disabled={status !== "recording"} className="px-3 py-2 bg-gray-200 rounded">
          Stop & Upload
        </button>
      </div>

      <div className="text-sm">
        <div>Status: {status}</div>
        {error && <div className="text-red-600">{error}</div>}
      </div>

      <video ref={videoRef} width={720} height={405} controls className="border rounded" />
    </div>
  );
}

