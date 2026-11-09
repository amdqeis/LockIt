"use client";
import { MotionButton } from "@/components/MotionButton";

import { Extension, Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import HardBreak from "@tiptap/extension-hard-break";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { history, redo, undo } from "@tiptap/pm/history";
import { keymap } from "@tiptap/pm/keymap";

export interface MathwaySymbol {
  label: string;
  latex: string;
  title: string;
}

export const mathwayGroups: { name: string; symbols: MathwaySymbol[] }[] = [
  {
    name: "Dasar",
    symbols: [
      { label: "a/b", latex: "\\frac{#?}{#?}", title: "Pecahan" },
      { label: "x²", latex: "{#?}^{2}", title: "Kuadrat" },
      { label: "xⁿ", latex: "{#?}^{#?}", title: "Pangkat" },
      { label: "xₙ", latex: "{#?}_{#?}", title: "Subskrip / Indeks" },
      { label: "√x", latex: "\\sqrt{#?}", title: "Akar kuadrat" },
      { label: "ⁿ√x", latex: "\\sqrt[#?]{#?}", title: "Akar pangkat n" },
    ],
  },
  {
    name: "Operator",
    symbols: [
      { label: "±", latex: "\\pm", title: "Plus-minus" },
      { label: "×", latex: "\\times", title: "Perkalian" },
      { label: "÷", latex: "\\div", title: "Pembagian" },
      { label: "≤", latex: "\\le", title: "Kurang dari sama dengan" },
      { label: "≥", latex: "\\ge", title: "Lebih dari sama dengan" },
      { label: "≠", latex: "\\neq", title: "Tidak sama dengan" },
      { label: "≈", latex: "\\approx", title: "Mendekati / kira-kira" },
    ],
  },
  {
    name: "Simbol & Yunani",
    symbols: [
      { label: "π", latex: "\\pi", title: "Pi" },
      { label: "θ", latex: "\\theta", title: "Theta" },
      { label: "α", latex: "\\alpha", title: "Alpha" },
      { label: "β", latex: "\\beta", title: "Beta" },
      { label: "∞", latex: "\\infty", title: "Tak hingga" },
    ],
  },
  {
    name: "Aljabar & Kalkulus",
    symbols: [
      { label: "∫", latex: "\\int_{#?}^{#?}#?", title: "Integral" },
      { label: "∑", latex: "\\sum_{#?}^{#?}#?", title: "Sigma / Penjumlahan" },
      { label: "lim", latex: "\\lim_{#?}#?", title: "Limit" },
      { label: "log", latex: "\\log", title: "Logaritma" },
      { label: "ln", latex: "\\ln", title: "Logaritma natural" },
      { label: "|x|", latex: "|#?|", title: "Nilai mutlak" },
    ],
  },
  {
    name: "Kurung & Matriks",
    symbols: [
      { label: "(x)", latex: "\\left(#?\\right)", title: "Kurung biasa" },
      { label: "[x]", latex: "\\left[#?\\right]", title: "Kurung siku" },
      { label: "{x}", latex: "\\left\\{#?\\right\\}", title: "Kurung kurawal" },
      { label: "[2×2]", latex: "\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}", title: "Matriks 2x2" },
    ],
  },
];

function EquationNodeView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const container = useRef<HTMLSpanElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const updateRef = useRef(updateAttributes);
  const latexRef = useRef(node.attrs.latex || "");
  useEffect(() => { updateRef.current = updateAttributes; }, [updateAttributes]);
  useEffect(() => { latexRef.current = node.attrs.latex || ""; }, [node.attrs.latex]);
  const [advanced, setAdvanced] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  useEffect(() => {
    let active = true;
    let element: MathfieldElement | null = null;
    const onInput = () => { if (element) updateRef.current({ latex: element.value }); };
    const onMoveOut = (event: Event) => {
      const direction = (event as CustomEvent<{ direction: string }>).detail.direction;
      if (direction !== "forward" && direction !== "backward") return;
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (pos === undefined) return;
      event.preventDefault();
      editor.commands.focus(direction === "forward" ? pos + node.nodeSize : pos);
    };
    import("mathlive").then(({ MathfieldElement }) => {
      if (!active || !container.current) return;
      MathfieldElement.fontsDirectory = "/mathlive-fonts";
      element = document.createElement("math-field") as MathfieldElement;
      element.setAttribute("aria-label", "Persamaan matematika");
      element.setAttribute("math-virtual-keyboard-policy", "manual");
      element.value = latexRef.current;
      element.addEventListener("input", onInput);
      element.addEventListener("move-out", onMoveOut);
      container.current.appendChild(element);
      field.current = element;
    });
    return () => { active = false; element?.removeEventListener("input", onInput); element?.removeEventListener("move-out", onMoveOut); element?.remove(); field.current = null; };
  }, [editor, getPos, node.nodeSize]);

  useEffect(() => {
    if (field.current && field.current.value !== (node.attrs.latex || "")) {
      field.current.setValue(node.attrs.latex || "", { silenceNotifications: true });
    }
  }, [node.attrs.latex]);

  const insertSymbol = (latex: string) => {
    field.current?.executeCommand(["insert", latex, { selectionMode: "placeholder" }]);
    field.current?.focus();
  };

  return (
    <NodeViewWrapper as={node.type.name === "equationBlock" ? "div" : "span"} className="equation-node" contentEditable={false}>
      <span className="equation-caption">Persamaan</span>
      <span ref={container} />

      <div className="mathway-ribbon">
        <div className="mathway-tabs" role="tablist">
          {mathwayGroups.map((g, idx) => (
            <MotionButton
              key={g.name}
              type="button"
              className={`mathway-tab-btn ${activeGroupIndex === idx ? "active" : ""}`}
              onClick={() => setActiveGroupIndex(idx)}
              role="tab"
              aria-selected={activeGroupIndex === idx}
            >
              {g.name}
            </MotionButton>
          ))}
          <MotionButton
            type="button"
            className={`mathway-tab-btn ${advanced ? "active" : ""}`}
            onClick={() => setAdvanced(!advanced)}
            aria-expanded={advanced}
          >
            LaTeX
          </MotionButton>
        </div>

        <div className="mathway-symbols">
          {mathwayGroups[activeGroupIndex]?.symbols.map((s) => (
            <MotionButton
              type="button"
              key={s.label}
              className="mathway-symbol-btn"
              title={s.title}
              aria-label={s.title}
              onClick={() => insertSymbol(s.latex)}
            >
              {s.label}
            </MotionButton>
          ))}
        </div>
      </div>

      {advanced && (
        <label className="equation-advanced">
          LaTeX{" "}
          <input
            value={node.attrs.latex || ""}
            onChange={(e) => {
              updateAttributes({ latex: e.target.value });
              field.current?.setValue(e.target.value, { silenceNotifications: true });
            }}
          />
        </label>
      )}
    </NodeViewWrapper>
  );
}

