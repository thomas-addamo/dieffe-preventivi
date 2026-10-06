"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DEFAULT_FONT_SIZE,
  FONT_FAMILIES,
  FONT_SIZES,
  HIGHLIGHT_COLORS,
  TEXT_COLORS,
  type PMNode,
} from "@/lib/communications";
import { cn } from "@/lib/utils";

// Editor del corpo della comunicazione. Il foglio è sempre bianco (come il
// PDF) e usa le stesse misure in punti tipografici del PDF: quello che si
// vede è quello che si stampa.

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl+";

/** Tipografia del foglio: valori in pt identici a PdfDocBody. */
const PAPER_CLASS =
  "min-h-[420px] font-[Helvetica,Arial,sans-serif] text-[11pt] leading-[1.45] text-zinc-900 outline-none " +
  "[&_p]:mb-[6pt] [&_p:last-child]:mb-0 " +
  "[&_h1]:mb-[6pt] [&_h1]:mt-[4pt] [&_h1]:text-[18pt] [&_h1]:font-bold [&_h1]:leading-tight " +
  "[&_h2]:mb-[6pt] [&_h2]:mt-[4pt] [&_h2]:text-[15pt] [&_h2]:font-bold [&_h2]:leading-tight " +
  "[&_h3]:mb-[6pt] [&_h3]:mt-[4pt] [&_h3]:text-[13pt] [&_h3]:font-bold [&_h3]:leading-tight " +
  "[&_ul]:mb-[6pt] [&_ul]:list-disc [&_ul]:pl-[1.4em] [&_ol]:mb-[6pt] [&_ol]:list-decimal [&_ol]:pl-[1.6em] " +
  "[&_li>p]:mb-[2pt] [&_strong]:font-bold " +
  "[&_blockquote]:mb-[6pt] [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-[10pt] [&_blockquote]:text-slate-600 " +
  "[&_hr]:my-[8pt] [&_hr]:border-zinc-300 [&_mark]:rounded-[2px] [&_mark]:px-[1px] ";

interface Props {
  value: PMNode;
  onChange: (doc: PMNode) => void;
  readOnly?: boolean;
}

export function LetterEditor({ value, onChange, readOnly }: Props) {
  const cb = useRef(onChange);
  useLayoutEffect(() => {
    cb.current = onChange;
  });
  const lastEmitted = useRef<string>(JSON.stringify(value));

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        code: false,
        link: false,
      }),
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: PAPER_CLASS,
        "aria-label": "Testo della comunicazione",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as PMNode;
      lastEmitted.current = JSON.stringify(json);
      cb.current(json);
    },
  });

  // Documento cambiato da fuori (apertura dall'archivio, "Nuova"): ricarica.
  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(value);
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming;
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const empty = useEditorState({
    editor,
    selector: ({ editor }) => !editor || editor.isEmpty,
  });

  return (
    <div className="flex flex-col">
      {editor && !readOnly && <Toolbar editor={editor} />}
      {/* Foglio: bianco anche in tema scuro, margini come il PDF */}
      <div
        className="cursor-text bg-white px-5 py-6 md:px-10 md:py-9"
        onClick={() => editor?.commands.focus()}
      >
        <div className="relative">
          <EditorContent editor={editor} />
          {empty && (
            <p className="pointer-events-none absolute left-0 top-0 text-[11pt] text-zinc-400">
              Scrivi qui il testo della comunicazione…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Barra degli strumenti ───────────────────────────────────────────────────

function useToolbarState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes("textStyle");
      const size = parseFloat(String(ts.fontSize ?? "")) || DEFAULT_FONT_SIZE;
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        quote: e.isActive("blockquote"),
        h1: e.isActive("heading", { level: 1 }),
        h2: e.isActive("heading", { level: 2 }),
        h3: e.isActive("heading", { level: 3 }),
        align: (["center", "right", "justify"].find((a) => e.isActive({ textAlign: a })) ?? "left") as string,
        size,
        family: String(ts.fontFamily ?? ""),
        color: String(ts.color ?? ""),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });
}

