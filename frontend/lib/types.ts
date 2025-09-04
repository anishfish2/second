// /lib/types.ts
export type ETagPart = { PartNumber: number; ETag: string };

export type InitiateResponse = {
  uploadId: string;
  key: string;
  partSize: number;
  urls: string[];
};

export type SignChunkResponse = { key: string; url: string };

export type RecorderStatus =
  | "idle"
  | "starting"
  | "recording"
  | "stopping"
  | "finalizing"
  | "uploaded"
  | "error";
