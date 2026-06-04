"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, ImageIcon, RotateCcw, Upload } from "lucide-react";

/** Downscale an image to ≤MAX_EDGE px on the longest side via <canvas>.
 *  Sub-second uploads on Tashkent 3G — and keeps us under Vercel's body limit. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.86;

async function downscale(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image decode failed"));
      i.src = url;
    });
    let { width, height } = img;
    if (width <= MAX_EDGE && height <= MAX_EDGE && file.size < 800 * 1024) {
      return file; // already small enough
    }
    const ratio = Math.min(MAX_EDGE / width, MAX_EDGE / height, 1);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", JPEG_QUALITY);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface Props {
  /** Called with the downscaled blob ready for upload — and the preview URL
   *  the caller can render in an <img>. */
  onReady: (blob: Blob, previewUrl: string) => void;
}

/** Drag-drop + camera-capture + file-picker upload zone. */
export function UploadZone({ onReady }: Props) {
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setWorking(true);
      try {
        const blob = await downscale(file);
        const previewUrl = URL.createObjectURL(blob);
        onReady(blob, previewUrl);
      } finally {
        setWorking(false);
      }
    },
    [onReady]
  );

  return (
    <div className="w-full">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith("image/")) {
            void handleFile(file);
          }
        }}
        className={
          "block w-full cursor-pointer rounded-[22px] border-2 border-dashed p-8 text-center transition-all " +
          (dragging
            ? "scale-[1.01] border-antares-500 bg-antares-50"
            : working
              ? "border-void-500 bg-void-800/40"
              : "border-void-500 hover:border-antares-500 hover:bg-void-800/40")
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-void-700">
          {working ? (
            <RotateCcw className="h-6 w-6 animate-spin text-void-200" />
          ) : (
            <ImageIcon className="h-7 w-7 text-void-200" />
          )}
        </div>
        <p className="mt-4 text-[15.5px] font-semibold text-void-100">
          {working ? "Rasm tayyorlanmoqda…" : "Rasm tashlang yoki tanlang"}
        </p>
        <p className="mt-1 text-[12.5px] text-void-300">PNG · JPG · WebP — 4 MB gacha</p>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={working}
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-void-500 text-[14px] font-semibold text-void-100 transition hover:border-void-400 hover:bg-void-800/40 active:scale-[0.98] disabled:opacity-40"
        >
          <Camera className="h-4 w-4" />
          Kamera
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={working}
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-void-500 text-[14px] font-semibold text-void-100 transition hover:border-void-400 hover:bg-void-800/40 active:scale-[0.98] disabled:opacity-40"
        >
          <Upload className="h-4 w-4" />
          Fayl
        </button>
      </div>
    </div>
  );
}
