// /lib/multipartClient.ts
import { InitiateResponse, SignChunkResponse, ETagPart } from "./types";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function initiateUpload(filename: string, size: number, contentType: string, desiredKey: string, userId: string) {
  console.log("initiateUpload", filename, size, contentType, userId);
  const r = await fetch(`${API}/api/upload/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, size, contentType: contentType, desiredKey: desiredKey, userId: userId }),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as InitiateResponse;
}

export async function completeUpload(key: string, uploadId: string, parts: ETagPart[], userId?: string) {
  const r = await fetch(`${API}/api/upload/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, uploadId, parts, userId: userId ?? "unknown" }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function signChunk(userId: string, recordingId: string, seq: number, ext = "webm", contentType?: string) {
  const r = await fetch(`${API}/api/upload/sign-chunk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },   // FIX
    body: JSON.stringify({ userId, recordingId, seq, ext, contentType: contentType }),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as SignChunkResponse;
}

export async function signPart(key: string, uploadId: string, partNumber: number) {
  const r = await fetch(`${API}/api/upload/sign-part`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },   // FIX
    body: JSON.stringify({ key, uploadId, partNumber }),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as { url: string };
}