function Toolbar({ editor }: { editor: Editor }) {
  const st = useToolbarState(editor);
  const chain = () => editor.chain().focus();

  const setSize = (pt: number) => {
    if (pt === DEFAULT_FONT_SIZE) chain().unsetFontSize().run();
    else chain().setFontSize(`${pt}pt`).run();
  };
  const stepSize = (dir: 1 | -1) => {
    const cur = st.size;
    const next =
      dir > 0
        ? FONT_SIZES.find((s) => s > cur) ?? FONT_SIZES[FONT_SIZES.length - 1]
        : [...FONT_SIZES].reverse().find((s) => s < cur) ?? FONT_SIZES[0];
    setSize(next);
  };

  const blockValue = st.h1 ? "h1" : st.h2 ? "h2" : st.h3 ? "h3" : "p";

  return (
    // Gruppi di controlli: contenitore 16px + p-1 → pulsanti 12px, concentrici.
    <div className="sticky top-0 z-10 border-b bg-card/95 px-3 py-2 backdrop-blur-xl">
      <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
        <Group>
          <Btn icon={Undo2} label={`Annulla (${MOD}Z)`} disabled={!st.canUndo} onClick={() => chain().undo().run()} />
          <Btn icon={Redo2} label={`Ripeti (${MOD}⇧Z)`} disabled={!st.canRedo} onClick={() => chain().redo().run()} />
        </Group>

        <Group>
          <select
            aria-label="Stile paragrafo"
            value={blockValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "p") chain().setParagraph().run();
              else chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
            }}
            className="h-8 rounded-lg bg-transparent px-2 text-sm font-medium outline-none hover:bg-accent"
          >
            <option value="p">Testo</option>
            <option value="h1">Titolo</option>
            <option value="h2">Sottotitolo</option>
            <option value="h3">Intestazione</option>
          </select>
          <select
            aria-label="Carattere"
            value={st.family}
            onChange={(e) =>
              e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run()
            }
            className="hidden h-8 rounded-lg bg-transparent px-2 text-sm outline-none hover:bg-accent sm:block"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Group>

        <Group>
          <Btn icon={AArrowDown} label="Riduci testo" onClick={() => stepSize(-1)} />
          <select
            aria-label="Dimensione testo"
            value={FONT_SIZES.includes(st.size as (typeof FONT_SIZES)[number]) ? st.size : DEFAULT_FONT_SIZE}
            onChange={(e) => setSize(Number(e.target.value))}
            className="h-8 w-14 rounded-lg bg-transparent px-1 text-center text-sm tabular-nums outline-none hover:bg-accent"
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Btn icon={AArrowUp} label="Ingrandisci testo" onClick={() => stepSize(1)} />
        </Group>

        <Group>
          <Btn icon={Bold} label={`Grassetto (${MOD}B)`} active={st.bold} onClick={() => chain().toggleBold().run()} />
          <Btn icon={Italic} label={`Corsivo (${MOD}I)`} active={st.italic} onClick={() => chain().toggleItalic().run()} />
          <Btn icon={Underline} label={`Sottolineato (${MOD}U)`} active={st.underline} onClick={() => chain().toggleUnderline().run()} />
          <Btn icon={Strikethrough} label="Barrato" active={st.strike} onClick={() => chain().toggleStrike().run()} />
        </Group>

        <Group>
          <Swatches
            icon={Palette}
            label="Colore testo"
            colors={TEXT_COLORS}
            current={st.color}
            onPick={(c) => chain().setColor(c).run()}
            onClear={() => chain().unsetColor().run()}
          />
          <Swatches
            icon={Highlighter}
            label="Evidenzia"
            colors={HIGHLIGHT_COLORS}
            onPick={(c) => chain().setHighlight({ color: c }).run()}
            onClear={() => chain().unsetHighlight().run()}
          />
        </Group>

        <Group>
          <Btn icon={AlignLeft} label="Allinea a sinistra" active={st.align === "left"} onClick={() => chain().setTextAlign("left").run()} />
          <Btn icon={AlignCenter} label="Centra" active={st.align === "center"} onClick={() => chain().setTextAlign("center").run()} />
          <Btn icon={AlignRight} label="Allinea a destra" active={st.align === "right"} onClick={() => chain().setTextAlign("right").run()} />
          <Btn icon={AlignJustify} label="Giustifica" active={st.align === "justify"} onClick={() => chain().setTextAlign("justify").run()} />
        </Group>

        <Group>
          <Btn icon={List} label="Elenco puntato" active={st.bullet} onClick={() => chain().toggleBulletList().run()} />
          <Btn icon={ListOrdered} label="Elenco numerato" active={st.ordered} onClick={() => chain().toggleOrderedList().run()} />
          <Btn icon={Quote} label="Citazione" active={st.quote} onClick={() => chain().toggleBlockquote().run()} />
          <Btn icon={Minus} label="Linea divisoria" onClick={() => chain().setHorizontalRule().run()} />
        </Group>

        <Btn
          icon={RemoveFormatting}
          label="Rimuovi formattazione"
          onClick={() => chain().unsetAllMarks().clearNodes().unsetTextAlign().run()}
        />
      </div>
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-muted/60 p-1">{children}</div>
  );
}

function Btn({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // mousedown: non togliere il focus (e la selezione) all'editor
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-35",
        active && "bg-card text-primary shadow-2xs hover:bg-card hover:text-primary"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Swatches({
  icon: Icon,
  label,
  colors,
  current,
  onPick,
  onClear,
}: {
  icon: LucideIcon;
  label: string;
  colors: readonly string[];
  current?: string;
  onPick: (c: string) => void;
  onClear: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={label}
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Icon className="h-4 w-4" />
          {current && (
            <span className="absolute bottom-1 left-2 right-2 h-0.5 rounded-full" style={{ background: current }} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">{label}</p>
        <div className="grid grid-cols-5 gap-1.5">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(c)}
              className={cn(
                "h-7 w-7 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110",
                current === c && "ring-2 ring-primary ring-offset-2 ring-offset-popover"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
          className="mt-2 w-full rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Nessuno
        </button>
      </PopoverContent>
    </Popover>
  );
}
