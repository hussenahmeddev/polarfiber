import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { EmptyState } from "@/frontend/components/EmptyState";
import { useStore } from "@/frontend/store";
import { Search, Plus, Send, MessageSquare } from "lucide-react";
import {
  getCustomerConversations,
  getCustomerConversationMessages,
  createCustomerConversation,
  replyToCustomerConversation,
} from "@/backend/api.functions";

// Customer Message Thread Types
interface CustomerConversation {
  conversation_id: number;
  user_id: number;
  subject: string;
  topic: string;
  status: "Awaiting Reply" | "Admin Replied" | "Resolved";
  created_at: string;
  updated_at: string;
  last_message_text?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
}

interface CustomerMessage {
  message_id: number;
  conversation_id: number;
  sender_type: "customer" | "admin";
  sender_id: number;
  sender_name: string;
  text: string;
  is_read: number;
  created_at: string;
}

export const Route = createFileRoute("/dashboard/messages")({
  component: DashboardMessages,
});

function DashboardMessages() {
  const { user } = useStore();

  const fetchConversations = useServerFn(getCustomerConversations);
  const fetchConversationMessages = useServerFn(getCustomerConversationMessages);
  const mutateCreateConversation = useServerFn(createCustomerConversation);
  const mutateReplyConversation = useServerFn(replyToCustomerConversation);

  const conversationsQuery = useQuery({
    queryKey: ["customer", "conversations", user?.user_id],
    queryFn: () => fetchConversations(),
    enabled: !!user,
  });

  const [selectedConversation, setSelectedConversation] =
    React.useState<CustomerConversation | null>(null);
  const [conversationMessages, setConversationMessages] = React.useState<CustomerMessage[]>([]);
  const [messageSearch, setMessageSearch] = React.useState("");
  const [replyInput, setReplyInput] = React.useState("");
  const [newMessageDialogOpen, setNewMessageDialogOpen] = React.useState(false);
  const [newMessageForm, setNewMessageForm] = React.useState({
    subject: "",
    topic: "General Inquiry",
    text: "",
  });
  const [loadingMessages, setLoadingMessages] = React.useState(false);

  const filteredConversations = (conversationsQuery.data ?? []).filter((c) => {
    return (
      c.subject.toLowerCase().includes(messageSearch.toLowerCase()) ||
      c.topic.toLowerCase().includes(messageSearch.toLowerCase()) ||
      (c.last_message_text?.toLowerCase().includes(messageSearch.toLowerCase()) ?? false)
    );
  });

  const handleSendReply = async () => {
    if (!replyInput.trim() || !selectedConversation) return;

    setLoadingMessages(true);
    try {
      await mutateReplyConversation({
        data: {
          conversation_id: selectedConversation.conversation_id,
          text: replyInput.trim(),
        },
      });
      const messages = await fetchConversationMessages({
        data: { conversation_id: selectedConversation.conversation_id },
      });
      setConversationMessages(messages);
      conversationsQuery.refetch();
      setReplyInput("");
      toast.success("Message sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleCreateNewConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageForm.subject.trim() || !newMessageForm.text.trim()) {
      toast.error("Please fill in subject and message.");
      return;
    }

    try {
      const result = await mutateCreateConversation({ data: newMessageForm });
      if (result.conversation_id) {
        conversationsQuery.refetch();
        setNewMessageDialogOpen(false);
        setNewMessageForm({ subject: "", topic: "General Inquiry", text: "" });
        toast.success("New message sent successfully!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create conversation");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Direct Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chat directly with Polar Fiber engineers, sales, and support
          </p>
        </div>
        <Button
          onClick={() => setNewMessageDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <Plus className="h-4 w-4" />
          New Message
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Conversation List */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder="Search conversations..."
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
              className="pl-8 text-xs border-border h-8"
            />
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {conversationsQuery.isLoading ? (
              <p className="p-8 text-center text-xs text-muted-foreground/60">
                Loading conversations...
              </p>
            ) : conversationsQuery.data?.length === 0 ? (
              <p className="p-8 text-center text-xs text-muted-foreground/60">
                No message threads found. Start a new conversation!
              </p>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected =
                  selectedConversation?.conversation_id === conv.conversation_id;
                return (
                  <div
                    key={conv.conversation_id}
                    onClick={() => {
                      setSelectedConversation(conv);
                      setLoadingMessages(true);
                      fetchConversationMessages({
                        data: { conversation_id: conv.conversation_id },
                      })
                        .then((msgs) => {
                          setConversationMessages(msgs);
                          setLoadingMessages(false);
                        })
                        .catch(() => setLoadingMessages(false));
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {conv.topic}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          conv.status === "Admin Replied"
                            ? "bg-emerald-100 text-emerald-800"
                            : conv.status === "Resolved"
                              ? "bg-muted text-muted-foreground"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {conv.status}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm text-foreground mt-1 line-clamp-1">
                      {conv.subject}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {conv.last_message_text ?? "No messages yet"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 text-right">
                      {conv.updated_at}
                    </p>
                    {conv.unread_count && conv.unread_count > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600">
                        {conv.unread_count} unread
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Message Stream & Reply Box */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs lg:col-span-2 flex flex-col justify-between min-h-[500px]">
          {selectedConversation ? (
            <div className="flex flex-col h-full justify-between space-y-4">
              {/* Conversation Header */}
              <div className="border-b border-border pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    {selectedConversation.subject}
                  </h3>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Topic: {selectedConversation.topic}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    selectedConversation.status === "Admin Replied"
                      ? "bg-emerald-100 text-emerald-800"
                      : selectedConversation.status === "Resolved"
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {selectedConversation.status}
                </span>
              </div>

              {/* Message History Bubble Stream */}
              <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[380px] p-2">
                {loadingMessages ? (
                  <p className="p-4 text-center text-xs text-muted-foreground/60">
                    Loading messages...
                  </p>
                ) : conversationMessages.length === 0 ? (
                  <p className="p-8 text-center text-xs text-muted-foreground/60">
                    No messages in this conversation yet.
                  </p>
                ) : (
                  conversationMessages.map((m) => {
                    const isMe = m.sender_type === "customer";
                    return (
                      <div
                        key={m.message_id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground/60">
                          <span className="font-semibold text-muted-foreground">
                            {m.sender_name}
                          </span>
                          <span>·</span>
                          <span>{new Date(m.created_at).toLocaleString()}</span>
                        </div>
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-tr-xs"
                              : "bg-muted text-foreground rounded-tl-xs border border-border/60"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Input Box */}
              <div className="pt-3 border-t border-border flex items-center gap-2">
                <Input
                  placeholder="Type your response or follow-up question..."
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  className="bg-muted/50 border-border flex-1"
                  disabled={loadingMessages}
                />
                <Button
                  onClick={handleSendReply}
                  disabled={loadingMessages || !replyInput.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                >
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="No conversation selected"
              description="Select a conversation thread from the left or create a new message."
              className="border-none py-20"
            />
          )}
        </div>
      </div>

      {/* New Message Dialog */}
      {newMessageDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <form
            onSubmit={handleCreateNewConversation}
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-lg text-foreground">New Message to Polar Fiber</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">
                  Department / Topic
                </Label>
                <select
                  value={newMessageForm.topic}
                  onChange={(e) =>
                    setNewMessageForm({ ...newMessageForm, topic: e.target.value })
                  }
                  className="w-full h-10 rounded-lg border border-border px-3 text-sm mt-1"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Custom Engineering">Custom Engineering</option>
                  <option value="Order Status Inquiry">Order Status Inquiry</option>
                  <option value="Delivery Support">Delivery Support</option>
                  <option value="Warranty & Maintenance">Warranty & Maintenance</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Subject</Label>
                <Input
                  value={newMessageForm.subject}
                  onChange={(e) =>
                    setNewMessageForm({ ...newMessageForm, subject: e.target.value })
                  }
                  placeholder="e.g. Inquiring on tank flange connection specs"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Message</Label>
                <textarea
                  rows={4}
                  value={newMessageForm.text}
                  onChange={(e) =>
                    setNewMessageForm({ ...newMessageForm, text: e.target.value })
                  }
                  placeholder="Write your question or request..."
                  className="w-full rounded-xl border border-border p-3 text-sm focus:outline-primary mt-1"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNewMessageDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Send Message
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
