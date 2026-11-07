import type { JSONContent } from "@tiptap/core";
import katex from "katex";
import type { ReactNode } from "react";

function renderNode(node: JSONContent, key: string): ReactNode {
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "equation" || node.type === "equationBlock") {
    const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex : "";
    try {
      const markup = katex.renderToString(latex, { displayMode: node.type === "equationBlock", throwOnError: false, trust: false, output: "htmlAndMathml" });
      return <span key={key} style={{ display: node.type === "equationBlock" ? "block" : "inline", maxWidth: "100%", overflowX: "auto" }} dangerouslySetInnerHTML={{ __html: markup }} />;
    } catch { return <span key={key}>{latex}</span>; }
  }
  const children = (node.content || []).map((item, index) => renderNode(item, `${key}-${index}`));
  if (node.type === "paragraph") return <span key={key} style={{ display: "block" }}>{children}</span>;
  if (node.type === "doc") return <>{children}</>;
  return null;
}

export default function StructuredQuestionContent({ content }: { content: JSONContent }) {
  return <>{renderNode(content, "root")}</>;
}