const Equation = Node.create({
  name: "equation", group: "inline", inline: true, atom: true,
  addAttributes() { return { latex: { default: "" } }; },
  parseHTML() { return [{ tag: "span[data-equation]" }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes(HTMLAttributes, { "data-equation": "" })]; },
  addNodeView() { return ReactNodeViewRenderer(EquationNodeView, { stopEvent: ({ event }) => (event.target as HTMLElement).closest("math-field, button, input") !== null }); },
  addKeyboardShortcuts() { return { "Alt-=": () => this.editor.commands.insertContent({ type: "equation", attrs: { latex: "" } }) }; },
});
const EquationBlock = Equation.extend({ name: "equationBlock", group: "block", inline: false, addKeyboardShortcuts() { return {}; } });
const History = Extension.create({ name: "history", addProseMirrorPlugins() { return [history(), keymap({ "Mod-z": undo, "Mod-Shift-z": redo, "Mod-y": redo })]; } });

export function docToText(node: JSONContent): string {
  if (node.type === "equation" || node.type === "equationBlock") return node.type === "equationBlock" ? `$$${String(node.attrs?.latex || "")}$$` : `$${String(node.attrs?.latex || "")}$`;
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  const parts = (node.content || []).map(docToText);
  return parts.join(node.type === "doc" ? "\n" : "");
}

export default function EquationEditor({ value, onChange, label, disabled = false }: { value: JSONContent; onChange: (doc: JSONContent) => void; label: string; disabled?: boolean }) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [Document, Paragraph, Text, HardBreak, History, Equation, EquationBlock],
    content: value,
    editorProps: { attributes: { "aria-label": label, class: "equation-prose", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: current }) => onChangeRef.current(current.getJSON()),
  });
  useEffect(() => { if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value, { emitUpdate: false }); }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);

  return (
    <div className="equation-editor">
      <div className="equation-editor-toolbar">
        <MotionButton
          type="button"
          disabled={disabled}
          className="equation-icon-btn"
          title="Sisipkan persamaan inline (Alt+=)"
          aria-label="Sisipkan persamaan inline"
          onClick={() => editor?.chain().focus().insertContent({ type: "equation", attrs: { latex: "" } }).run()}
        >
          √x
        </MotionButton>
        <MotionButton
          type="button"
          disabled={disabled}
          className="equation-icon-btn"
          title="Sisipkan persamaan blok"
          aria-label="Sisipkan persamaan blok"
          onClick={() => editor?.chain().focus().insertContent({ type: "equationBlock", attrs: { latex: "" } }).run()}
        >
          ∑
        </MotionButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
