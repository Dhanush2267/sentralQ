import React, { useEffect, useState, useRef, useCallback } from "react";
import { 
  Send, 
  Sparkles, 
  Loader2, 
  User, 
  Bot, 
  Database,
  ArrowRight,
  HelpCircle,
  Clock
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import LayoutWrapper from "@/components/LayoutWrapper";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/Card";
import videoService, { VideoDetails } from "@/services/videoService";
import aiSearchService from "@/services/aiSearchService";
import { useToast } from "@/contexts/ToastContext";


interface Message {
  sender: "user" | "ai";
  text: string;
  source?: string;
  grokModel?: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "Summarize customer movements",
  "List restricted area violations",
  "Who visited Shelf A?",
  "Are there entities staying longer than 15s?"
];

const AISearch: React.FC = () => {
  const toast = useToast();
  const [videos, setVideos] = useState<VideoDetails[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("all");
  const [loadingVideos, setLoadingVideos] = useState(true);

  // Conversation state
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "ai",
      text: "Hello! I am your AI Surveillance Copilot. Ask me anything about tracking trajectories, behavior logs, shelf visits, or restricted area entries. I will query the index database directly to construct an answer.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoadingVideos(true);
      const videoList = await videoService.listVideos({ page: 1, size: 100 });
      setVideos(videoList.items);
    } catch (err: any) {
      toast.error("Failed to load search context", err.message);
    } finally {
      setLoadingVideos(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Scroll chat thread to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, searching]);

  const handleSearchSubmit = async (queryText: string) => {
    if (!queryText.trim() || searching) return;

    // Append user message
    const userMsg: Message = {
      sender: "user",
      text: queryText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSearching(true);

    // Save to recent searches
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q !== queryText);
      return [queryText, ...filtered].slice(0, 5);
    });

    try {
      const targetVideo = selectedVideoId === "all" ? undefined : selectedVideoId;
      const res = await aiSearchService.search(queryText, targetVideo);
      
      const aiMsg: Message = {
        sender: "ai",
        text: res.answer,
        source: res.source,
        grokModel: res.grok_model,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      toast.error("AI Assistant Failed", err.message || "An error occurred fetching response from Grok / Llama endpoint.");
      
      const errorMsg: Message = {
        sender: "ai",
        text: "**Failed to reach AI copilot.** Make sure the backend server is running and check console log.",
        source: "error",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSearching(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearchSubmit(input);
  };

  return (
    <LayoutWrapper>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <PageHeader
          title="AI Search Assistant"
          subtitle="Query facility movement patterns, dwell logs, and alerts in natural language"
        />

        {/* Video selector for query context */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Scope:</span>
          <select
            value={selectedVideoId}
            onChange={(e) => setSelectedVideoId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            disabled={loadingVideos}
          >
            <option value="all">Search Entire Platform DB</option>
            {videos.map((v) => (
              <option key={v.id} value={v.id}>
                Context: {v.original_filename}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4 items-stretch">
        {/* Left column sidebar: Suggested & Recent Queries */}
        <div className="lg:col-span-1 space-y-6 flex flex-col justify-start">
          {/* Recent Searches */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Recent Queries
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              {recentSearches.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic py-2">No queries logged yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {recentSearches.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSearchSubmit(q)}
                      className="text-left text-xs font-medium text-foreground hover:text-primary hover:underline truncate py-1 border-b border-border/40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Suggestions */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Suggested Prompts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 space-y-2">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearchSubmit(q)}
                  className="w-full flex items-center justify-between text-left text-xs p-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground font-medium group"
                >
                  <span className="truncate pr-2">{q}</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Center column: Active chat thread */}
        <div className="lg:col-span-3 flex flex-col h-[520px]">
          <Card className="flex-1 flex flex-col h-full overflow-hidden">
            <CardHeader className="border-b border-border/60 py-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  SentralQ Investigation Copilot
                </CardTitle>
                <CardDescription>
                  Query results use dynamic local fallback filters or LLMs.
                </CardDescription>
              </div>
            </CardHeader>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-slate-950/20">
              {messages.map((msg, idx) => {
                const isUser = msg.sender === "user";
                return (
                  <div
                    key={idx}
                    className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center border shadow-sm ${
                      isUser 
                        ? "bg-primary border-primary/20 text-primary-foreground" 
                        : "bg-slate-900 border-border text-primary"
                    }`}>
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>

                    {/* Speech Bubble */}
                    <div className="space-y-1">
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        isUser 
                          ? "bg-primary text-primary-foreground rounded-tr-none" 
                          : "bg-card border border-border text-foreground rounded-tl-none"
                      }`}>
                        {/* Render simple markdown styling */}
                        <div className="space-y-2 prose prose-invert max-w-none">
                          {msg.text.split("\n").map((line, lIdx) => {
                            if (line.startsWith("### ")) {
                              return <h4 key={lIdx} className="font-bold text-foreground text-xs mt-1.5">{line.replace("### ", "")}</h4>;
                            }
                            if (line.startsWith("- ")) {
                              // Bold syntax replacement
                              const parts = line.replace("- ", "").split("**");
                              return (
                                <p key={lIdx} className="pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-primary">
                                  {parts.map((p, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-foreground">{p}</strong> : p)}
                                </p>
                              );
                            }
                            // Bold formatting match inside normal line
                            const parts = line.split("**");
                            return (
                              <p key={lIdx}>
                                {parts.map((p, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold">{p}</strong> : p)}
                              </p>
                            );
                          })}
                        </div>
                      </div>

                      {/* Source Tracing Badge */}
                      {!isUser && msg.source && (
                        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-semibold px-1">
                          <Database className="h-3 w-3 text-primary" />
                          <span>Source:</span>
                          <span className={`px-1 rounded uppercase tracking-wider ${
                            msg.source === "llm_completion" 
                              ? "bg-indigo-500/15 text-indigo-500" 
                              : "bg-amber-500/15 text-amber-500"
                          }`}>
                            {msg.source.replace(/_/g, " ")}
                          </span>
                          {msg.grokModel && msg.grokModel !== "none" && (
                            <span className="text-muted-foreground/60">({msg.grokModel})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {searching && (
                <div className="flex gap-3 max-w-[80%] mr-auto items-center">
                  <div className="w-8 h-8 rounded-full bg-slate-900 border border-border text-primary flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-card border border-border">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Form Box */}
            <div className="p-3 border-t border-border/60 bg-card/60 backdrop-blur-md">
              <form onSubmit={handleFormSubmit} className="flex gap-2 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about zone visits, violations, or dwell metrics..."
                  className="w-full pl-3 pr-10 py-2.5 text-xs bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  disabled={searching}
                />
                <button
                  type="submit"
                  disabled={searching || !input.trim()}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {searching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </LayoutWrapper>
  );
};

export default AISearch;
