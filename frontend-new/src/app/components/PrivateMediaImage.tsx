"use client";

import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { fetchPrivateMedia } from "@/lib/apiClient";

export default function PrivateMediaImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  const [result, setResult] = useState<{ src: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!src.startsWith("/api/question-banks/media/")) return;
    let active = true;
    let objectUrl: string | null = null;
    void fetchPrivateMedia(src).then(response => {
      if (!response.ok) throw new Error("Gambar tidak tersedia");
      return response.blob();
    }).then(blob => {
      if (active) { objectUrl = URL.createObjectURL(blob); setResult({ src, url: objectUrl }); }
    }).catch(() => { if (active) setResult({ src, url: null }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  if (!src.startsWith("/api/question-banks/media/")) return <img src={src} alt={alt} {...props} />;
  if (!result || result.src !== src) return <span role="status">Memuat gambar…</span>;
  if (!result.url) return <span role="status">Gambar tidak dapat dimuat.</span>;
  return <img src={result.url} alt={alt} {...props} />;
}
