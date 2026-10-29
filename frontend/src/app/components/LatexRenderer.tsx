"use client";

import { useEffect, useRef, useState } from "react";
import { formatNaturalMath } from "@/lib/naturalMath";

interface Props {
  text: string;
  block?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Stable LaTeX renderer using KaTeX (installed as npm package).
 *
 * Design goals:
 * - ZERO flash of raw LaTeX strings — element starts empty, KaTeX fills it
 * - Never blank when navigating between questions (cancel-safe async render)
 * - Supports inline math $...$ and display math $$...$$
 * - Falls back gracefully to plain text if KaTeX fails
 * - Newlines in plain-text segments are preserved as <br>
 *
 * How the "disappearing math" bug is fixed:
 * - We do NOT pre-render raw text into children (avoids flash of "$f(x)$" strings)
 * - We build a DocumentFragment entirely offline, then swap in ONE atomic operation
 * - If the component unmounts mid-flight (quick question navigation), cancelRef
 *   stops the swap — preventing blank state from a stale update
 * - KaTeX CSS is injected via CDN link tag once, lazily
 */
export default function LatexRenderer({ text, block = false, style, className }: Props) {
  const ref = useRef<HTMLElement>(null);
  // Tracks whether the current effect is still live (not cancelled by unmount)
  const cancelRef = useRef(false);
  // Tracks whether we've rendered at least once (for SSR-safe empty start)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    cancelRef.current = false;

    // Inject KaTeX CSS once if not already present
    if (!document.getElementById("katex-css")) {
      const link = document.createElement("link");
      link.id = "katex-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
      document.head.appendChild(link);
    }

    // Split text into segments: $$...$$, $...$, and plain text
    const processedText = formatNaturalMath(text);
    const segments = processedText.split(/((?:\$\$[\s\S]+?\$\$)|(?:\$[^$\n]+?\$))/g);

    // Check if we even have any math — skip KaTeX import for pure text
    const hasMath = segments.some(
      (s) => (s.startsWith("$$") && s.endsWith("$$")) || (s.startsWith("$") && s.endsWith("$"))
    );

    if (!hasMath) {
      // Pure text — render synchronously, no flash
      if (ref.current) {
        ref.current.innerHTML = "";
        renderTextSegments(segments, ref.current);
      }
      return;
    }

    // Async KaTeX import — built into project via npm (no CDN download needed)
    import("katex")
      .then(({ default: katex }) => {
        // Component was unmounted while we were waiting — abort
        if (cancelRef.current || !ref.current) return;

        // Build entirely offline into a fragment — never touches the live DOM until ready
        const frag = document.createDocumentFragment();

        for (const segment of segments) {
          if (segment.startsWith("$$") && segment.endsWith("$$")) {
            const math = segment.slice(2, -2);
            const wrapper = document.createElement("div");
            wrapper.style.overflowX = "auto";
            wrapper.style.overflowY = "hidden";
            wrapper.style.margin = "12px 0";
            wrapper.style.maxWidth = "100%";
            try {
              katex.render(math, wrapper, {
                displayMode: true,
                throwOnError: false,
                output: "htmlAndMathml",
                trust: false,
              });
            } catch {
              wrapper.textContent = segment;
            }
            frag.appendChild(wrapper);
          } else if (segment.startsWith("$") && segment.endsWith("$")) {
            const math = segment.slice(1, -1);
            const span = document.createElement("span");
            span.style.display = "inline";
            try {
              katex.render(math, span, {
                displayMode: false,
                throwOnError: false,
                output: "htmlAndMathml",
                trust: false,
              });
            } catch {
              span.textContent = segment;
            }
            frag.appendChild(span);
          } else if (segment) {
            appendTextWithBreaks(segment, frag);
          }
        }

        // One atomic swap — never leaves element blank
        if (!cancelRef.current && ref.current) {
          ref.current.innerHTML = "";
          ref.current.appendChild(frag);
        }
      })
      .catch(() => {
        // KaTeX unavailable — fall back to raw text without clearing existing content
        if (!cancelRef.current && ref.current) {
          ref.current.textContent = text;
        }
      });

    return () => {
      cancelRef.current = true;
    };
  }, [text, mounted]);

  const Tag = block ? "div" : "span";

  // On the server and on first client paint, render empty so there's no flash of raw LaTeX.
  // KaTeX will fill the element synchronously/asynchronously after mount.
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement & HTMLSpanElement>}
      style={style}
      className={className}
      suppressHydrationWarning
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderTextSegments(segments: string[], container: HTMLElement) {
  for (const segment of segments) {
    if (segment) {
      appendTextWithBreaks(segment, container);
    }
  }
}

function appendTextWithBreaks(text: string, container: Node) {
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    container.appendChild(document.createTextNode(line));
    if (i < lines.length - 1) {
      container.appendChild(document.createElement("br"));
    }
  });
}
