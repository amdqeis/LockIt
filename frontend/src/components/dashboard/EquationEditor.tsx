"use client";

import { Extension, Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
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

  useEffect(() => {
    updateRef.current = updateAttributes;
  }, [updateAttributes]);

  useEffect(() => {
    latexRef.current = node.attrs.latex || "";
  }, [node.attrs.latex]);

  useEffect(() => {
    let active = true;
    let element: MathfieldElement | null = null;
    const onInput = () => {
      if (element) updateRef.current({ latex: element.value });
    };
    const onMoveOut = (event: Event) => {
      const direction = (event as CustomEvent<{ direction: string }>).detail.direction;
      if (direction !== "forward" && direction !== "backward") return;
      const pos = typeof getPos === "function" ? getPos() : undefined;
      if (pos === undefined) return;
      event.preventDefault();
      editor.commands.focus(direction === "forward" ? pos + node.nodeSize : pos);
    };
    const onFocus = () => {
      if (typeof window !== "undefined") {
        (window as unknown as { __lastFocusedMathfield?: MathfieldElement | null }).__lastFocusedMathfield = element;
      }
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
      element.addEventListener("focus", onFocus);
      element.addEventListener("focusin", onFocus);
      container.current.appendChild(element);
      field.current = element;

      if (!latexRef.current) {
        setTimeout(() => {
          element?.focus();
        }, 40);
      }
    });

    return () => {
      active = false;
      element?.removeEventListener("input", onInput);
      element?.removeEventListener("move-out", onMoveOut);
      element?.removeEventListener("focus", onFocus);
      element?.removeEventListener("focusin", onFocus);
      if (
        typeof window !== "undefined" &&
        (window as unknown as { __lastFocusedMathfield?: MathfieldElement | null }).__lastFocusedMathfield === element
      ) {
        (window as unknown as { __lastFocusedMathfield?: MathfieldElement | null }).__lastFocusedMathfield = null;
      }
      element?.remove();
      field.current = null;
    };
  }, [editor, getPos, node.nodeSize]);

  useEffect(() => {
    if (field.current && field.current.value !== (node.attrs.latex || "")) {
      field.current.setValue(node.attrs.latex || "", { silenceNotifications: true });
    }
  }, [node.attrs.latex]);

  const isBlock = node.type.name === "equationBlock";

  return (
    <NodeViewWrapper
      as={isBlock ? "div" : "span"}
      className={`equation-math-box ${isBlock ? "is-block" : "is-inline"}`}
      contentEditable={false}
    >
      <span ref={container} className="equation-math-container" />
    </NodeViewWrapper>
  );
}

const Equation = Node.create({
  name: "equation",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span[data-equation]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-equation": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(EquationNodeView, {
      stopEvent: ({ event }) => (event.target as HTMLElement).closest("math-field, button, input") !== null,
    });
  },
  addKeyboardShortcuts() {
    return {
      "Alt-=": () => this.editor.commands.insertContent({ type: "equation", attrs: { latex: "" } }),
    };
  },
});

const EquationBlock = Equation.extend({
  name: "equationBlock",
  group: "block",
  inline: false,
  addKeyboardShortcuts() {
    return {};
  },
});

const History = Extension.create({
  name: "customHistory",
  addProseMirrorPlugins() {
    return [history(), keymap({ "Mod-z": undo, "Mod-Shift-z": redo, "Mod-y": redo })];
  },
});

export function docToText(node: JSONContent): string {
  if (node.type === "equation" || node.type === "equationBlock") {
    return node.type === "equationBlock"
      ? `$$${String(node.attrs?.latex || "")}$$`
      : `$${String(node.attrs?.latex || "")}$`;
  }
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  const parts = (node.content || []).map(docToText);
  if (node.type === "doc" || node.type === "bulletList" || node.type === "orderedList") {
    return parts.join("\n");
  }
  if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
    return parts.join("");
  }
  return parts.join("\n");
}

