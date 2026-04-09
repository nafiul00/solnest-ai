"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { X, Send, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Config ────────────────────────────────────────────────────────────────────
const N8N_WEBHOOK = import.meta.env.VITE_N8N_CHATBOT_URL
  ?? "https://n8n.srv1533002.hstgr.cloud/webhook/solnest-chatbot"

const QUICK_COMMANDS = [
  "revenue today",
  "upcoming bookings",
  "occupancy",
  "rankings",
  "reviews",
  "pricing",
]

const WELCOME = `Hi! I'm your Solnest AI assistant. Ask me anything about your 4 STR properties.

Try a quick command below or type your own question.`

// ─── Types ──────────────────────────────────────────────────────────────────────
interface Message {
  id:        string
  role:      "user" | "assistant"
  content:   string
  timestamp: Date
  error?:    boolean
}

// ─── ColorOrb (CSS defined in index.css) ────────────────────────────────────────
function ColorOrb({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("color-orb flex-shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}

// ─── Typing indicator ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--gold)",
            animation: `typing-bounce 1.2s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Message bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"
  return (
    <div
      className={cn(
        "flex gap-2 mb-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {!isUser && <ColorOrb size={22} className="mt-1" />}
      <div
        style={{
          maxWidth: "80%",
          padding: "9px 12px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          background: isUser
            ? "var(--gold)"
            : msg.error
            ? "rgba(192,57,43,0.08)"
            : "var(--bg-card-2)",
          color: isUser
            ? "#fff"
            : msg.error
            ? "var(--red)"
            : "var(--t1)",
          border: isUser
            ? "none"
            : msg.error
            ? "1px solid rgba(192,57,43,0.2)"
            : "1px solid var(--border)",
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {msg.content}
        <div
          style={{
            fontSize: 10,
            marginTop: 4,
            opacity: 0.6,
            textAlign: isUser ? "right" : "left",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  )
}

// ─── Main chatbot panel ─────────────────────────────────────────────────────────
export function SolnestChatbot() {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: WELCOME, timestamp: new Date() },
  ])
  const [input,    setInput]    = useState("")
  const [loading,  setLoading]  = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 })

  const scrollRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const panelRef   = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120)
  }, [open])

  // Close on outside click (ignore clicks on the trigger button itself)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        open &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function toggleOpen() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPanelPos({
        top:   rect.bottom + 10,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(o => !o)
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id:        `u-${Date.now()}`,
      role:      "user",
      content:   trimmed,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch(N8N_WEBHOOK, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ command: trimmed }),
      })

      let reply = ""
      if (!res.ok) {
        reply = `Error ${res.status}: The automation could not process your request. Check n8n workflow status.`
      } else {
        const data = await res.json().catch(() => ({}))
        // n8n respondToWebhook can return various shapes
        reply =
          data.response  ??
          data.message   ??
          data.text      ??
          data.output    ??
          data.result    ??
          (typeof data === "string" ? data : JSON.stringify(data, null, 2))
      }

      setMessages(prev => [
        ...prev,
        {
          id:        `a-${Date.now()}`,
          role:      "assistant",
          content:   reply,
          timestamp: new Date(),
          error:     !res.ok,
        },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id:        `e-${Date.now()}`,
          role:      "assistant",
          content:   "Could not reach the automation server. Make sure the n8n workflow is active and accessible.",
          timestamp: new Date(),
          error:     true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [loading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") setOpen(false)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function clearChat() {
    setMessages([{ id: "welcome", role: "assistant", content: WELCOME, timestamp: new Date() }])
  }

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {/* ── Chat Panel — anchored below trigger button ── */}
      {open && (
        <div
          ref={panelRef}
          className="chatbot-enter"
          style={{
            position:     "fixed",
            top:          panelPos.top,
            right:        panelPos.right,
            width:        380,
            height:       540,
            background:   "var(--bg-surface)",
            border:       "1px solid rgba(184,134,11,0.22)",
            borderRadius: 16,
            boxShadow:    "0 24px 80px rgba(10,10,9,0.16), 0 8px 32px rgba(10,10,9,0.10)",
            display:      "flex",
            flexDirection:"column",
            overflow:     "hidden",
            zIndex:       9999,
          }}
        >
          {/* Header */}
          <div style={{
            display:      "flex",
            alignItems:   "center",
            gap:          10,
            padding:      "14px 16px",
            borderBottom: "1px solid var(--border)",
            background:   "var(--bg-surface)",
            flexShrink:   0,
          }}>
            <ColorOrb size={26} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", lineHeight: 1 }}>
                Solnest AI
              </div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                GPT-4o · n8n connected
              </div>
            </div>
            <button
              className="btn-icon"
              onClick={clearChat}
              title="Clear chat"
            >
              <RotateCcw size={13} color="var(--t3)" />
            </button>
            <button
              className="btn-icon"
              onClick={() => setOpen(false)}
              title="Close"
            >
              <X size={15} color="var(--t3)" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              flex:       1,
              overflowY:  "auto",
              padding:    "14px 14px 8px",
            }}
          >
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {loading && (
              <div className="flex gap-2 mb-3">
                <ColorOrb size={22} className="mt-1" />
                <div style={{
                  padding:      "9px 14px",
                  borderRadius: "14px 14px 14px 4px",
                  background:   "var(--bg-card-2)",
                  border:       "1px solid var(--border)",
                }}>
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          {/* Quick commands */}
          <div style={{
            padding:      "0 12px 8px",
            display:      "flex",
            gap:          6,
            flexWrap:     "wrap",
            flexShrink:   0,
          }}>
            {QUICK_COMMANDS.map(cmd => (
              <button
                key={cmd}
                onClick={() => sendMessage(cmd)}
                disabled={loading}
                style={{
                  fontSize:     11,
                  padding:      "3px 9px",
                  borderRadius: 20,
                  border:       "1px solid rgba(184,134,11,0.30)",
                  background:   "rgba(184,134,11,0.07)",
                  color:        "var(--gold)",
                  cursor:       loading ? "not-allowed" : "pointer",
                  fontWeight:   500,
                  transition:   "all 0.15s",
                  opacity:      loading ? 0.5 : 1,
                  whiteSpace:   "nowrap",
                }}
              >
                {cmd}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div style={{
            padding:      "0 12px 12px",
            flexShrink:   0,
          }}>
            <div style={{
              display:      "flex",
              gap:          8,
              alignItems:   "flex-end",
              background:   "var(--bg-card-2)",
              borderRadius: 12,
              border:       "1px solid var(--border-mid)",
              padding:      "8px 10px",
              transition:   "border-color 0.2s",
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
                rows={1}
                disabled={loading}
                style={{
                  flex:       1,
                  resize:     "none",
                  border:     "none",
                  background: "transparent",
                  outline:    "none",
                  fontSize:   13,
                  color:      "var(--t1)",
                  lineHeight: 1.5,
                  padding:    0,
                  maxHeight:  80,
                  overflowY:  "auto",
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow:  "none",
                }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = "auto"
                  el.style.height = Math.min(el.scrollHeight, 80) + "px"
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                style={{
                  width:        32,
                  height:       32,
                  borderRadius: 8,
                  background:   input.trim() && !loading ? "var(--gold)" : "var(--bg-card-2)",
                  border:       `1px solid ${input.trim() && !loading ? "var(--gold)" : "var(--border)"}`,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                  cursor:       input.trim() && !loading ? "pointer" : "not-allowed",
                  flexShrink:   0,
                  transition:   "all 0.18s",
                }}
              >
                <Send size={13} color={input.trim() && !loading ? "#fff" : "var(--t3)"} />
              </button>
            </div>
            <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 5, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>
              Enter · send &nbsp;·&nbsp; Shift+Enter · newline &nbsp;·&nbsp; Esc · close
            </div>
          </div>
        </div>
      )}

      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        style={{
          position:   "relative",
          display:    "flex",
          alignItems: "center",
          gap:        7,
          padding:    "6px 14px 6px 10px",
          borderRadius: 20,
          background: open ? "rgba(184,134,11,0.14)" : "rgba(184,134,11,0.08)",
          border:     `1px solid rgba(184,134,11,${open ? "0.50" : "0.25"})`,
          cursor:     "pointer",
          flexShrink: 0,
          transition: "all 0.18s",
          boxShadow:  open ? "none" : "0 1px 4px rgba(184,134,11,0.10)",
        }}
        title={open ? "Close AI assistant" : "Open AI assistant"}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
      >
        <ColorOrb size={16} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)", letterSpacing: "-0.01em" }}>
          {open ? "Close" : "Ask AI"}
        </span>
        {!open && (
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--sage)",
            boxShadow:  "0 0 5px rgba(44,110,73,0.5)",
            flexShrink: 0,
            animation:  "pulse-green 2.5s infinite",
          }} />
        )}
      </button>
    </div>
  )
}

export default SolnestChatbot
