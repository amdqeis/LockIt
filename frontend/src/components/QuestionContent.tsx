"use client";

import katex from "katex";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type Node = { type?: string; text?: string; attrs?: { latex?: string }; content?: Node[] };

function MathText({ latex, block = false }: { latex: string; block?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const hintId = useId();
  const [overflow, setOverflow] = useState(false);
  let html: string;
  try { html = katex.renderToString(latex, { displayMode: block, throwOnError: false, trust: false, output: "htmlAndMathml", maxExpand: 1000 }); }
  catch { html = ""; }
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let active = true;
    const check = () => { if (active) setOverflow(element.scrollWidth > element.clientWidth + 4); };
    const frame = requestAnimationFrame(check);
    const observer = new ResizeObserver(check);
    observer.observe(element);
    void document.fonts.ready.then(check);
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [latex, block]);
  if (!html) return <code>{latex}</code>;
  return <span className={block ? "math-wrapper math-wrapper-block" : "math-wrapper"}>
    <span ref={ref} className={block ? "math math-block" : "math"} tabIndex={overflow ? 0 : undefined} aria-describedby={overflow ? hintId : undefined} dangerouslySetInnerHTML={{ __html: html }} />
    {overflow && <small id={hintId} className="math-hint">Geser untuk melihat persamaan</small>}
  </span>;
}

function renderText(text: string): ReactNode[] {
  const parts = text.replace(/<\/?(?:p|br|div|span|strong|b|em|i|u|sub|sup|ul|ol|li|h[1-6])(?:\s[^>]*)?\s*\/?>/gi, " ").split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g);
  return parts.map((part, index) => {
    const block = (part.startsWith("$$") && part.endsWith("$$")) || (part.startsWith("\\[") && part.endsWith("\\]"));
    const inline = (part.startsWith("$") && part.endsWith("$")) || (part.startsWith("\\(") && part.endsWith("\\)"));
    if (block) return <MathText key={index} latex={part.slice(2, -2)} block />;
    if (inline) return <MathText key={index} latex={part.startsWith("$") ? part.slice(1, -1) : part.slice(2, -2)} />;
    return part;
  });
}

function nodeContent(node: Node, key: string): ReactNode {
  if (node.type === "text") return <span key={key}>{renderText(node.text || "")}</span>;
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "equation" || node.type === "equationBlock") return <MathText key={key} latex={node.attrs?.latex || ""} block={node.type === "equationBlock"} />;
  const children = (node.content || []).map((child, index) => nodeContent(child, `${key}-${index}`));
  return node.type === "doc" ? <span key={key}>{children}</span> : <span className="content-line" key={key}>{children.length ? children : "\u00a0"}</span>;
}

function ImageContent({ src, alt }: { src: string; alt?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!/^(https?:\/\/|\/api\/question-banks\/media\/|\/uploads\/exams\/)/i.test(src)) return <span className="media-error">Alamat gambar tidak didukung.</span>;
  if (failed) return <span className="media-error" role="status">Gambar tidak dapat dimuat. Hubungi pengawas.</span>;
  // Images may be authenticated same-origin media or existing external exam images.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="question-image" src={src} alt={alt || "Gambar pada soal"} loading="lazy" onError={() => setFailed(true)} />;
}

export function QuestionContent({ content, text, imageUrl, imageAlt }: { content?: unknown; text?: string | null; imageUrl?: string | null; imageAlt?: string | null }) {
  const node = content && typeof content === "object" && !Array.isArray(content) ? content as Node : null;
  return <span className="question-content">{node?.content?.length ? nodeContent(node, "root") : renderText(text || "")}{imageUrl && <ImageContent src={imageUrl} alt={imageAlt} />}</span>;
}
