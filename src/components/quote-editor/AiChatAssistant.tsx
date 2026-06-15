"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Quanto ho fatto pagare l'ultimo cappotto termico?",
  "Che prezzi ho usato per la tinteggiatura?",
  "Come calcolo il fabbisogno di piastrelle per un bagno?",
  "Qual è il costo medio della posa parquet?",
];

export function AiChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Si è verificato un errore. Riprova." },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Timeout. Riprova con una domanda più breve." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Floating button — nascosto su mobile quando la chat è aperta a schermo intero */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 right-4 md:right-6 z-50 w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-700 active:scale-95 text-white shadow-lg items-center justify-center transition-all ${
          open ? "hidden md:flex" : "flex"
        }`}
        title="Assistente AI edilizia"
      >
        {open ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
      </button>

      {/* Chat panel — mobile: schermo intero come pagina dedicata; desktop: pannello flottante */}
      {open && (
        <div className="fixed z-50 flex flex-col overflow-hidden bg-background
          inset-0 rounded-none
          md:inset-auto md:top-auto md:left-auto md:right-6 md:bottom-20 md:w-[390px] md:h-[min(540px,calc(100vh-160px))] md:rounded-2xl md:border md:shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 border-b bg-violet-600 text-white shrink-0
            pt-[calc(env(safe-area-inset-top)+0.875rem)] pb-3.5 md:pt-3 md:pb-3 md:rounded-t-2xl">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 shrink-0 md:h-7 md:w-7">
              <Bot className="w-5 h-5 md:w-4 md:h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] md:text-sm font-semibold leading-tight">Assistente Edilizia</p>
              <p className="text-[11px] md:text-[10px] opacity-80">AI specializzata in costruzioni</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Chiudi"
              className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition active:scale-90 hover:bg-white/15"
            >
              <X className="w-6 h-6 md:w-5 md:h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-3 space-y-3 mx-auto w-full max-w-2xl md:max-w-none">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <div className="bg-muted/60 rounded-2xl rounded-tl-xs px-3 py-2 text-sm md:text-xs text-foreground max-w-[85%] break-words">
                    Ciao! Sono il tuo assistente specializzato in edilizia. Ho accesso ai tuoi <strong>preventivi storici</strong> e al <strong>listino prezzi aziendale</strong>.
                    <br /><br />
                    Puoi chiedermi: &quot;quanto hai fatto pagare l&apos;ultimo cappotto termico?&quot;, &quot;che prezzo hai usato per la posa del parquet?&quot;, o qualsiasi domanda tecnica sull&apos;edilizia.
                  </div>
                </div>

                <div className="pl-8 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Domande frequenti</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left text-sm md:text-xs px-3 py-2.5 md:py-2 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 active:scale-[.98] transition"
                    >
                      <Sparkles className="w-3 h-3 inline mr-1.5 opacity-60" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3 py-2 text-sm md:text-xs max-w-[85%] break-words min-w-0 ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-xs whitespace-pre-wrap"
                      : "bg-muted/60 text-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="leading-snug">{children}</li>,
                        h1: ({ children }) => <h1 className="font-bold text-sm mb-1 mt-2 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="font-semibold text-xs mb-1 mt-2 first:mt-0 text-violet-700">{children}</h2>,
                        h3: ({ children }) => <h3 className="font-semibold mb-0.5 mt-1.5 first:mt-0">{children}</h3>,
                        code: ({ children }) => (
                          <code className="bg-black/10 rounded-xs px-1 py-0.5 font-mono text-[10px]">{children}</code>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-violet-300 pl-2 my-1 text-muted-foreground">{children}</blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="w-full border-collapse text-[11px]">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-violet-100">{children}</thead>,
                        th: ({ children }) => (
                          <th className="border border-violet-200 px-2 py-1 text-left font-semibold">{children}</th>
                        ),
                        td: ({ children }) => (
                          <td className="border border-violet-200 px-2 py-1">{children}</td>
                        ),
                        tr: ({ children }) => <tr className="even:bg-violet-50/50">{children}</tr>,
                        hr: () => <hr className="my-2 border-muted-foreground/20" />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div className="bg-muted/60 rounded-2xl rounded-tl-xs px-3 py-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:pb-2 shrink-0">
            <div className="flex gap-2 items-end mx-auto w-full max-w-2xl md:max-w-none">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Chiedi qualcosa sull'edilizia..."
                rows={1}
                className="flex-1 resize-none text-sm md:text-xs border rounded-xl px-3 py-2.5 md:py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-background max-h-32 overflow-auto"
                style={{ height: "auto" }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 128) + "px";
                }}
              />
              <Button
                size="icon"
                className="h-10 w-10 md:h-8 md:w-8 shrink-0 bg-violet-600 hover:bg-violet-700 active:scale-95 rounded-xl"
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
              >
                <Send className="w-4 h-4 md:w-3.5 md:h-3.5" />
              </Button>
            </div>
            <p className="hidden md:block text-[9px] text-muted-foreground mt-1 text-center">
              Enter per inviare · Shift+Enter per andare a capo
            </p>
          </div>
        </div>
      )}
    </>
  );
}
