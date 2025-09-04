// /lib/s3Uploader.ts
import { ETagPart, InitiateResponse } from "./types";
import { initiateUpload, completeUpload, signChunk, signPart } from "./multipartClient";

export type UploadController = {
  pushChunk: (chunk: Blob) => Promise<void>;
  stopAndFinalize: () => Promise<void>;
};

export async function createUploader(userId: string, finalKey: string, contentType = "video/webm") {
  // 1) Initiate (size unknown -> backend chooses default partSize)
  const init: InitiateResponse = await initiateUpload("recording.webm", 0, contentType, finalKey);

  // 2) Track multipart state
  let buffer: Blob[] = [];
  let bufferBytes = 0;
  let partNumber = 1;
  const etags: ETagPart[] = [];
  let seq = 1; // for live chunk objects
  const recordingId = crypto.randomUUID();

  async function flushIfReady(force = false) {
    if (!force && bufferBytes < init.partSize) return;
    if (bufferBytes === 0) return;

    const partBlob = new Blob(buffer, { type: contentType });
    buffer = [];
    bufferBytes = 0;

    const { url } = await signPart(init.key, init.uploadId, partNumber);



    const res = await fetch(url, { method: "PUT", body: partBlob });
    if (!res.ok) throw new Error(`Part ${partNumber} failed: ${res.status}`);
    const etag = res.headers.get("ETag");
    if (!etag) throw new Error(`Missing ETag for part ${partNumber} (check S3 CORS ExposeHeaders)`);

    etags.push({ PartNumber: partNumber, ETag: etag });
    partNumber++;
  }

  return {
    // called on every MediaRecorder dataavailable
    async pushChunk(chunk: Blob) {
      // (A) side-channel: upload mini-file for real-time processing
      console.log("signing da chunk")
      const live = await signChunk(userId, recordingId, seq++, "webm", contentType);
      console.log("fetching the live url")
      const put = await fetch(live.url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: chunk,
      });
      console.log("yuh i got here 1")
      if (!put.ok) throw new Error(`live chunk PUT failed: ${put.status}`);

      // (B) multipart aggregation
      buffer.push(chunk);
      console.log("yuh i got here 2")
      bufferBytes += chunk.size;
      await flushIfReady(false);
      console.log("yuh i got here 3")
    },

    // called when user clicks Stop
    async stopAndFinalize() {
      await flushIfReady(true); // flush last part (can be < 5 MiB)
      await completeUpload(init.key, init.uploadId, etags, userId);
    },
  } as UploadController;
}

