import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, X, Sparkles, User, RefreshCw, Trash2, Paperclip, Mic, MicOff, Volume2, VolumeX, Image as ImageIcon, FileText } from 'lucide-react';
import Markdown from 'react-markdown';

interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // base64 string without prefix
  dataUrl: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  attachment?: FileAttachment;
  isError?: boolean;
}

interface ChimexBotProps {
  userId?: string;
}

export default function ChimexBot({ userId }: ChimexBotProps) {
  const activeUserId = userId || 'guest';
  const storageKey = `chimex_chat_history_${activeUserId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice Speech-to-Text State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Text-to-Speech State
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Web Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };

      rec.onerror = (err: any) => {
        console.warn('Speech recognition notice:', err);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleVoiceListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser version.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  // Speak assistant text aloud if TTS enabled
  const speakText = (text: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Load user-isolated chat history whenever activeUserId changes
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
        return;
      } catch (e) {
        // Fallback
      }
    }
    setMessages([
      {
        role: 'assistant',
        content: "Hello! I am Chimex, your real-time Sub Trafficker AI assistant. Ask me anything, or upload screenshots/receipts for instant analysis!"
      }
    ]);
  }, [activeUserId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Save chat history scoped to user ID
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, storageKey]);

  const handleClearHistory = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const defaultMsg: Message[] = [
      {
        role: 'assistant',
        content: "Hello! I am Chimex, your real-time Sub Trafficker AI assistant. Ask me anything, or upload screenshots/receipts for instant analysis!"
      }
    ];
    setMessages(defaultMsg);
    setShowError(false);
    localStorage.removeItem(storageKey);
  };

  // Handle File Upload Select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.split(',')[1];
      setSelectedFile({
        name: file.name,
        mimeType: file.type || 'image/png',
        data: base64Data,
        dataUrl
      });
    };
    reader.readAsDataURL(file);
  };

  const executeChatQuery = async (userMsgList: Message[]) => {
    setLoading(true);
    setShowError(false);

    const assistantIndex = userMsgList.length;
    setMessages([...userMsgList, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: userMsgList
        })
      });

      if (!response.ok) {
        throw new Error("Telemetry connection rejected.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) throw new Error("Stream reader initialization failed.");

      let done = false;
      let accumulatedText = "";
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith("data: ")) {
              const dataStr = cleanLine.substring(6).trim();
              if (dataStr === "[DONE]") {
                done = true;
                break;
              }
              try {
                const dataObj = JSON.parse(dataStr);
                if (dataObj.text) {
                  accumulatedText += dataObj.text;
                  setMessages(prev => {
                    const updated = [...prev];
                    if (updated[assistantIndex]) {
                      updated[assistantIndex] = {
                        role: 'assistant',
                        content: accumulatedText
                      };
                    }
                    return updated;
                  });
                }
              } catch (e) {
                // Ignore partial JSON parsing
              }
            }
          }
        }
      }

      if (accumulatedText && ttsEnabled) {
        speakText(accumulatedText);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setShowError(true);
      setMessages(prev => {
        const updated = [...prev];
        if (updated[assistantIndex]) {
          updated[assistantIndex] = {
            role: 'assistant',
            content: "Signal interrupted. Check your network or API keys in workspace Settings.",
            isError: true
          };
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !selectedFile) || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      attachment: selectedFile || undefined
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setSelectedFile(null);

    await executeChatQuery(updatedMessages);
  };

  const handlePresetQuestion = (promptText: string) => {
    setInput(promptText);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating launcher trigger */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:scale-105 active:scale-95 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-transform duration-200 border-2 border-white/20 relative group"
            id="chimex-launcher"
          >
            <Bot size={24} className="animate-pulse" />
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 border border-purple-500/30 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none shadow-2xl font-bold flex items-center gap-1.5">
              <Sparkles size={12} className="text-purple-400 animate-spin-slow" /> Ask Chimex AI
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Interactive Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="bg-[#0B071A] border border-purple-500/30 rounded-3xl w-80 sm:w-96 h-[540px] shadow-2xl flex flex-col overflow-hidden"
            id="chimex-chat-window"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-[#120C24] via-[#1A1038] to-[#120C24] border-b border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600/20 rounded-xl border border-purple-500/30 text-purple-400">
                  <Bot size={20} />
                </div>
                <div>
                  <h4 className="font-bold font-display text-white text-sm flex items-center gap-1.5">
                    Chimex AI <Sparkles size={12} className="text-purple-400" />
                  </h4>
                  <p className="text-[10px] text-purple-300/70 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online • Voice & Vision
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* TTS Toggle */}
                <button
                  onClick={() => {
                    const next = !ttsEnabled;
                    setTtsEnabled(next);
                    if (!next && 'speechSynthesis' in window) {
                      window.speechSynthesis.cancel();
                      setIsSpeaking(false);
                    }
                  }}
                  title={ttsEnabled ? "Mute Voice Output" : "Enable Voice Output"}
                  className={`p-1.5 rounded-lg transition ${ttsEnabled ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                  id="toggle-tts-btn"
                >
                  {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>

                {messages.length > 1 && (
                  <button
                    onClick={handleClearHistory}
                    title="Clear user chat history"
                    className="p-1.5 hover:bg-white/10 rounded-lg text-purple-300/70 hover:text-red-400 transition"
                    id="clear-chimex-history"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                
                <button
                  onClick={() => {
                    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                    setIsOpen(false);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-purple-300 transition"
                  id="close-chimex-chat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Message Pane */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans text-xs">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role !== 'user' && (
                    <div className="w-6 h-6 rounded-lg bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                      <Bot size={14} />
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-2xl max-w-[82%] leading-relaxed select-text ${
                      m.role === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-none shadow-md'
                        : m.isError
                        ? 'bg-red-950/40 border border-red-500/30 text-red-200 rounded-tl-none'
                        : 'bg-purple-950/40 border border-purple-500/20 text-purple-100 rounded-tl-none'
                    }`}
                  >
                    {/* Render File Attachment inside message if present */}
                    {m.attachment && (
                      <div className="mb-2 p-1.5 bg-black/30 rounded-xl border border-white/10 overflow-hidden">
                        {m.attachment.mimeType.startsWith('image/') ? (
                          <img
                            src={m.attachment.dataUrl}
                            alt="Attached document"
                            className="w-full max-h-36 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-[10px] text-purple-200">
                            <FileText size={14} />
                            <span className="truncate">{m.attachment.name}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {m.content && (
                      <div className="markdown-body prose prose-invert max-w-none prose-xs">
                        <Markdown>{m.content}</Markdown>
                      </div>
                    )}
                  </div>

                  {m.role === 'user' && (
                    <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                      <User size={14} />
                    </div>
                  )}
                </div>
              ))}
              
              {loading && messages[messages.length - 1]?.content === '' && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-6 h-6 rounded-lg bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                    <Bot size={14} />
                  </div>
                  <div className="bg-purple-950/20 border border-purple-500/10 p-3 rounded-2xl text-purple-300 flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin text-purple-400" />
                    <span>Analyzing message...</span>
                  </div>
                </div>
              )}

              {/* Preset Quick Chips */}
              {messages.length <= 2 && !loading && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-[10px] text-purple-300/50 uppercase font-semibold">Suggested Questions:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "How do I withdraw cash?",
                      "Fix my USSD SIM balance",
                      "Setup fingerprint security"
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handlePresetQuestion(q)}
                        className="px-2.5 py-1 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/20 text-purple-200 text-[10px] rounded-lg transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Attachment Preview Banner */}
            {selectedFile && (
              <div className="px-3 py-1.5 bg-purple-950/60 border-t border-purple-500/20 flex items-center justify-between text-xs text-purple-200">
                <div className="flex items-center gap-2 truncate">
                  <ImageIcon size={14} className="text-purple-400 shrink-0" />
                  <span className="truncate text-[11px] font-semibold">{selectedFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 hover:text-red-400 transition"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-3 border-t border-purple-500/20 bg-[#120C24] flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                id="chimex-file-input"
              />

              {/* File Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-purple-400 hover:text-purple-200 hover:bg-purple-950/50 rounded-xl transition cursor-pointer shrink-0"
                title="Attach Screenshot / Document"
                id="chimex-attach-btn"
              >
                <Paperclip size={16} />
              </button>

              {/* Voice Speech Input Button */}
              <button
                type="button"
                onClick={toggleVoiceListening}
                className={`p-2 rounded-xl transition cursor-pointer shrink-0 ${isListening ? 'bg-rose-600 text-white animate-pulse' : 'text-purple-400 hover:text-purple-200 hover:bg-purple-950/50'}`}
                title={isListening ? "Listening... Speak now" : "Speak to Chimex AI"}
                id="chimex-mic-btn"
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening..." : "Ask Chimex AI or upload file..."}
                className="flex-1 px-3.5 py-2 bg-slate-900/90 border border-purple-500/20 rounded-xl text-white text-xs placeholder-purple-300/40 focus:outline-none focus:border-purple-500 transition"
                id="chimex-text-input"
              />

              <button
                type="submit"
                disabled={loading || (!input.trim() && !selectedFile)}
                className="p-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/40 disabled:text-purple-300/40 text-white rounded-xl transition flex items-center justify-center cursor-pointer shrink-0"
                id="chimex-send-btn"
              >
                <Send size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
