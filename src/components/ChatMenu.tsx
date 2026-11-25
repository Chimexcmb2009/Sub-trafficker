import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, Paperclip, Smile, Image as ImageIcon, Users, Hash, 
  Search, Shield, Phone, Video, Gamepad2, Bell, CheckCheck, Clock, Sparkles
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ChatMessage } from '../types';
import { sendDeviceNotification } from '../utils/notifications';

interface ChatMenuProps {
  profile: UserProfile;
  initialActiveFriendUid?: string | null;
  onNavigateToGaming?: (roomId?: string) => void;
  theme?: string;
}

interface CommunityChannel {
  id: string;
  name: string;
  description: string;
  icon: string;
  unreadCount?: number;
}

const COMMUNITY_CHANNELS: CommunityChannel[] = [
  { id: 'general-traffickers', name: '#general-traffickers', description: 'Main lounge for airtime & data traffickers across Nigeria', icon: '🌐' },
  { id: 'cellular-nodes', name: '#cellular-nodes', description: 'Network carrier updates, SIM sync & harvest tips', icon: '📡' },
  { id: 'gamers-arena', name: '#gamers-arena', description: 'Multiplayer game rooms, match invites & high scores', icon: '🎮' },
];

export default function ChatMenu({ profile, initialActiveFriendUid, onNavigateToGaming, theme = 'light' }: ChatMenuProps) {
  const [chatType, setChatType] = useState<'direct' | 'community'>('direct');
  
  // Direct Friends
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [activeFriend, setActiveFriend] = useState<UserProfile | null>(null);

  // Active Community Channel
  const [activeChannel, setActiveChannel] = useState<CommunityChannel>(COMMUNITY_CHANNELS[0]);

  // Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Emojis Quick Picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const quickEmojis = ['👍', '🔥', '🚀', '💸', '🎮', '🇳🇬', '❤️', '👏', '⚡'];

  // 1. Fetch Friends for Direct Messaging
  useEffect(() => {
    if (!profile?.uid) return;

    const q1 = query(collection(db, 'friendships'), where('userA', '==', profile.uid));
    const q2 = query(collection(db, 'friendships'), where('userB', '==', profile.uid));

    let uids: string[] = [];

    const fetchFriendsData = async (friendUids: string[]) => {
      const list: UserProfile[] = [];
      for (const id of friendUids) {
        if (id === profile.uid) continue;
        const uDoc = await getDoc(doc(db, 'users', id));
        if (uDoc.exists()) {
          list.push({ uid: uDoc.id, ...uDoc.data() } as UserProfile);
        }
      }
      setFriendsList(list);

      // Set initial active friend if passed or pick first
      if (initialActiveFriendUid) {
        const found = list.find(f => f.uid === initialActiveFriendUid);
        if (found) setActiveFriend(found);
        else if (list.length > 0) setActiveFriend(list[0]);
      } else if (!activeFriend && list.length > 0) {
        setActiveFriend(list[0]);
      }
    };

    const unSub1 = onSnapshot(q1, (snap1) => {
      const u1 = snap1.docs.map(d => d.data().userB);
      uids = Array.from(new Set([...uids, ...u1]));
      fetchFriendsData(uids);
    }, (err) => console.warn("Chat friends q1 snapshot notice:", err));

    const unSub2 = onSnapshot(q2, (snap2) => {
      const u2 = snap2.docs.map(d => d.data().userA);
      uids = Array.from(new Set([...uids, ...u2]));
      fetchFriendsData(uids);
    }, (err) => console.warn("Chat friends q2 snapshot notice:", err));

    return () => {
      unSub1();
      unSub2();
    };
  }, [profile.uid, initialActiveFriendUid]);

  // 2. Real-time Listener for Active Direct Chat or Community Channel
  useEffect(() => {
    if (!profile?.uid) return;

    let unSubChat: (() => void) | null = null;

    if (chatType === 'direct' && activeFriend) {
      const chatId = [profile.uid, activeFriend.uid].sort().join('_');
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'asc')
      );

      unSubChat = onSnapshot(q, (snapshot) => {
        const list: ChatMessage[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as ChatMessage);
        });
        setMessages(list);

        // Notify if new message from friend
        if (list.length > 0) {
          const lastMsg = list[list.length - 1];
          if (lastMsg.senderUid !== profile.uid) {
            sendDeviceNotification(`Message from ${lastMsg.senderName}`, {
              body: lastMsg.content
            });
          }
        }
      }, (err) => console.warn("Direct chat messages snapshot notice:", err));
    } else if (chatType === 'community') {
      const q = query(
        collection(db, 'community_chats', activeChannel.id, 'messages'),
        orderBy('timestamp', 'asc')
      );

      unSubChat = onSnapshot(q, (snapshot) => {
        const list: ChatMessage[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as ChatMessage);
        });
        setMessages(list);
      }, (err) => console.warn("Community chat messages snapshot notice:", err));
    }

    return () => {
      if (unSubChat) unSubChat();
    };
  }, [chatType, activeFriend?.uid, activeChannel.id, profile.uid]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() && !attachment) return;

    const contentText = inputMsg.trim();
    setInputMsg('');
    setShowEmojiPicker(false);

    try {
      const msgObj = {
        senderUid: profile.uid,
        senderName: profile.name,
        senderPic: profile.profilePic,
        content: contentText,
        attachmentUrl: attachment || null,
        timestamp: new Date().toISOString()
      };

      if (chatType === 'direct' && activeFriend) {
        const chatId = [profile.uid, activeFriend.uid].sort().join('_');
        const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
        await setDoc(msgRef, {
          id: msgRef.id,
          chatId,
          ...msgObj
        });
      } else if (chatType === 'community') {
        const msgRef = doc(collection(db, 'community_chats', activeChannel.id, 'messages'));
        await setDoc(msgRef, {
          id: msgRef.id,
          chatId: activeChannel.id,
          ...msgObj
        });
      }

      setAttachment(null);
    } catch (err: any) {
      console.error("Error sending message:", err);
    }
  };

  // Simulate Photo Attachment
  const handleSimulateAttachment = () => {
    const samples = [
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=400&q=80'
    ];
    setAttachment(samples[Math.floor(Math.random() * samples.length)]);
  };

  // Filtered messages by search
  const displayedMessages = messages.filter(m => {
    if (!searchFilter.trim()) return true;
    return m.content.toLowerCase().includes(searchFilter.toLowerCase());
  });

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[620px]">
      
      {/* LEFT SIDEBAR: THREADS & CHANNELS */}
      <div className="w-full md:w-80 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col shrink-0">
        
        {/* Top Header Switcher */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              onClick={() => setChatType('direct')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                chatType === 'direct'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users size={14} />
              Direct ({friendsList.length})
            </button>
            <button
              onClick={() => setChatType('community')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                chatType === 'community'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Hash size={14} />
              Community
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search chat history..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* THREAD LIST */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chatType === 'direct' ? (
            friendsList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <Users size={28} className="mx-auto opacity-50" />
                <p className="font-bold">No Friends Yet</p>
                <p className="text-[11px] opacity-80">Add friends from the Friends menu to start messaging.</p>
              </div>
            ) : (
              friendsList.map((f) => {
                const isActive = activeFriend?.uid === f.uid;
                const isOnline = f.showOnlineStatus !== false && f.isOnline;

                return (
                  <button
                    key={f.uid}
                    onClick={() => setActiveFriend(f)}
                    className={`w-full p-3 rounded-2xl flex items-center gap-3 transition text-left cursor-pointer ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={f.profilePic || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                        alt={f.name}
                        className="w-10 h-10 rounded-xl object-cover border border-white/20"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                          isActive ? 'border-blue-600' : 'border-slate-50 dark:border-slate-950'
                        } ${isOnline ? 'bg-emerald-400' : 'bg-slate-400'}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-xs truncate">{f.name}</h5>
                        <span className={`text-[9px] font-mono ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                          {f.isp}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        {isOnline ? '🟢 Online' : 'Tap to open chat'}
                      </p>
                    </div>
                  </button>
                );
              })
            )
          ) : (
            COMMUNITY_CHANNELS.map((ch) => {
              const isActive = activeChannel.id === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch)}
                  className={`w-full p-3 rounded-2xl flex items-center gap-3 transition text-left cursor-pointer ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span className="text-xl">{ch.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-xs">{ch.name}</h5>
                    <p className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      {ch.description}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT MAIN CHAT WINDOW */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
        
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
          {chatType === 'direct' ? (
            activeFriend ? (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={activeFriend.profilePic || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt={activeFriend.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                    activeFriend.showOnlineStatus !== false && activeFriend.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                  }`} />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    {activeFriend.name}
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-semibold">
                      {activeFriend.isp}
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {activeFriend.showOnlineStatus !== false && activeFriend.isOnline ? 'Online Now' : 'Offline'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 font-bold">Select a friend to message</div>
            )
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-2xl">{activeChannel.icon}</span>
              <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">{activeChannel.name}</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{activeChannel.description}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {chatType === 'direct' && activeFriend && onNavigateToGaming && (
              <button
                onClick={() => onNavigateToGaming()}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Gamepad2 size={14} />
                <span>Play Game</span>
              </button>
            )}
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <Shield size={12} /> Encrypted
            </span>
          </div>
        </div>

        {/* MESSAGES THREAD CANVAS */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-slate-900/40">
          {displayedMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
              <div className="p-4 bg-blue-50 dark:bg-slate-800 rounded-full text-blue-500">
                <MessageSquare size={32} />
              </div>
              <h5 className="font-bold text-sm text-slate-700 dark:text-slate-300">No Messages Yet</h5>
              <p className="text-xs text-slate-400 max-w-xs">
                Send a message to start the conversation on Sub Trafficker!
              </p>
            </div>
          ) : (
            displayedMessages.map((msg) => {
              const isMe = msg.senderUid === profile.uid;

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <img
                    src={msg.senderPic || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt={msg.senderName}
                    className="w-8 h-8 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                  />

                  <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end text-right' : 'items-start text-left'}`}>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{msg.senderName}</span>
                      <span>•</span>
                      <span>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-tl-none'
                      }`}
                    >
                      {/* Game Invite Card embedded in chat */}
                      {msg.gameInvite ? (
                        <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-xl space-y-2 text-white">
                          <div className="flex items-center gap-2 text-purple-300 font-bold">
                            <Gamepad2 size={18} />
                            <span>Online Game Invite</span>
                          </div>
                          <p className="text-xs opacity-90">{msg.content}</p>
                          {onNavigateToGaming && (
                            <button
                              onClick={() => onNavigateToGaming(msg.gameInvite?.roomId)}
                              className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-xs rounded-xl shadow-md transition cursor-pointer text-center block"
                            >
                              Join Match Now 🎮
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}

                      {/* Attachment preview */}
                      {msg.attachmentUrl && (
                        <img
                          src={msg.attachmentUrl}
                          alt="Attachment"
                          className="mt-2 rounded-xl max-h-48 object-cover border border-white/20"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* EMOJI QUICK PICKER */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="p-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 overflow-x-auto"
            >
              <span className="text-xs font-bold text-slate-500">Quick React:</span>
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setInputMsg(prev => prev + emoji)}
                  className="p-1.5 bg-white dark:bg-slate-900 hover:scale-125 transition text-lg rounded-lg shadow-sm cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ATTACHMENT PREVIEW BAR */}
        {attachment && (
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-blue-600 font-bold flex items-center gap-1.5">
              <ImageIcon size={14} /> Attached image preview ready
            </span>
            <button
              onClick={() => setAttachment(null)}
              className="text-slate-400 hover:text-rose-500 font-bold"
            >
              Remove
            </button>
          </div>
        )}

        {/* INPUT FORM BAR */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Emoji Picker"
          >
            <Smile size={20} />
          </button>

          <button
            type="button"
            onClick={handleSimulateAttachment}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Attach Image"
          >
            <Paperclip size={20} />
          </button>

          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder={chatType === 'direct' ? `Message ${activeFriend?.name || 'friend'}...` : `Post to ${activeChannel.name}...`}
            className="flex-1 py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-medium text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
          />

          <button
            type="submit"
            disabled={!inputMsg.trim() && !attachment}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-2xl shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Send size={18} />
          </button>
        </form>

      </div>

    </div>
  );
}
