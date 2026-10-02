"use client";

import { useEffect, useLayoutEffect, useRef, type Ref } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  RemoveFormatting,
  type LucideIcon,
} from "lucide-react";
import { RichText } from "@/components/shared/RichText";
import { docToRichText, richTextToDoc } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

// Editor della descrizione voce con formattazione (grassetto, corsivo,
// sottolineato, barrato, elenchi). Salva in "markdown leggero" (lib/rich-text):
// i testi esistenti restano validi così come sono.

/** Tipografia condivisa tra editor e vista statica: niente salti al focus. */
const CONTENT_CLASS =
  "text-sm leading-5 whitespace-pre-wrap break-words " +
  "[&_strong]:font-semibold [&_ul]:list-disc [&_ol]:list-decimal " +
  "[&_ul]:pl-[1.25em] [&_ol]:pl-[1.25em] [&_li]:pl-[0.15em] [&_li>p]:m-0";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Riceve il wrapper, usato per ancorare la tendina del listino. */
  anchorRef?: Ref<HTMLDivElement>;
  readOnly?: boolean;
  placeholder?: string;
  minHeightClass?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onEscape?: () => void;
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl+";

export function RichDescriptionEditor({
  value,
  onChange,
  anchorRef,
  readOnly,
  placeholder = "Descrizione voce...",
  minHeightClass = "min-h-7",
  onFocus,
  onBlur,
  onEscape,
}: Props) {
  // Callback sempre aggiornate senza ricreare l'editor.
  const cb = useRef({ onChange, onFocus, onBlur, onEscape });
  useLayoutEffect(() => {
    cb.current = { onChange, onFocus, onBlur, onEscape };
  });
  // Ultimo valore emesso dall'editor: distingue le modifiche esterne
  // (listino, suggerimento AI, "migliora") da quelle digitate qui.
  const lastEmitted = useRef(value);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !readOnly,
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          code: false,
          blockquote: false,
          horizontalRule: false,
          link: false,
          dropcursor: false,
          trailingNode: false,
        }),
      ],
      content: richTextToDoc(value),
      editorProps: {
        attributes: {
          class: cn("outline-none py-1", CONTENT_CLASS, minHeightClass),
          "aria-label": "Descrizione voce",
          role: "textbox",
          "aria-multiline": "true",
        },
        handleKeyDown: (_view, event) => {
          if (event.key === "Escape") cb.current.onEscape?.();
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        const next = docToRichText(editor.getJSON());
        if (next === lastEmitted.current) return;
        lastEmitted.current = next;
        cb.current.onChange(next);
      },
      onFocus: () => cb.current.onFocus?.(),
      onBlur: () => cb.current.onBlur?.(),
    },
    [readOnly]
  );

  // Valore cambiato dall'esterno → aggiorna il documento senza rimbalzi.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(richTextToDoc(value), { emitUpdate: false });
  }, [value, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            focused: e.isFocused,
            empty: e.isEmpty,
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            bulletList: e.isActive("bulletList"),
            orderedList: e.isActive("orderedList"),
          }
        : null,
  });

  // Sola lettura, o primo frame prima che l'editor sia pronto: vista statica
  // con la stessa tipografia (evita il "flash" vuoto).
  if (readOnly || !editor) {
    return (
      <div ref={anchorRef} className={cn("py-1", minHeightClass)}>
        {value ? (
          <RichText value={value} className={CONTENT_CLASS} />
        ) : (
          !readOnly && <span className="text-sm leading-5 text-muted-foreground/60">{placeholder}</span>
        )}
      </div>
    );
  }

  return (
    <div ref={anchorRef} className="relative">
      <div
        className={cn(
          "relative -mx-1.5 rounded-md px-1.5 transition-colors",
          state?.focused ? "bg-background ring-1 ring-ring/40" : "hover:bg-muted/40"
        )}
      >
        {state?.empty && (
          <span className="pointer-events-none absolute left-1.5 top-1 text-sm leading-5 text-muted-foreground/60">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
      {state?.focused && <FormatToolbar editor={editor} state={state} />}
    </div>
  );
}

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  bulletList: boolean;
  orderedList: boolean;
};

function FormatToolbar({ editor, state }: { editor: Editor; state: ToolbarState }) {
  const chain = () => editor.chain().focus();

  const buttons: {
    icon: LucideIcon;
    label: string;
    active?: boolean;
    run: () => void;
  }[][] = [
    [
      { icon: Bold, label: `Grassetto (${MOD}B)`, active: state.bold, run: () => chain().toggleBold().run() },
      { icon: Italic, label: `Corsivo (${MOD}I)`, active: state.italic, run: () => chain().toggleItalic().run() },
      { icon: Underline, label: `Sottolineato (${MOD}U)`, active: state.underline, run: () => chain().toggleUnderline().run() },
      { icon: Strikethrough, label: "Barrato", active: state.strike, run: () => chain().toggleStrike().run() },
    ],
    [
      { icon: List, label: "Elenco puntato", active: state.bulletList, run: () => chain().toggleBulletList().run() },
      { icon: ListOrdered, label: "Elenco numerato", active: state.orderedList, run: () => chain().toggleOrderedList().run() },
    ],
    [
      {
        icon: RemoveFormatting,
        label: "Rimuovi formattazione",
        run: () => chain().unsetAllMarks().clearNodes().run(),
      },
    ],
  ];

  return (
    <div
      role="toolbar"
      aria-label="Formattazione descrizione"
      className="animate-in fade-in slide-in-from-top-1 mt-1 inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border bg-background p-0.5 shadow-sm duration-150"
      // Il toolbar non deve rubare il focus all'editor.
      onMouseDown={(e) => e.preventDefault()}
    >
      {buttons.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />}
          {group.map(({ icon: Icon, label, active, run }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={active}
              onClick={run}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors md:h-6 md:w-6",
                active
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