export default function EquationEditor({
  value,
  onChange,
  label,
  disabled = false,
  onImageClick,
}: {
  value: JSONContent;
  onChange: (doc: JSONContent) => void;
  label: string;
  disabled?: boolean;
  onImageClick?: () => void;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [showRibbon, setShowRibbon] = useState(false);
  const [showLatexTab, setShowLatexTab] = useState(false);
  const [latexInput, setLatexInput] = useState("");
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        undoRedo: false,
      }),
      Underline,
      History,
      Equation,
      EquationBlock,
    ],
    content: value,
    editorProps: {
      attributes: {
        "aria-label": label,
        class: "equation-prose",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: current }) => onChangeRef.current(current.getJSON()),
  });

  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

  const insertSymbolDirectly = (latex: string) => {
    editor?.chain().focus().insertContent({ type: "equation", attrs: { latex } }).run();
  };

  const handleInsertSymbol = (latex: string) => {
    if (typeof window !== "undefined") {
      const lastFocused = (window as unknown as { __lastFocusedMathfield?: MathfieldElement | null }).__lastFocusedMathfield;
      if (lastFocused && document.body.contains(lastFocused)) {
        lastFocused.executeCommand(["insert", latex, { selectionMode: "placeholder" }]);
        lastFocused.focus();
        return;
      }
    }
    insertSymbolDirectly(latex);
  };

  const toggleVirtualKeyboard = () => {
    import("mathlive").then(() => {
      if (typeof window !== "undefined" && window.mathVirtualKeyboard) {
        if (window.mathVirtualKeyboard.visible) {
          window.mathVirtualKeyboard.hide();
        } else {
          window.mathVirtualKeyboard.show();
        }
      }
    });
  };

  return (
    <div className="bank-editor-shell">
      {/* Integrated WYSIWYG & Math Toolbar matching user mockup */}
      <div className="bank-editor-toolbar" role="toolbar" aria-label="Toolbar editor pertanyaan">
        {/* Format Dropdown */}
        <select
          className="bank-toolbar-select"
          value={
            editor?.isActive("heading", { level: 2 })
              ? "h2"
              : editor?.isActive("heading", { level: 3 })
              ? "h3"
              : "paragraph"
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === "h2") editor?.chain().focus().toggleHeading({ level: 2 }).run();
            else if (val === "h3") editor?.chain().focus().toggleHeading({ level: 3 }).run();
            else editor?.chain().focus().setParagraph().run();
          }}
          disabled={disabled}
        >
          <option value="paragraph">Paragraf</option>
          <option value="h2">Judul 2</option>
          <option value="h3">Judul 3</option>
        </select>

        <span className="bank-toolbar-divider" aria-hidden="true" />

        {/* Text Styling: B, I, U */}
        <button
          type="button"
          disabled={disabled}
          className={`bank-toolbar-btn ${editor?.isActive("bold") ? "active" : ""}`}
          title="Tebal (Ctrl+B)"
          aria-label="Tebal"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          disabled={disabled}
          className={`bank-toolbar-btn ${editor?.isActive("italic") ? "active" : ""}`}
          title="Miring (Ctrl+I)"
          aria-label="Miring"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </button>

        <button
          type="button"
          disabled={disabled}
          className={`bank-toolbar-btn ${editor?.isActive("underline") ? "active" : ""}`}
          title="Garis Bawah (Ctrl+U)"
          aria-label="Garis Bawah"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </button>

        <span className="bank-toolbar-divider" aria-hidden="true" />

        {/* Lists */}
        <button
          type="button"
          disabled={disabled}
          className={`bank-toolbar-btn ${editor?.isActive("bulletList") ? "active" : ""}`}
          title="Daftar Poin"
          aria-label="Daftar Poin"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <circle cx="3.5" cy="6" r="1.5" fill="currentColor" />
            <circle cx="3.5" cy="12" r="1.5" fill="currentColor" />
            <circle cx="3.5" cy="18" r="1.5" fill="currentColor" />
          </svg>
        </button>

        <button
          type="button"
          disabled={disabled}
          className={`bank-toolbar-btn ${editor?.isActive("orderedList") ? "active" : ""}`}
          title="Daftar Bernomor"
          aria-label="Daftar Bernomor"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <path d="M4 6h2M5 6v6m-1 0h2m-2 6h2" />
          </svg>
        </button>

        <span className="bank-toolbar-divider" aria-hidden="true" />

        {/* Image Attachment Button */}
        {onImageClick && (
          <button
            type="button"
            disabled={disabled}
            className="bank-toolbar-btn"
            title="Sisipkan Gambar"
            aria-label="Sisipkan Gambar"
            onClick={onImageClick}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
        )}

        {/* Equation Mode: Klik tombol Eq langsung memunculkan box persamaan inline di teks */}
        <button
          type="button"
          disabled={disabled}
          className={`bank-toolbar-btn ${showRibbon && !showLatexTab ? "active" : ""}`}
          title="Sisipkan persamaan matematika inline (Eq)"
          aria-label="Persamaan Matematika"
          onClick={() => {
            setShowRibbon(true);
            setShowLatexTab(false);
            editor?.chain().focus().insertContent({ type: "equation", attrs: { latex: "" } }).run();
          }}
          style={{ fontWeight: 700 }}
        >
          Eq
        </button>

        {/* Simbol Keyboard (sejajar dengan icon Eq) */}
        <button
          type="button"
          disabled={disabled}
          className="bank-toolbar-btn"
          title="Papan Ketik Matematika (Virtual Keyboard)"
          aria-label="Papan Ketik Matematika"
          onClick={toggleVirtualKeyboard}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
            <line x1="6" y1="8" x2="6.01" y2="8" />
            <line x1="10" y1="8" x2="10.01" y2="8" />
            <line x1="14" y1="8" x2="14.01" y2="8" />
            <line x1="18" y1="8" x2="18.01" y2="8" />
            <line x1="6" y1="12" x2="6.01" y2="12" />
            <line x1="10" y1="12" x2="10.01" y2="12" />
            <line x1="14" y1="12" x2="14.01" y2="12" />
            <line x1="18" y1="12" x2="18.01" y2="12" />
            <line x1="7" y1="16" x2="17" y2="16" />
          </svg>
        </button>

        {/* Simbol Garis Tiga (sejajar dengan icon Eq) */}
        <button
          type="button"
          disabled={disabled}
          className={`bank-toolbar-btn ${showRibbon && showLatexTab ? "active" : ""}`}
          title="Menu Rumus / LaTeX"
          aria-label="Menu Rumus"
          onClick={() => {
            if (showRibbon && showLatexTab) {
              setShowRibbon(false);
              setShowLatexTab(false);
            } else {
              setShowRibbon(true);
              setShowLatexTab(true);
            }
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Compact Insert Buttons (also preserves Playwright selector compatibility) */}
        <button
          type="button"
          disabled={disabled}
          className="equation-icon-btn"
          title="Sisipkan persamaan inline (Alt+=)"
          aria-label="Sisipkan persamaan inline"
          onClick={() => editor?.chain().focus().insertContent({ type: "equation", attrs: { latex: "" } }).run()}
        >
          √x
        </button>
        <button
          type="button"
          disabled={disabled}
          className="equation-icon-btn"
          title="Sisipkan persamaan blok"
          aria-label="Sisipkan persamaan blok"
          onClick={() => editor?.chain().focus().insertContent({ type: "equationBlock", attrs: { latex: "" } }).run()}
        >
          ∑
        </button>
      </div>

      {/* Visual Mathway Formula Ribbon when Eq is active */}
      {showRibbon && (
        <div className="mathway-ribbon" style={{ margin: "4px 8px 8px" }}>
          <div className="mathway-tabs" role="tablist">
            {mathwayGroups.map((g, idx) => (
              <button
                key={g.name}
                type="button"
                className={`mathway-tab-btn ${activeGroupIndex === idx && !showLatexTab ? "active" : ""}`}
                onClick={() => {
                  setActiveGroupIndex(idx);
                  setShowLatexTab(false);
                }}
                role="tab"
                aria-selected={activeGroupIndex === idx && !showLatexTab}
              >
                {g.name}
              </button>
            ))}
            <button
              type="button"
              className={`mathway-tab-btn ${showLatexTab ? "active" : ""}`}
              onClick={() => setShowLatexTab(!showLatexTab)}
              role="tab"
              aria-selected={showLatexTab}
            >
              LaTeX
            </button>
          </div>

          {!showLatexTab ? (
            <div className="mathway-symbols">
              {mathwayGroups[activeGroupIndex]?.symbols.map((s) => (
                <button
                  type="button"
                  key={s.label}
                  className="mathway-symbol-btn"
                  title={s.title}
                  aria-label={s.title}
                  onClick={() => handleInsertSymbol(s.latex)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="mathway-latex-row" style={{ display: "flex", gap: "6px", alignItems: "center", padding: "4px 0" }}>
              <input
                type="text"
                value={latexInput}
                onChange={(e) => setLatexInput(e.target.value)}
                placeholder="Ketik kode LaTeX (contoh: \frac{a}{b})"
                className="bank-input"
                style={{ flex: 1, height: "28px", fontSize: "11px", padding: "4px 8px" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (latexInput.trim()) {
                      handleInsertSymbol(latexInput.trim());
                      setLatexInput("");
                    }
                  }
                }}
              />
              <button
                type="button"
                className="bank-toolbar-btn active"
                style={{ height: "28px", padding: "0 10px", fontSize: "11px" }}
                onClick={() => {
                  if (latexInput.trim()) {
                    handleInsertSymbol(latexInput.trim());
                    setLatexInput("");
                  }
                }}
              >
                Sisipkan
              </button>
            </div>
          )}
        </div>
      )}

      {/* Editor Content Box */}
      <EditorContent editor={editor} />
    </div>
  );
}
