"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-[68px] md:bottom-6 right-4 md:right-6 z-40 w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg flex items-center justify-center transition-all"
        title="Assistente AI edilizia"
      >
        {open ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[120px] md:bottom-20 right-4 md:right-6 z-40 w-[min(360px,calc(100vw-2rem))] h-[min(500px,calc(100vh-160px))] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-violet-600 text-white rounded-t-2xl shrink-0">
            <Bot className="w-4 h-4" />
            <div>
              <p className="text-sm font-semibold leading-tight">Assistente Edilizia</p>
              <p className="text-[10px] opacity-80">AI specializzata in costruzioni</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-foreground max-w-[85%]">
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
                      className="w-full text-left text-xs px-3 py-2 rounded-xl border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors"
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
                  className={`rounded-2xl px-3 py-2 text-xs max-w-[85%] whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-muted/60 text-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-3 py-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t p-2 shrink-0">
            <div className="flex gap-1.5 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Chiedi qualcosa sull'edilizia..."
                rows={1}
                className="flex-1 resize-none text-xs border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-background max-h-24 overflow-auto"
                style={{ height: "auto" }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 96) + "px";
                }}
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0 bg-violet-600 hover:bg-violet-700 rounded-xl"
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground mt-1 text-center">
              Enter per inviare · Shift+Enter per andare a capo
            </p>
          </div>
        </div>
      )}
    </>
  );
}
