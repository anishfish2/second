"use client";

import Image from "next/image";
import ScreenRecorder from "../components/screen_recorder";

const initiateUpload = async (file: File) => {
  const response = await fetch('http://localhost:8000/api/upload/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type,
      size: file.size
    })
  })

  const { uploadId, Key, partSize, Urls } = await response.json();
  return { uploadId, Key, partSize, Urls };

}

const completeUpload = async (Key: string, uploadId: string, etags: any[]) => {
  const response = await fetch('http://localhost:8000/api/upload/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Key: Key,
      uploadId: uploadId,
      Parts: etags,
    })
  })
}


function makeParts(file: File, partSize: number) {
  const total = Math.ceil(file.size / partSize);
  const parts = [];
  for (let i = 0; i < total; i++) {
    const start = i * partSize;
    const end = Math.min(start + partSize, file.size);
    parts.push({ number: i + 1, blob: file.slice(start, end) });
  }
  return parts;
}

const handleUpload = async () => {
  const fileInput = document.getElementById('videoInput') as HTMLInputElement;
  if (fileInput.files) {
    const selectedFile = fileInput.files[0];
    const { uploadId, Key, partSize, Urls } = await initiateUpload(selectedFile);


    const parts = makeParts(selectedFile, partSize);


    const etags: { PartNumber: number; ETag: string }[] = [];
    for (const part of parts) {
      const url = Urls[part.number - 1];           // each item is a string URL
      if (!url) throw new Error(`No URL for part ${part.number}`);

      const res = await fetch(url, { method: "PUT", body: part.blob });
      if (!res.ok) throw new Error(`Part ${part.number} failed: ${res.status}`);

      const etag = res.headers.get("ETag");
      if (!etag) throw new Error(`Missing ETag for part ${part.number}`);

      etags.push({ PartNumber: part.number, ETag: etag });
    }

    await completeUpload(Key, uploadId, etags);
  }
}



export default function Home() {
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <div>
        <input type="file" id="videoInput" accept="video/*" />
        <button onClick={handleUpload}>Upload</button>
      </div>
      <ScreenRecorder />
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] font-mono font-semibold px-1 py-0.5 rounded">
              app/page.tsx
            </code>
            .
          </li>
          <li className="tracking-[-.01em]">
            Save and see your changes instantly.
          </li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
