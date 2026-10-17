import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Send, Clock, MessageCircle } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Label } from "@/frontend/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { getConversation, replyConversation } from "@/backend/api.functions";
import { CONVERSATION_TOKEN_VALID_DAYS } from "@/utils/conversation-tokens";

export const Route = createFileRoute("/conversation/$token")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Secure Conversation — Polar Fiber" },
      {
        name: "description",
        content: "View and reply to your secure conversation with Polar Fiber.",
      },
      { property: "og:title", content: "Secure Conversation — Polar Fiber" },
      {
        property: "og:description",
        content: "Use your secure link to view messages and reply.",
      },
    ],
  }),
  component: ConversationPage,
});

interface ConversationMessage {
  id: number;
  sender_type: string;
  sender_name: string;
  reply_text: string;
  is_internal?: number;
  created_at: string;
}

interface ConversationData {
  conversation_type: "quote" | "contact_message";
  conversation_id: number;
  email: string;
  expires_at: string;
  messages: ConversationMessage[];
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dateStr;
  }
}

function timeRemaining(expiresAt: string): string {
  try {
    const exp = new Date(expiresAt);
    const now = new Date();
    const diff = exp.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}d ${hours}h ${mins}m`;
  } catch {
    return "";
  }
}

function ConversationPage() {
  const { token } = Route.useParams();
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchConversation = useServerFn(getConversation);
  const sendReply = useServerFn(replyConversation);

  useEffect(() => {
    void loadConversation();
  }, [token]);

  async function loadConversation() {
    setLoading(true);
    try {
      const result = await fetchConversation({ data: { token } });
      setConversation(result);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load conversation.");
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) {
      toast.error("Please enter a message.");
      return;
    }

    setSending(true);
    try {
      await sendReply({ data: { token, message: replyText } });
      toast.success("Your reply has been sent!");
      setReplyText("");
      await loadConversation();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reply.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-sky-500" />
          <p className="mt-4 text-gray-600">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <MessageCircle className="h-12 w-12 mx-auto text-red-400" />
          <h2 className="mt-4 text-xl font-semibold text-gray-800">Conversation Not Available</h2>
          <p className="mt-2 text-gray-600">
            This conversation link is invalid, has expired, or you may have already viewed it.
            Please contact support if you need further assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {conversation.conversation_type === "quote"
                ? "Quote Conversation"
                : "Support Conversation"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Conversation with <span className="font-medium">{conversation.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock size={16} />
            <span>Expires in {timeRemaining(conversation.expires_at)}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Messages</h2>
          {conversation.messages.length === 0 ? (
            <p className="text-gray-500">No messages yet.</p>
          ) : (
            <div className="space-y-4">
              {conversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg ${
                    msg.sender_type === "staff"
                      ? "bg-sky-50 border border-sky-100"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={`font-medium ${
                        msg.sender_type === "staff" ? "text-sky-700" : "text-gray-700"
                      }`}
                    >
                      {msg.sender_type === "staff" ? "Polar Fiber Staff" : "You"}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(msg.created_at)}</span>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap">{msg.reply_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Your Reply</h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="message" className="sr-only">
                Your message
              </Label>
              <Textarea
                id="message"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here..."
                rows={4}
                maxLength={5000}
                disabled={sending}
                required
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-400">
                  {replyText.length}/5000 characters
                </span>
                <span className="text-xs text-gray-400">
                  Link expires in {CONVERSATION_TOKEN_VALID_DAYS} days from issue
                </span>
              </div>
            </div>
            <Button type="submit" disabled={sending || !replyText.trim()} className="w-full">
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Reply
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
