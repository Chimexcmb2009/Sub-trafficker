import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, Search, Users, Eye, ShieldCheck, CheckCircle2, XCircle, 
  Clock, MessageSquare, Gamepad2, Send, Lock, Globe, Sparkles, Filter, Check, User
} from 'lucide-react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, onSnapshot, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, FriendRequest, Friendship } from '../types';
import { sendDeviceNotification } from '../utils/notifications';

interface FriendsMenuProps {
  profile: UserProfile;
  onNavigateToChat: (friendUid?: string) => void;
  onInviteToGame: (friendUid: string, friendName: string, friendPic: string) => void;
  theme?: string;
}

export default function FriendsMenu({ profile, onNavigateToChat, onInviteToGame, theme = 'light' }: FriendsMenuProps) {
  const [activeTab, setActiveTab] = useState<'friends' | 'find' | 'visitors' | 'requests'>('friends');
  
  // Real-time Lists
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequestIds, setSentRequestIds] = useState<string[]>([]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Send Request Modal State
  const [selectedUserForRequest, setSelectedUserForRequest] = useState<UserProfile | null>(null);
  const [initialMsg, setInitialMsg] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');

  // Online Visibility Toggle
  const [showOnlineStatus, setShowOnlineStatus] = useState<boolean>(profile.showOnlineStatus !== false);

  // 1. Listen to User's Accepted Friendships and Pending Incoming Requests
  useEffect(() => {
    if (!profile?.uid) return;

    // Listen to Friendships where user is userA or userB
    const q1 = query(collection(db, 'friendships'), where('userA', '==', profile.uid));
    const q2 = query(collection(db, 'friendships'), where('userB', '==', profile.uid));

    let friendsUids: string[] = [];

    const unSub1 = onSnapshot(q1, async (snap1) => {
      const uids1 = snap1.docs.map(d => d.data().userB);
      friendsUids = Array.from(new Set([...friendsUids, ...uids1]));
      fetchFriendsProfiles(friendsUids);
    }, (err) => console.warn("Friendship q1 snapshot notice:", err));

    const unSub2 = onSnapshot(q2, async (snap2) => {
      const uids2 = snap2.docs.map(d => d.data().userA);
      friendsUids = Array.from(new Set([...friendsUids, ...uids2]));
      fetchFriendsProfiles(friendsUids);
    }, (err) => console.warn("Friendship q2 snapshot notice:", err));

    // Listen to incoming Pending Friend Requests
    const reqQuery = query(
      collection(db, 'friend_requests'), 
      where('receiverUid', '==', profile.uid),
      where('status', '==', 'pending')
    );
    const unSubReq = onSnapshot(reqQuery, (reqSnap) => {
      const reqs: FriendRequest[] = [];
      reqSnap.forEach((d) => {
        reqs.push({ id: d.id, ...d.data() } as FriendRequest);
      });
      setPendingRequests(reqs);

      if (reqs.length > 0) {
        sendDeviceNotification("New Friend Request!", {
          body: `${reqs[0].senderName} sent you a friend request with a message.`
        });
      }
    }, (err) => console.warn("Pending friend requests snapshot notice:", err));

    // Listen to outgoing friend requests sent by this user
    const sentQuery = query(
      collection(db, 'friend_requests'),
      where('senderUid', '==', profile.uid)
    );
    const unSubSent = onSnapshot(sentQuery, (sentSnap) => {
      const ids: string[] = [];
      sentSnap.forEach(d => ids.push(d.data().receiverUid));
      setSentRequestIds(ids);
    }, (err) => console.warn("Sent friend requests snapshot notice:", err));

    return () => {
      unSub1();
      unSub2();
      unSubReq();
      unSubSent();
    };
  }, [profile.uid]);

  // Fetch full user profiles for friends
  const fetchFriendsProfiles = async (uids: string[]) => {
    if (uids.length === 0) {
      setFriendsList([]);
      return;
    }
    try {
      const list: UserProfile[] = [];
      for (const id of uids) {
        if (id === profile.uid) continue;
        const uDoc = await getDoc(doc(db, 'users_public', id));
        if (uDoc.exists()) {
          list.push({ uid: uDoc.id, ...uDoc.data() } as UserProfile);
        }
      }
      setFriendsList(list);
    } catch (e) {
      console.warn("Could not fetch friends profiles:", e);
    }
  };

  // Fetch All Platform Users / Visitors
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersSnap = await getDocs(collection(db, 'users_public'));
        const list: UserProfile[] = [];
        usersSnap.forEach(d => {
          if (d.id !== profile.uid) {
            list.push({ uid: d.id, ...d.data() } as UserProfile);
          }
        });
        setAllUsers(list);
      } catch (e) {
        console.warn("Could not fetch platform users:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [profile.uid]);

  // Handle Send Friend Request with 1 Initial Message
  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRequest || !initialMsg.trim()) return;

    setSendingRequest(true);
    try {
      const requestId = `${profile.uid}_${selectedUserForRequest.uid}`;
      const requestData: FriendRequest = {
        id: requestId,
        senderUid: profile.uid,
        senderName: profile.name,
        senderPic: profile.profilePic,
        senderPhone: profile.phone,
        senderUsername: profile.username || `@${profile.name.toLowerCase().replace(/\s+/g, '')}`,
        receiverUid: selectedUserForRequest.uid,
        receiverName: selectedUserForRequest.name,
        receiverPic: selectedUserForRequest.profilePic,
        initialMessage: initialMsg.trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'friend_requests', requestId), requestData);

      // Create initial message in chat thread (chatId = direct_userA_userB)
      const chatId = [profile.uid, selectedUserForRequest.uid].sort().join('_');
      await setDoc(doc(db, 'chats', chatId, 'messages', `msg_${Date.now()}`), {
        chatId,
        senderUid: profile.uid,
        senderName: profile.name,
        senderPic: profile.profilePic,
        content: `[Friend Request Message]: ${initialMsg.trim()}`,
        timestamp: new Date().toISOString()
      });

      setRequestSuccess(`Friend request and initial message sent to ${selectedUserForRequest.name}!`);
      setTimeout(() => {
        setSelectedUserForRequest(null);
        setInitialMsg('');
        setRequestSuccess('');
      }, 1800);
    } catch (e: any) {
      console.error("Error sending friend request:", e);
      alert("Failed to send request: " + e.message);
    } finally {
      setSendingRequest(false);
    }
  };

  // Accept Friend Request
  const handleAcceptRequest = async (req: FriendRequest) => {
    try {
      // 1. Update request status
      await updateDoc(doc(db, 'friend_requests', req.id), {
        status: 'accepted'
      });

      // 2. Create friendship document
      const friendshipId = [req.senderUid, req.receiverUid].sort().join('_');
      await setDoc(doc(db, 'friendships', friendshipId), {
        id: friendshipId,
        userA: req.senderUid,
        userB: req.receiverUid,
        createdAt: new Date().toISOString()
      });

      // 3. Send automated confirmation in chat
      const chatId = [req.senderUid, req.receiverUid].sort().join('_');
      await setDoc(doc(db, 'chats', chatId, 'messages', `accept_${Date.now()}`), {
        chatId,
        senderUid: profile.uid,
        senderName: profile.name,
        senderPic: profile.profilePic,
        content: `👋 Request accepted! You are now connected on Sub Trafficker.`,
        timestamp: new Date().toISOString()
      });

      sendDeviceNotification("Friend Request Accepted!", {
        body: `You are now friends with ${req.senderName}.`
      });
    } catch (e: any) {
      console.error("Error accepting request:", e);
    }
  };

  // Decline Friend Request
  const handleDeclineRequest = async (reqId: string) => {
    try {
      await updateDoc(doc(db, 'friend_requests', reqId), {
        status: 'declined'
      });
    } catch (e: any) {
      console.error(e);
    }
  };

  // Toggle Online Visibility Setting
  const handleToggleOnlineStatus = async () => {
    const nextVal = !showOnlineStatus;
    setShowOnlineStatus(nextVal);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        showOnlineStatus: nextVal,
        isOnline: nextVal ? true : false
      });
    } catch (e) {
      console.warn(e);
    }
  };

  // Filtered lists based on search query
  const filteredUsers = allUsers.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.isp?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
      
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-bold font-display text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="text-blue-600 dark:text-sky-400" size={24} />
            Network Community & Friends
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Connect with cellular traffickers, find friends, and play real-time games together.
          </p>
        </div>

        {/* Online Status Permission Toggle */}
        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Globe size={14} className="text-blue-500" />
            Online Status:
          </span>
          <button
            onClick={handleToggleOnlineStatus}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              showOnlineStatus 
                ? 'bg-emerald-500 text-white shadow-sm' 
                : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showOnlineStatus ? 'bg-white animate-ping' : 'bg-slate-400'}`} />
            {showOnlineStatus ? 'Visible' : 'Hidden'}
          </button>
        </div>
      </div>

      {/* Tabs Navigator */}
      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 min-w-[120px] py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'friends'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users size={16} />
          My Friends ({friendsList.length})
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 min-w-[130px] py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer relative ${
            activeTab === 'requests'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <UserPlus size={16} />
          Requests
          {pendingRequests.length > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full animate-bounce">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('find')}
          className={`flex-1 min-w-[130px] py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'find'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Search size={16} />
          Find Users
        </button>

        <button
          onClick={() => setActiveTab('visitors')}
          className={`flex-1 min-w-[130px] py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'visitors'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Eye size={16} />
          Recent Visitors
        </button>
      </div>

      {/* TAB 1: MY FRIENDS LIST */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          {friendsList.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
              <Users size={36} className="mx-auto text-slate-400" />
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Connected Friends Yet</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Search for phone numbers, usernames, or site visitors to send a friend request with an initial message!
              </p>
              <button
                onClick={() => setActiveTab('find')}
                className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-500 transition shadow-md"
              >
                Find & Add Friends
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {friendsList.map((f) => {
                const isOnline = f.showOnlineStatus !== false && f.isOnline;
                return (
                  <div
                    key={f.uid}
                    className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex items-center justify-between gap-3 hover:border-blue-500/50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={f.profilePic || 'https://api.dicebear.com/7.x/adventurer/svg?seed=SubTrafficker'}
                          alt={f.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                            isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                          title={isOnline ? 'Online' : 'Offline'}
                        />
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                          {f.name}
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-semibold">
                            {f.isp}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {f.phone || f.username || 'Verified Trafficker'}
                        </p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {isOnline ? 'Online Now' : 'Last seen recently'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onNavigateToChat(f.uid)}
                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition shadow-sm cursor-pointer"
                        title="Start Chat Thread"
                      >
                        <MessageSquare size={16} />
                      </button>

                      <button
                        onClick={() => onInviteToGame(f.uid, f.name, f.profilePic)}
                        className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition shadow-sm cursor-pointer"
                        title="Invite to Online Game"
                      >
                        <Gamepad2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING FRIEND REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Pending Requests</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                When someone sends you a friend request with an initial message, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-slate-800 dark:to-slate-800/80 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={req.senderPic || 'https://api.dicebear.com/7.x/adventurer/svg?seed=SubTrafficker'}
                      alt={req.senderName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{req.senderName}</h4>
                        <span className="text-[10px] text-blue-600 dark:text-sky-400 font-mono font-semibold">
                          {req.senderPhone || req.senderUsername}
                        </span>
                      </div>

                      {/* Initial Message requirement payload */}
                      <div className="p-2.5 bg-white/90 dark:bg-slate-900/90 border border-blue-100 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-medium">
                        <span className="font-bold text-blue-600 dark:text-sky-400 mr-1">Initial Message:</span>
                        "{req.initialMessage}"
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleDeclineRequest(req.id)}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <XCircle size={14} />
                      Decline
                    </button>
                    <button
                      onClick={() => handleAcceptRequest(req)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md flex items-center gap-1"
                    >
                      <CheckCircle2 size={14} />
                      Accept & Reply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FIND & ADD USERS BY NAME / PHONE / USERNAME */}
      {activeTab === 'find' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name, username, phone number, or operator..."
              className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
            {filteredUsers.map((u) => {
              const isFriend = friendsList.some(f => f.uid === u.uid);
              const isPendingSent = sentRequestIds.includes(u.uid);
              const isOnline = u.showOnlineStatus !== false && u.isOnline;

              return (
                <div
                  key={u.uid}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={u.profilePic || 'https://api.dicebear.com/7.x/adventurer/svg?seed=SubTrafficker'}
                        alt={u.name}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    </div>

                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white">{u.name}</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {u.phone || u.username || 'Trafficker'}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isFriend ? (
                      <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] rounded-lg border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                        <Check size={12} /> Friend
                      </span>
                    ) : isPendingSent ? (
                      <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-[10px] rounded-lg border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                        <Clock size={12} /> Sent
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedUserForRequest(u);
                          setInitialMsg('');
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1"
                      >
                        <UserPlus size={13} />
                        Add Friend
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: RECENT SITE VISITORS */}
      {activeTab === 'visitors' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            People currently active or recently visiting the Sub Trafficker platform:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allUsers.map((v) => {
              const isOnline = v.showOnlineStatus !== false && v.isOnline;
              return (
                <div
                  key={v.uid}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={v.profilePic || 'https://api.dicebear.com/7.x/adventurer/svg?seed=SubTrafficker'}
                        alt={v.name}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    </div>

                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                        {v.name}
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-semibold">
                          {v.isp || 'Nigeria'}
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {isOnline ? '🟢 Live on site' : 'Visited recently'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedUserForRequest(v);
                      setInitialMsg('');
                    }}
                    className="px-2.5 py-1 bg-slate-200 hover:bg-blue-600 hover:text-white dark:bg-slate-700 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 font-bold text-[10px] rounded-xl transition cursor-pointer flex items-center gap-1"
                  >
                    <UserPlus size={12} />
                    Connect
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SEND FRIEND REQUEST + 1 INITIAL MESSAGE MODAL */}
      <AnimatePresence>
        {selectedUserForRequest && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <UserPlus className="text-blue-600 dark:text-sky-400" size={20} />
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                    Send Friend Request to {selectedUserForRequest.name}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedUserForRequest(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-center gap-3">
                <img
                  src={selectedUserForRequest.profilePic || 'https://api.dicebear.com/7.x/adventurer/svg?seed=SubTrafficker'}
                  alt={selectedUserForRequest.name}
                  className="w-10 h-10 rounded-xl object-cover"
                />
                <div>
                  <h5 className="font-bold text-xs text-slate-900 dark:text-white">{selectedUserForRequest.name}</h5>
                  <p className="text-[10px] text-blue-600 dark:text-sky-400 font-mono">
                    {selectedUserForRequest.phone || selectedUserForRequest.username}
                  </p>
                </div>
              </div>

              {requestSuccess ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold text-xs rounded-2xl text-center flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} />
                  <span>{requestSuccess}</span>
                </div>
              ) : (
                <form onSubmit={handleSendFriendRequest} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      Initial Message (Required)
                    </label>
                    <textarea
                      required
                      value={initialMsg}
                      onChange={(e) => setInitialMsg(e.target.value)}
                      placeholder={`Write a friendly hello message to ${selectedUserForRequest.name} before they can accept...`}
                      className="w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 h-24 resize-none transition"
                    />
                    <p className="text-[10px] text-slate-400">
                      🔒 Sub Trafficker Policy: You must send 1 initial message with your request before {selectedUserForRequest.name} can accept and reply.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUserForRequest(null)}
                      className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendingRequest || !initialMsg.trim()}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Send size={14} />
                      {sendingRequest ? 'Sending...' : 'Send Request'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
