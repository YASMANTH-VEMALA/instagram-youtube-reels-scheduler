"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AtSign,
  Bell,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  CloudUpload,
  ExternalLink,
  FolderSync,
  HardDrive,
  TrendingUp,
  Home as HomeIcon,
  Inbox,
  MessageCircle,
  PanelLeft,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Video,
  Workflow,
} from "lucide-react";

type Section =
  | "home"
  | "inbox"
  | "comments"
  | "automations"
  | "customers"
  | "savedReplies"
  | "upload"
  | "activityLog"
  | "settings"
  | "help";

type ConnectedAccount = {
  id: string;
  userId: string;
  username: string;
  accountType?: string;
  profilePictureUrl?: string;
  connectedAt: string;
};

type AccountFilter = "all" | string;

type InstagramVideo = {
  id: string;
  accountId: string;
  username: string;
  caption: string;
  mediaType: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  timestamp?: string;
};

type VideoAutomation = {
  id: string;
  videoId: string;
  accountId: string;
  accountUsername: string;
  caption: string;
  trigger: string;
  reply: string;
  target: string;
  deliveryTitle: string;
  deliveryUrl: string;
  deliveryMessage: string;
  followersOnly: boolean;
  nonFollowerMessage: string;
  visitProfileLabel: string;
  confirmFollowLabel: string;
  status: "active" | "paused";
  createdAt: string;
  thumbnailUrl?: string;
  permalink?: string;
};

type UploadQueueItem = {
  id: string;
  driveFileId: string;
  name: string;
  mimeType: string;
  size?: string;
  folderPath: string;
  modifiedTime?: string;
  webViewLink?: string;
  caption: string;
  status:
    | "queued"
    | "scheduled"
    | "publishing"
    | "published"
    | "failed"
    | "skipped";
  targetAccountId?: string;
  scheduledAt?: string;
  detectedAt: string;
  updatedAt: string;
  attempts: number;
  instagramMediaId?: string;
  permalink?: string;
  error?: string;
};

type UploadSettings = {
  folderUrl: string;
  folderId: string;
  targetAccountId: string;
  captionTemplate: string;
  autoUpload: boolean;
  intervalHours: number;
  trendMode: boolean;
  trendNiche: string;
  hookStyle: string;
  hashtagPack: string;
  updatedAt: string;
};

const mainNav: {
  id: Section;
  label: string;
  icon: typeof HomeIcon;
}[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "comments", label: "Comments", icon: MessageCircle },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "customers", label: "Customers", icon: Users },
  { id: "savedReplies", label: "Saved replies", icon: Bookmark },
  { id: "upload", label: "Upload", icon: CloudUpload },
];

const secondaryNav: {
  id: Section;
  label: string;
  icon: typeof Clock3;
}[] = [
  { id: "activityLog", label: "Activity log", icon: Clock3 },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "help", label: "Help", icon: CircleHelp },
];

const sectionTitles: Record<Section, string> = {
  home: "Home",
  inbox: "Inbox",
  comments: "Comments",
  automations: "Automations",
  customers: "Customers",
  savedReplies: "Saved replies",
  upload: "Upload",
  activityLog: "Activity log",
  settings: "Settings",
  help: "Help",
};

const sectionHints: Record<Section, string> = {
  home: "Account health, workload, and recent automation performance.",
  inbox: "DM threads routed by account, status, and priority.",
  comments: "Recent comments that can trigger replies or follow-up flows.",
  automations: "Select account videos and attach comment or DM automations.",
  customers: "People who interacted with your connected Instagram accounts.",
  savedReplies: "Reusable response snippets available to you and automations.",
  upload: "Connect Drive, watch video folders, and auto-upload to Instagram.",
  activityLog: "Connection, routing, and automation events across accounts.",
  settings: "Workspace defaults, account connection status, and routing controls.",
  help: "Setup checklist and troubleshooting for Instagram automation.",
};

function accountInitials(username: string) {
  return username.replace("@", "").slice(0, 2).toUpperCase() || "IG";
}

function formatDate(value: string) {
  if (!value) return "Not connected";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function recordAccount(accounts: ConnectedAccount[], index: number) {
  if (!accounts.length) return "empty";
  return accounts[index % accounts.length].userId;
}

function matchesAccount(accountId: string, selected: AccountFilter) {
  return selected === "all" || accountId === selected;
}

export default function Home() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [showAccounts, setShowAccounts] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [selectedAccount, setSelectedAccount] = useState<AccountFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [videos, setVideos] = useState<InstagramVideo[]>([]);
  const [videoErrors, setVideoErrors] = useState<string[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [automationTrigger, setAutomationTrigger] = useState("price, details, link");
  const [automationReply, setAutomationReply] = useState(
    "Thanks for commenting. I am sending the details to your DM now.",
  );
  const [automationTarget, setAutomationTarget] = useState("Comment reply + DM");
  const [deliveryTitle, setDeliveryTitle] = useState("Free resource link");
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState(
    "Here is the link I promised. Let me know if you need help.",
  );
  const [followersOnly, setFollowersOnly] = useState(true);
  const [nonFollowerMessage, setNonFollowerMessage] = useState(
    "I noticed you are not following my account yet. Please follow first, then tap I am following and I will send the link.",
  );
  const [visitProfileLabel, setVisitProfileLabel] = useState("Visit profile");
  const [confirmFollowLabel, setConfirmFollowLabel] = useState("I am following");
  const [videoAutomations, setVideoAutomations] = useState<VideoAutomation[]>([]);

  const visibleAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return accounts;
    return accounts.filter((account) =>
      [account.username, account.accountType, account.userId]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [accounts, searchQuery]);

  const accountLabel =
    selectedAccount === "all"
      ? accounts.length
        ? `All accounts (${accounts.length})`
        : "No account connected"
      : accounts.find((account) => account.userId === selectedAccount)?.username ||
        "Selected account";

  const activeAccount =
    selectedAccount === "all"
      ? null
      : accounts.find((account) => account.userId === selectedAccount) || null;

  const sampleData = useMemo(() => {
    const inbox = [
      {
        id: "dm-1",
        accountId: recordAccount(accounts, 0),
        name: "Rohit Sharma",
        preview: "Can you share the workout plan price?",
        status: "open",
        priority: "High",
        time: "4m",
      },
      {
        id: "dm-2",
        accountId: recordAccount(accounts, 1),
        name: "Anika",
        preview: "I replied to your story. Need details.",
        status: "pending",
        priority: "Medium",
        time: "18m",
      },
      {
        id: "dm-3",
        accountId: recordAccount(accounts, 2),
        name: "Vikram",
        preview: "Thanks, that answer helped.",
        status: "done",
        priority: "Low",
        time: "1h",
      },
    ];

    const comments = [
      {
        id: "cm-1",
        accountId: recordAccount(accounts, 0),
        author: "@fitwithaarav",
        text: "Send the meal plan link",
        status: "open",
        post: "Morning routine reel",
      },
      {
        id: "cm-2",
        accountId: recordAccount(accounts, 1),
        author: "@meera.design",
        text: "Price please",
        status: "pending",
        post: "Offer carousel",
      },
      {
        id: "cm-3",
        accountId: recordAccount(accounts, 2),
        author: "@naveen_lifts",
        text: "Bro this was useful",
        status: "done",
        post: "Client result post",
      },
    ];

    const automations = [
      {
        id: "auto-1",
        accountId: recordAccount(accounts, 0),
        name: "Price keyword reply",
        trigger: "Comment contains price, cost, fee",
        status: "active",
        runs: 128,
      },
      {
        id: "auto-2",
        accountId: recordAccount(accounts, 1),
        name: "Story mention thank-you",
        trigger: "Story mention",
        status: "active",
        runs: 46,
      },
      {
        id: "auto-3",
        accountId: recordAccount(accounts, 2),
        name: "Welcome new DM",
        trigger: "First message",
        status: "paused",
        runs: 19,
      },
    ];

    const customers = [
      {
        id: "cu-1",
        accountId: recordAccount(accounts, 0),
        name: "Kiran",
        handle: "@kiran.moves",
        stage: "Lead",
        lastSeen: "Today",
      },
      {
        id: "cu-2",
        accountId: recordAccount(accounts, 1),
        name: "Pooja",
        handle: "@pooja.fit",
        stage: "Customer",
        lastSeen: "Yesterday",
      },
      {
        id: "cu-3",
        accountId: recordAccount(accounts, 2),
        name: "Arjun",
        handle: "@arjun.coach",
        stage: "New",
        lastSeen: "Jun 8",
      },
    ];

    const savedReplies = [
      {
        id: "reply-1",
        accountId: recordAccount(accounts, 0),
        title: "Pricing intro",
        body: "Thanks for reaching out. Here are the current plan options...",
      },
      {
        id: "reply-2",
        accountId: recordAccount(accounts, 1),
        title: "Link follow-up",
        body: "Here is the link. Reply DONE once you finish the form.",
      },
      {
        id: "reply-3",
        accountId: recordAccount(accounts, 2),
        title: "Comment thanks",
        body: "Appreciate you. Sending the details in DM now.",
      },
    ];

    return { inbox, comments, automations, customers, savedReplies };
  }, [accounts]);

  const filtered = useMemo(() => {
    const byAccount = <T extends { accountId: string }>(items: T[]) =>
      items.filter((item) => matchesAccount(item.accountId, selectedAccount));
    const byStatus = <T extends { status?: string }>(items: T[]) =>
      statusFilter === "all"
        ? items
        : items.filter((item) => item.status === statusFilter);

    return {
      inbox: byStatus(byAccount(sampleData.inbox)),
      comments: byStatus(byAccount(sampleData.comments)),
      automations: byStatus(byAccount(sampleData.automations)),
      customers: byAccount(sampleData.customers),
      savedReplies: byAccount(sampleData.savedReplies),
    };
  }, [sampleData, selectedAccount, statusFilter]);

  const selectedVideo = videos.find((video) => video.id === selectedVideoId) || null;

  const filteredVideoAutomations = videoAutomations.filter(
    (automation) =>
      matchesAccount(automation.accountId, selectedAccount) &&
      (statusFilter === "all" || automation.status === statusFilter),
  );

  const counts = {
    inbox: filtered.inbox.filter((item) => item.status !== "done").length,
    comments: filtered.comments.filter((item) => item.status !== "done").length,
    automations: filteredVideoAutomations.filter((item) => item.status === "active")
      .length,
    customers: filtered.customers.length,
    savedReplies: filtered.savedReplies.length,
  };

  async function loadAccounts() {
    const response = await fetch("/api/instagram/accounts");

    if (!response.ok) {
      setNotice("Could not load connected Instagram accounts.");
      return;
    }

    const data = (await response.json()) as { accounts: ConnectedAccount[] };
    setAccounts(data.accounts);
  }

  async function removeAccount(userId: string) {
    await fetch(`/api/instagram/accounts?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (selectedAccount === userId) setSelectedAccount("all");
    await loadAccounts();
  }

  async function loadVideos(accountFilter = selectedAccount) {
    setIsLoadingVideos(true);
    setVideoErrors([]);

    try {
      const response = await fetch(
        `/api/instagram/media?userId=${encodeURIComponent(accountFilter)}`,
      );
      const data = (await response.json()) as {
        media: InstagramVideo[];
        errors?: { username: string; message: string }[];
      };

      if (!response.ok) {
        throw new Error("Could not load account videos.");
      }

      setVideos(data.media);
      setVideoErrors(
        (data.errors || []).map((error) => `${error.username}: ${error.message}`),
      );
      setSelectedVideoId((current) =>
        data.media.some((video) => video.id === current)
          ? current
          : data.media[0]?.id || "",
      );
    } catch (error) {
      setVideos([]);
      setSelectedVideoId("");
      setVideoErrors([
        error instanceof Error ? error.message : "Could not load account videos.",
      ]);
    } finally {
      setIsLoadingVideos(false);
    }
  }

  async function loadAutomations() {
    const response = await fetch("/api/instagram/automations");

    if (!response.ok) {
      setNotice("Could not load saved automations.");
      return;
    }

    const data = (await response.json()) as {
      automations: VideoAutomation[];
    };

    if (!data.automations.length) {
      const saved = window.localStorage.getItem("instagram-video-automations");
      if (saved) {
        try {
          const localAutomations = JSON.parse(saved) as VideoAutomation[];
          await Promise.all(
            localAutomations.map((automation) =>
              fetch("/api/instagram/automations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(automation),
              }),
            ),
          );
          setVideoAutomations(localAutomations);
          return;
        } catch {
          window.localStorage.removeItem("instagram-video-automations");
        }
      }
    }

    setVideoAutomations(data.automations);
  }

  async function saveVideoAutomation() {
    if (!selectedVideo) {
      setNotice("Select a video before creating automation.");
      return;
    }

    const nextAutomation: VideoAutomation = {
      id: `${selectedVideo.id}-${Date.now()}`,
      videoId: selectedVideo.id,
      accountId: selectedVideo.accountId,
      accountUsername: selectedVideo.username,
      caption: selectedVideo.caption,
      trigger: automationTrigger.trim(),
      reply: automationReply.trim(),
      target: automationTarget,
      deliveryTitle: deliveryTitle.trim(),
      deliveryUrl: deliveryUrl.trim(),
      deliveryMessage: deliveryMessage.trim(),
      followersOnly,
      nonFollowerMessage: nonFollowerMessage.trim(),
      visitProfileLabel: visitProfileLabel.trim(),
      confirmFollowLabel: confirmFollowLabel.trim(),
      status: "active",
      createdAt: new Date().toISOString(),
      thumbnailUrl: selectedVideo.thumbnailUrl,
      permalink: selectedVideo.permalink,
    };

    if (
      !nextAutomation.trigger ||
      !nextAutomation.reply ||
      !nextAutomation.deliveryTitle ||
      !nextAutomation.deliveryMessage
    ) {
      setNotice("Automation needs keywords, reply text, and DM content.");
      return;
    }

    if (
      nextAutomation.followersOnly &&
      (!nextAutomation.nonFollowerMessage ||
        !nextAutomation.visitProfileLabel ||
        !nextAutomation.confirmFollowLabel)
    ) {
      setNotice("Follower gate needs message and both button labels.");
      return;
    }

    const response = await fetch("/api/instagram/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextAutomation),
    });

    if (!response.ok) {
      setNotice("Could not save automation on the server.");
      return;
    }

    setVideoAutomations((items) => [
      nextAutomation,
      ...items.filter((item) => item.id !== nextAutomation.id),
    ]);
    setNotice("Video automation saved.");
  }

  function addManualVideo(caption: string, permalink: string) {
    const account =
      selectedAccount === "all"
        ? accounts[0]
        : accounts.find((item) => item.userId === selectedAccount);

    if (!account) {
      setNotice("Connect or select an account before adding a video.");
      return;
    }

    const manualVideo: InstagramVideo = {
      id: `manual-${Date.now()}`,
      accountId: account.userId,
      username: account.username,
      caption: caption.trim() || "Manual video",
      mediaType: "VIDEO",
      permalink: permalink.trim(),
      timestamp: new Date().toISOString(),
    };

    setVideos((items) => [manualVideo, ...items]);
    setSelectedVideoId(manualVideo.id);
    setNotice("Video added. You can set automation now.");
  }

  useEffect(() => {
    void loadAccounts();
    void loadAutomations();

    const params = new URLSearchParams(window.location.search);
    const connected = params.get("instagram_connected");
    const error = params.get("instagram_error");
    const driveConnected = params.get("drive_connected");
    const driveError = params.get("drive_error");

    if (connected) {
      setNotice("Instagram account connected.");
      setShowAccounts(true);
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (error) {
      setNotice(`Instagram login failed: ${error}`);
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (driveConnected) {
      setNotice("Google Drive connected.");
      setActiveSection("upload");
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (driveError) {
      setNotice(`Google Drive login failed: ${driveError}`);
      setActiveSection("upload");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "automations") {
      void loadVideos(selectedAccount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, selectedAccount, accounts.length]);

  function connectOfficialInstagram() {
    window.location.href = "/api/instagram/oauth/start";
  }

  function selectSection(section: Section) {
    setActiveSection(section);
    setStatusFilter("all");
    setNotice(`${sectionTitles[section]} opened.`);
  }

  function selectedAccountName(accountId: string) {
    return (
      accounts.find((account) => account.userId === accountId)?.username ||
      "Disconnected account"
    );
  }

  const statusOptions =
    activeSection === "automations"
      ? ["all", "active", "paused"]
      : ["all", "open", "pending", "done"];

  return (
    <main className="min-h-screen bg-[#f4f5f7] text-[#1f1f1f]">
      <div className="flex min-h-screen">
        <aside className="flex min-h-screen w-full max-w-[286px] flex-col border-r border-[#dbdbdb] bg-white">
          <div className="flex h-16 items-center justify-between border-b border-[#efefef] px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center text-[#262626]">
                <Camera size={20} strokeWidth={1.9} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-semibold leading-5">
                  Instagram
                </h1>
                <p className="truncate text-xs text-[#737373]">Automation</p>
              </div>
            </div>
            <button
              aria-label="Collapse sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#737373] transition hover:bg-[#f5f5f5] hover:text-[#262626]"
            >
              <PanelLeft size={18} />
            </button>
          </div>

          <div className="border-b border-[#efefef] px-4 py-4">
            <button
              onClick={() => setShowAccounts((isOpen) => !isOpen)}
              className="flex w-full items-center justify-between rounded-md border border-[#dbdbdb] bg-white px-3 py-2.5 text-left transition hover:bg-[#fafafa]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center text-xs font-semibold text-[#262626]">
                  {activeAccount ? accountInitials(activeAccount.username) : "ALL"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {accountLabel}
                  </span>
                  <span className="block truncate text-xs text-[#737373]">
                    {activeAccount?.accountType || "Workspace filter"}
                  </span>
                </span>
              </span>
              <ChevronDown size={16} className="shrink-0 text-[#737373]" />
            </button>

            {showAccounts ? (
              <div className="mt-2 rounded-md border border-[#dbdbdb] bg-white p-1">
                <button
                  onClick={() => setSelectedAccount("all")}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm ${
                    selectedAccount === "all" ? "bg-[#f2f2f2] font-semibold" : ""
                  }`}
                >
                  <span>All accounts</span>
                  {selectedAccount === "all" ? <Check size={15} /> : null}
                </button>
                <div className="max-h-40 overflow-y-auto">
                  {visibleAccounts.map((account) => (
                    <button
                      key={account.userId}
                      onClick={() => setSelectedAccount(account.userId)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-[#fafafa] ${
                        selectedAccount === account.userId ? "bg-[#f2f2f2] font-semibold" : ""
                      }`}
                    >
                      <span className="min-w-0 truncate">{account.username}</span>
                      {selectedAccount === account.userId ? <Check size={15} /> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="mt-3 flex items-center gap-2 rounded-md border border-[#dbdbdb] bg-[#fafafa] px-3 py-2 text-[#737373]">
              <Search size={16} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search accounts"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#262626] outline-none placeholder:text-[#737373]"
              />
            </label>

            <button
              onClick={connectOfficialInstagram}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#0095f6] px-3 text-sm font-semibold text-white transition hover:bg-[#1877f2]"
            >
              <Plus size={17} />
              Connect account
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-1">
              {mainNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const count =
                  item.id === "inbox"
                    ? counts.inbox
                    : item.id === "comments"
                      ? counts.comments
                      : item.id === "automations"
                        ? counts.automations
                        : undefined;

                return (
                  <button
                    key={item.id}
                    onClick={() => selectSection(item.id)}
                    className={`flex h-10 w-full items-center justify-between rounded-md px-3 text-sm transition ${
                      isActive
                        ? "bg-[#f2f2f2] font-semibold text-[#262626]"
                        : "font-medium text-[#4a4a4a] hover:bg-[#fafafa] hover:text-[#262626]"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={19} strokeWidth={isActive ? 2.2 : 1.9} />
                      {item.label}
                    </span>
                    {count ? (
                      <span className="min-w-6 rounded-full bg-[#efefef] px-2 py-0.5 text-center text-xs font-semibold text-[#4a4a4a]">
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 border-t border-[#efefef] pt-3">
              <p className="px-3 pb-2 text-xs font-medium text-[#737373]">Manage</p>
              <div className="space-y-1">
                {secondaryNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => selectSection(item.id)}
                      className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm transition ${
                        isActive
                          ? "bg-[#f2f2f2] font-semibold text-[#262626]"
                          : "font-medium text-[#4a4a4a] hover:bg-[#fafafa] hover:text-[#262626]"
                      }`}
                    >
                      <Icon size={19} strokeWidth={isActive ? 2.2 : 1.9} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="border-t border-[#efefef] px-4 py-4">
            {notice ? (
              <div className="mb-3 rounded-md border border-[#dbdbdb] bg-[#fafafa] px-3 py-2 text-xs leading-5 text-[#4a4a4a]">
                {notice}
              </div>
            ) : null}

            <div className="mb-3 grid grid-cols-3 gap-2">
              <button
                aria-label="Mentions"
                onClick={() => selectSection("comments")}
                className="flex h-9 items-center justify-center rounded-md border border-[#dbdbdb] text-[#4a4a4a] transition hover:bg-[#fafafa]"
              >
                <AtSign size={17} />
              </button>
              <button
                aria-label="Notifications"
                onClick={() => selectSection("activityLog")}
                className="flex h-9 items-center justify-center rounded-md border border-[#dbdbdb] text-[#4a4a4a] transition hover:bg-[#fafafa]"
              >
                <Bell size={17} />
              </button>
              <button
                aria-label="Profile"
                onClick={() => setShowAccounts((isOpen) => !isOpen)}
                className={`flex h-9 items-center justify-center rounded-md border text-[#4a4a4a] transition hover:bg-[#fafafa] ${
                  showAccounts ? "border-[#262626]" : "border-[#dbdbdb]"
                }`}
              >
                <UserRound size={17} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center text-xs font-semibold text-[#262626]">
                YA
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#262626]">
                  Yasmanth
                </p>
                <p className="truncate text-xs text-[#737373]">Owner</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 gap-4 p-4">
          <div className="min-w-0 flex-1">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#737373]">{accountLabel}</p>
                <h2 className="text-2xl font-semibold tracking-normal text-[#1f1f1f]">
                  {sectionTitles[activeSection]}
                </h2>
                <p className="mt-1 text-sm text-[#737373]">
                  {sectionHints[activeSection]}
                </p>
              </div>
              <button
                onClick={connectOfficialInstagram}
                className="flex h-10 items-center gap-2 rounded-md bg-[#262626] px-4 text-sm font-semibold text-white transition hover:bg-[#111]"
              >
                <Plus size={17} />
                Connect account
              </button>
            </header>

            {activeSection === "home" ? (
              <HomeView accounts={accounts} counts={counts} filtered={filtered} />
            ) : null}

            {activeSection === "inbox" ? (
              <ListView
                emptyLabel="No DM threads for this filter."
                rows={filtered.inbox.map((item) => ({
                  id: item.id,
                  icon: Inbox,
                  title: item.name,
                  subtitle: item.preview,
                  meta: `${selectedAccountName(item.accountId)} · ${item.time}`,
                  badge: item.priority,
                  status: item.status,
                }))}
              />
            ) : null}

            {activeSection === "comments" ? (
              <ListView
                emptyLabel="No comments for this filter."
                rows={filtered.comments.map((item) => ({
                  id: item.id,
                  icon: MessageCircle,
                  title: item.author,
                  subtitle: item.text,
                  meta: `${selectedAccountName(item.accountId)} · ${item.post}`,
                  badge: item.status,
                  status: item.status,
                }))}
              />
            ) : null}

            {activeSection === "automations" ? (
              <AutomationsVideoView
                videos={videos}
                videoErrors={videoErrors}
                isLoadingVideos={isLoadingVideos}
                selectedVideoId={selectedVideoId}
                setSelectedVideoId={setSelectedVideoId}
                selectedVideo={selectedVideo}
                automationTrigger={automationTrigger}
                setAutomationTrigger={setAutomationTrigger}
                automationReply={automationReply}
                setAutomationReply={setAutomationReply}
                automationTarget={automationTarget}
                setAutomationTarget={setAutomationTarget}
                deliveryTitle={deliveryTitle}
                setDeliveryTitle={setDeliveryTitle}
                deliveryUrl={deliveryUrl}
                setDeliveryUrl={setDeliveryUrl}
                deliveryMessage={deliveryMessage}
                setDeliveryMessage={setDeliveryMessage}
                followersOnly={followersOnly}
                setFollowersOnly={setFollowersOnly}
                nonFollowerMessage={nonFollowerMessage}
                setNonFollowerMessage={setNonFollowerMessage}
                visitProfileLabel={visitProfileLabel}
                setVisitProfileLabel={setVisitProfileLabel}
                confirmFollowLabel={confirmFollowLabel}
                setConfirmFollowLabel={setConfirmFollowLabel}
                saveVideoAutomation={saveVideoAutomation}
                automations={filteredVideoAutomations}
                refreshVideos={() => void loadVideos(selectedAccount)}
                addManualVideo={addManualVideo}
              />
            ) : null}

            {activeSection === "customers" ? (
              <ListView
                emptyLabel="No customers for this account."
                rows={filtered.customers.map((item) => ({
                  id: item.id,
                  icon: Users,
                  title: `${item.name} ${item.handle}`,
                  subtitle: `Stage: ${item.stage}`,
                  meta: `${selectedAccountName(item.accountId)} · ${item.lastSeen}`,
                  badge: item.stage,
                }))}
              />
            ) : null}

            {activeSection === "savedReplies" ? (
              <ListView
                emptyLabel="No saved replies for this account."
                rows={filtered.savedReplies.map((item) => ({
                  id: item.id,
                  icon: Bookmark,
                  title: item.title,
                  subtitle: item.body,
                  meta: selectedAccountName(item.accountId),
                  badge: "Reply",
                }))}
              />
            ) : null}

            {activeSection === "upload" ? (
              <UploadView
                accounts={accounts}
                selectedAccount={selectedAccount}
              />
            ) : null}

            {activeSection === "activityLog" ? (
              <ActivityView accounts={accounts} selectedAccount={selectedAccount} />
            ) : null}

            {activeSection === "settings" ? (
              <SettingsView
                accounts={accounts}
                selectedAccount={selectedAccount}
                removeAccount={removeAccount}
              />
            ) : null}

            {activeSection === "help" ? <HelpView /> : null}
          </div>

          <aside className="hidden w-[320px] shrink-0 lg:block">
            <div className="sticky top-4 space-y-3">
              <div className="rounded-md border border-[#dbdbdb] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#262626]">Account filter</p>
                  <span className="rounded-full bg-[#f2f2f2] px-2 py-1 text-xs font-semibold text-[#4a4a4a]">
                    {accounts.length}
                  </span>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedAccount("all")}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                      selectedAccount === "all"
                        ? "border-[#262626] bg-[#f7f7f7] font-semibold"
                        : "border-[#dbdbdb] bg-white"
                    }`}
                  >
                    <span>All accounts</span>
                    {selectedAccount === "all" ? <Check size={16} /> : null}
                  </button>
                  {accounts.map((account) => (
                    <button
                      key={account.userId}
                      onClick={() => setSelectedAccount(account.userId)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                        selectedAccount === account.userId
                          ? "border-[#262626] bg-[#f7f7f7] font-semibold"
                          : "border-[#dbdbdb] bg-white"
                      }`}
                    >
                      <span className="min-w-0 truncate">{account.username}</span>
                      {selectedAccount === account.userId ? <Check size={16} /> : null}
                    </button>
                  ))}
                </div>
              </div>

              {["inbox", "comments", "automations"].includes(activeSection) ? (
                <div className="rounded-md border border-[#dbdbdb] bg-white p-4">
                  <p className="mb-3 text-sm font-semibold text-[#262626]">
                    {sectionTitles[activeSection]} status
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => setStatusFilter(option)}
                        className={`h-9 rounded-md border px-3 text-sm capitalize ${
                          statusFilter === option
                            ? "border-[#262626] bg-[#262626] font-semibold text-white"
                            : "border-[#dbdbdb] bg-white text-[#4a4a4a]"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border border-[#dbdbdb] bg-white p-4">
                <p className="mb-3 text-sm font-semibold text-[#262626]">
                  Section actions
                </p>
                <div className="space-y-2">
                  <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#dbdbdb] text-sm font-semibold text-[#262626] hover:bg-[#fafafa]">
                    <Sparkles size={16} />
                    Create for {sectionTitles[activeSection]}
                  </button>
                  <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#dbdbdb] text-sm font-semibold text-[#262626] hover:bg-[#fafafa]">
                    <Send size={16} />
                    Export filtered view
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function HomeView({
  accounts,
  counts,
  filtered,
}: {
  accounts: ConnectedAccount[];
  counts: {
    inbox: number;
    comments: number;
    automations: number;
    customers: number;
    savedReplies: number;
  };
  filtered: {
    inbox: { id: string; name: string; preview: string; status: string }[];
    comments: { id: string; author: string; text: string; status: string }[];
  };
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Accounts" value={accounts.length} icon={Users} />
        <Metric label="Open inbox" value={counts.inbox} icon={Inbox} />
        <Metric label="Comments" value={counts.comments} icon={MessageCircle} />
        <Metric label="Active flows" value={counts.automations} icon={Workflow} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Recent inbox">
          <CompactRows
            rows={filtered.inbox.map((item) => ({
              id: item.id,
              title: item.name,
              subtitle: item.preview,
              status: item.status,
            }))}
          />
        </Panel>
        <Panel title="Recent comments">
          <CompactRows
            rows={filtered.comments.map((item) => ({
              id: item.id,
              title: item.author,
              subtitle: item.text,
              status: item.status,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}

function UploadView({
  accounts,
  selectedAccount,
}: {
  accounts: ConnectedAccount[];
  selectedAccount: AccountFilter;
}) {
  const availableAccounts =
    selectedAccount === "all"
      ? accounts
      : accounts.filter((account) => account.userId === selectedAccount);
  const defaultTargetAccount = availableAccounts[0]?.userId || "all";
  const accountById = useMemo(
    () => Object.fromEntries(accounts.map((account) => [account.userId, account.username])),
    [accounts],
  );
  const [driveConnected, setDriveConnected] = useState(false);
  const [autoUpload, setAutoUpload] = useState(true);
  const [folderUrl, setFolderUrl] = useState("");
  const [targetAccount, setTargetAccount] = useState(defaultTargetAccount);
  const [captionTemplate, setCaptionTemplate] = useState(
    "Stop scrolling. This exercise targets {title} in under 30 seconds.\n\nSave this for your next workout.",
  );
  const [intervalHours, setIntervalHours] = useState(4);
  const [trendMode, setTrendMode] = useState(true);
  const [trendNiche, setTrendNiche] = useState("Fitness / exercise");
  const [hookStyle, setHookStyle] = useState("Problem -> quick fix");
  const [hashtagPack, setHashtagPack] = useState(
    "#fitness #workout #gymtips #exercise #homeworkout #reelsindia",
  );
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [uploadNotice, setUploadNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const autoScanKey = useRef("");
  const effectiveTargetAccount =
    selectedAccount !== "all" ? selectedAccount : targetAccount;

  const settingsPayload = {
    folderUrl,
    targetAccountId: effectiveTargetAccount,
    captionTemplate,
    autoUpload,
    intervalHours,
    trendMode,
    trendNiche,
    hookStyle,
    hashtagPack,
  };

  const queueCounts = queue.reduce(
    (counts, item) => ({
      ...counts,
      [item.status]: (counts[item.status] || 0) + 1,
    }),
    {} as Record<string, number>,
  );

  async function loadUploadState() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/upload/status", { cache: "no-store" });
      const data = (await response.json()) as {
        driveConnected: boolean;
        settings: UploadSettings | null;
        queue: UploadQueueItem[];
      };

      if (!response.ok) throw new Error("Could not load upload state.");
      setDriveConnected(data.driveConnected);
      setQueue(data.queue || []);

      if (data.settings) {
        setFolderUrl(data.settings.folderUrl);
        setTargetAccount(
          selectedAccount !== "all"
            ? selectedAccount
            : data.settings.targetAccountId || defaultTargetAccount,
        );
        setCaptionTemplate(data.settings.captionTemplate);
        setAutoUpload(data.settings.autoUpload);
        setIntervalHours(data.settings.intervalHours || 4);
        setTrendMode(data.settings.trendMode);
        setTrendNiche(data.settings.trendNiche);
        setHookStyle(data.settings.hookStyle);
        setHashtagPack(data.settings.hashtagPack);
      }
    } catch (error) {
      setUploadNotice(
        error instanceof Error ? error.message : "Could not load upload state.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function saveSettings() {
    const response = await fetch("/api/upload/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsPayload),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not save settings.");
  }

  async function scanFolder() {
    setIsScanning(true);
    setUploadNotice("Scanning Drive folder...");
    try {
      const response = await fetch("/api/upload/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsPayload),
      });
      const data = (await response.json()) as {
        found?: number;
        added?: number;
        queue?: UploadQueueItem[];
        error?: string;
      };

      if (!response.ok) throw new Error(data.error || "Scan failed.");
      setQueue(data.queue || []);
      setUploadNotice(`Scan complete: ${data.found || 0} videos found, ${data.added || 0} new queued.`);
    } catch (error) {
      setUploadNotice(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setIsScanning(false);
    }
  }

  async function scheduleAll() {
    setIsScheduling(true);
    setUploadNotice("Scheduling queue...");
    try {
      await saveSettings();
      const response = await fetch("/api/upload/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalHours, targetAccountId: effectiveTargetAccount }),
      });
      const data = (await response.json()) as {
        scheduled?: number;
        firstScheduledAt?: string | null;
        queue?: UploadQueueItem[];
        error?: string;
      };

      if (!response.ok) throw new Error(data.error || "Could not schedule queue.");
      setQueue(data.queue || []);
      setUploadNotice(
        data.scheduled
          ? `Scheduled ${data.scheduled} clips. First post: ${formatDateTime(data.firstScheduledAt)}.`
          : "No clips available to schedule.",
      );
    } catch (error) {
      setUploadNotice(error instanceof Error ? error.message : "Could not schedule queue.");
    } finally {
      setIsScheduling(false);
    }
  }

  async function queueAction(id: string, action: "skip" | "retry" | "publish") {
    setUploadNotice(action === "publish" ? "Publishing Reel..." : "Updating queue item...");
    const response = await fetch(`/api/upload/items/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setUploadNotice(data.error || "Queue action failed.");
      return;
    }

    await loadUploadState();
    setUploadNotice(action === "publish" ? "Publish request finished." : "Queue item updated.");
  }

  useEffect(() => {
    void loadUploadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!driveConnected || !folderUrl || queue.length || isLoading || isScanning) {
      return;
    }

    const key = `${folderUrl}:${effectiveTargetAccount}`;
    if (autoScanKey.current === key) return;
    autoScanKey.current = key;
    void scanFolder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveConnected, folderUrl, queue.length, isLoading, isScanning, effectiveTargetAccount]);

  useEffect(() => {
    if (selectedAccount !== "all") {
      setTargetAccount(selectedAccount);
      return;
    }

    if (targetAccount === "all" && defaultTargetAccount !== "all") {
      setTargetAccount(defaultTargetAccount);
    }
  }, [defaultTargetAccount, selectedAccount, targetAccount]);

  function connectDrive() {
    window.location.href = "/api/google/oauth/start";
  }

  function formatBytes(size?: string) {
    const bytes = Number(size || 0);
    if (!bytes) return "Unknown size";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }

  function formatDateTime(value?: string | null) {
    if (!value) return "Not scheduled";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function statusClass(status: UploadQueueItem["status"]) {
    if (status === "published") return "bg-[#e9f8ef] text-[#137333]";
    if (status === "failed") return "bg-[#fdecec] text-[#b42318]";
    if (status === "publishing") return "bg-[#fff4db] text-[#8a5a00]";
    if (status === "scheduled") return "bg-[#eef3ff] text-[#1d4ed8]";
    return "bg-[#f2f2f2] text-[#4a4a4a]";
  }

  function accountName(accountId?: string) {
    return accountById[accountId || ""] || "No target account";
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="rounded-md border border-[#dbdbdb] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efefef] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#262626]">
                Google Drive source
              </p>
              <p className="text-xs text-[#737373]">
                Watch a Drive folder and prepare videos for Instagram upload.
              </p>
            </div>
            <button
              onClick={connectDrive}
              className={`flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                driveConnected
                  ? "border-[#262626] bg-[#262626] text-white"
                  : "border-[#dbdbdb] text-[#262626] hover:bg-[#fafafa]"
              }`}
            >
              <HardDrive size={16} />
              {driveConnected ? "Drive connected" : "Connect Drive"}
            </button>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-[#4a4a4a]">
                Drive folder URL
              </span>
              <input
                value={folderUrl}
                onChange={(event) => setFolderUrl(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] px-3 text-sm outline-none focus:border-[#262626]"
                placeholder="https://drive.google.com/drive/folders/..."
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#4a4a4a]">
                Schedule interval
              </span>
              <select
                value={intervalHours}
                onChange={(event) => setIntervalHours(Number(event.target.value))}
                className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] bg-white px-3 text-sm outline-none focus:border-[#262626]"
              >
                <option value={4}>Every 4 hours, 24/7</option>
                <option value={3}>Every 3 hours, 24/7</option>
                <option value={6}>Every 6 hours, 24/7</option>
                <option value={12}>Every 12 hours, 24/7</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#4a4a4a]">
                Target account
              </span>
              <select
                value={effectiveTargetAccount}
                onChange={(event) => setTargetAccount(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] bg-white px-3 text-sm outline-none focus:border-[#262626]"
              >
                <option value="all">Choose posting account</option>
                {availableAccounts.map((account) => (
                  <option key={account.userId} value={account.userId}>
                    {account.username}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-[#dbdbdb] p-3">
              <input
                checked={autoUpload}
                onChange={(event) => setAutoUpload(event.target.checked)}
                type="checkbox"
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-semibold text-[#262626]">
                  Auto-upload new videos
                </span>
                <span className="block text-xs leading-5 text-[#737373]">
                  Scheduled items publish when the worker reaches their time.
                </span>
              </span>
            </label>
          </div>

          <div className="border-t border-[#efefef] p-4">
            <label className="block">
              <span className="text-xs font-semibold text-[#4a4a4a]">
                Caption template
              </span>
              <textarea
                value={captionTemplate}
                onChange={(event) => setCaptionTemplate(event.target.value)}
                className="mt-1 min-h-24 w-full resize-none rounded-md border border-[#dbdbdb] px-3 py-2 text-sm outline-none focus:border-[#262626]"
              />
            </label>
          </div>
        </div>

        <div className="rounded-md border border-[#dbdbdb] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efefef] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#262626]">Upload queue</p>
              <p className="text-xs text-[#737373]">
                Videos detected from Drive, scheduled, and published by the worker.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void scanFolder()}
                disabled={isScanning}
                className="flex h-9 items-center gap-2 rounded-md border border-[#dbdbdb] px-3 text-sm font-semibold text-[#262626] hover:bg-[#fafafa] disabled:opacity-50"
              >
                <FolderSync size={16} />
                {isScanning ? "Scanning" : "Scan folder"}
              </button>
              <button
                onClick={() => void scheduleAll()}
                disabled={isScheduling || !queue.length}
                className="flex h-9 items-center gap-2 rounded-md bg-[#262626] px-3 text-sm font-semibold text-white hover:bg-[#111] disabled:opacity-50"
              >
                <Clock3 size={16} />
                Schedule all
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="px-4 py-6 text-sm text-[#737373]">Loading upload queue...</div>
          ) : queue.length ? (
            queue.slice(0, 200).map((item) => (
              <div
                key={item.id}
                className="grid gap-3 border-b border-[#efefef] px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Video size={18} className="mt-0.5 shrink-0 text-[#262626]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#262626]">
                      {item.name}
                    </p>
                    <p className="truncate text-xs text-[#737373]">
                      {item.folderPath} · {formatBytes(item.size)} · {formatDateTime(item.scheduledAt)} · Target {accountName(item.targetAccountId)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#4a4a4a]">
                      {item.caption}
                    </p>
                    {item.error ? (
                      <p className="mt-1 text-xs font-medium text-[#b42318]">{item.error}</p>
                    ) : null}
                    {item.permalink ? (
                      <a
                        href={item.permalink}
                        target="_blank"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#1877f2]"
                      >
                        View Reel <ExternalLink size={12} />
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="rounded-full bg-[#f7f7f7] px-2.5 py-1 text-xs font-semibold text-[#737373]">
                    {item.attempts}/3
                  </span>
                  {item.status === "failed" ? (
                    <button
                      onClick={() => void queueAction(item.id, "retry")}
                      className="h-8 rounded-md border border-[#dbdbdb] px-3 text-xs font-semibold text-[#262626] hover:bg-[#fafafa]"
                    >
                      Retry
                    </button>
                  ) : null}
                  {item.status !== "published" && item.status !== "skipped" ? (
                    <button
                      onClick={() => void queueAction(item.id, "publish")}
                      className="h-8 rounded-md border border-[#dbdbdb] px-3 text-xs font-semibold text-[#262626] hover:bg-[#fafafa]"
                    >
                      Publish now
                    </button>
                  ) : null}
                  {item.status !== "published" && item.status !== "skipped" ? (
                    <button
                      onClick={() => void queueAction(item.id, "skip")}
                      className="h-8 rounded-md border border-[#dbdbdb] px-3 text-xs font-semibold text-[#4a4a4a] hover:bg-[#fafafa]"
                    >
                      Skip
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-[#737373]">
              Connect Drive, paste your folder URL, then scan to queue clips.
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-md border border-[#dbdbdb] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#262626]">
                <TrendingUp size={16} />
                Trend mode
              </p>
              <p className="mt-1 text-xs text-[#737373]">
                Optimize each upload for reach before publishing.
              </p>
            </div>
            <button
              onClick={() => setTrendMode((enabled) => !enabled)}
              className={`h-9 rounded-md border px-3 text-sm font-semibold ${
                trendMode
                  ? "border-[#262626] bg-[#262626] text-white"
                  : "border-[#dbdbdb] text-[#262626]"
              }`}
            >
              {trendMode ? "On" : "Off"}
            </button>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-[#4a4a4a]">Niche</span>
            <select
              value={trendNiche}
              onChange={(event) => setTrendNiche(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] bg-white px-3 text-sm outline-none focus:border-[#262626]"
            >
              <option>Fitness / exercise</option>
              <option>Startup / business</option>
              <option>Education</option>
              <option>Motivation</option>
              <option>Lifestyle</option>
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-semibold text-[#4a4a4a]">
              Hook style
            </span>
            <select
              value={hookStyle}
              onChange={(event) => setHookStyle(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] bg-white px-3 text-sm outline-none focus:border-[#262626]"
            >
              <option>Problem -&gt; quick fix</option>
              <option>3 mistakes</option>
              <option>Do this, not that</option>
              <option>Beginner friendly</option>
              <option>Save this routine</option>
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-semibold text-[#4a4a4a]">
              Hashtag pack
            </span>
            <textarea
              value={hashtagPack}
              onChange={(event) => setHashtagPack(event.target.value)}
              className="mt-1 min-h-20 w-full resize-none rounded-md border border-[#dbdbdb] px-3 py-2 text-sm outline-none focus:border-[#262626]"
            />
          </label>

          <div className="mt-3 rounded-md border border-[#efefef] bg-[#fafafa] p-3 text-xs leading-5 text-[#737373]">
            Captions are generated from filename, folder path, niche, hook style,
            template, and hashtag pack. If OpenAI is unavailable, the template is used.
          </div>
        </div>

        <div className="rounded-md border border-[#dbdbdb] bg-white p-4">
          <p className="text-sm font-semibold text-[#262626]">Upload status</p>
          <div className="mt-3 space-y-3 text-sm">
            <StatusLine label="Drive" value={driveConnected ? "Connected" : "Not connected"} />
            <StatusLine label="Folder" value={folderUrl ? "Configured" : "Missing"} />
            <StatusLine label="Mode" value={autoUpload ? "Auto-upload on" : "Manual"} />
            <StatusLine label="Target" value={accountName(effectiveTargetAccount)} />
            <StatusLine label="Schedule" value={`Every ${intervalHours} hours`} />
            <StatusLine label="Trend mode" value={trendMode ? trendNiche : "Off"} />
            <StatusLine label="Queued" value={String(queueCounts.queued || 0)} />
            <StatusLine label="Scheduled" value={String(queueCounts.scheduled || 0)} />
            <StatusLine label="Published" value={String(queueCounts.published || 0)} />
          </div>
        </div>

        <div className="rounded-md border border-[#dbdbdb] bg-white p-4">
          <p className="text-sm font-semibold text-[#262626]">Worker</p>
          <p className="mt-2 text-sm leading-6 text-[#737373]">
            Keep `npm run upload-worker` running beside the dev server. It checks
            due scheduled clips every minute and publishes the next Reel.
          </p>
          {uploadNotice ? (
            <div className="mt-3 rounded-md border border-[#dbdbdb] bg-[#fafafa] px-3 py-2 text-xs leading-5 text-[#4a4a4a]">
              {uploadNotice}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#efefef] pb-2 last:border-b-0 last:pb-0">
      <span className="text-[#737373]">{label}</span>
      <span className="truncate text-right font-semibold text-[#262626]">{value}</span>
    </div>
  );
}

function AutomationsVideoView({
  videos,
  videoErrors,
  isLoadingVideos,
  selectedVideoId,
  setSelectedVideoId,
  selectedVideo,
  automationTrigger,
  setAutomationTrigger,
  automationReply,
  setAutomationReply,
  automationTarget,
  setAutomationTarget,
  deliveryTitle,
  setDeliveryTitle,
  deliveryUrl,
  setDeliveryUrl,
  deliveryMessage,
  setDeliveryMessage,
  followersOnly,
  setFollowersOnly,
  nonFollowerMessage,
  setNonFollowerMessage,
  visitProfileLabel,
  setVisitProfileLabel,
  confirmFollowLabel,
  setConfirmFollowLabel,
  saveVideoAutomation,
  automations,
  refreshVideos,
  addManualVideo,
}: {
  videos: InstagramVideo[];
  videoErrors: string[];
  isLoadingVideos: boolean;
  selectedVideoId: string;
  setSelectedVideoId: (value: string) => void;
  selectedVideo: InstagramVideo | null;
  automationTrigger: string;
  setAutomationTrigger: (value: string) => void;
  automationReply: string;
  setAutomationReply: (value: string) => void;
  automationTarget: string;
  setAutomationTarget: (value: string) => void;
  deliveryTitle: string;
  setDeliveryTitle: (value: string) => void;
  deliveryUrl: string;
  setDeliveryUrl: (value: string) => void;
  deliveryMessage: string;
  setDeliveryMessage: (value: string) => void;
  followersOnly: boolean;
  setFollowersOnly: (value: boolean) => void;
  nonFollowerMessage: string;
  setNonFollowerMessage: (value: string) => void;
  visitProfileLabel: string;
  setVisitProfileLabel: (value: string) => void;
  confirmFollowLabel: string;
  setConfirmFollowLabel: (value: string) => void;
  saveVideoAutomation: () => void;
  automations: VideoAutomation[];
  refreshVideos: () => void;
  addManualVideo: (caption: string, permalink: string) => void;
}) {
  const [manualCaption, setManualCaption] = useState("");
  const [manualPermalink, setManualPermalink] = useState("");

  function submitManualVideo() {
    addManualVideo(manualCaption, manualPermalink);
    setManualCaption("");
    setManualPermalink("");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="rounded-md border border-[#dbdbdb] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efefef] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#262626]">Account videos</p>
              <p className="text-xs text-[#737373]">
                Select a video to attach comment and DM automation.
              </p>
            </div>
            <button
              onClick={refreshVideos}
              className="h-9 rounded-md border border-[#dbdbdb] px-3 text-sm font-semibold text-[#262626] hover:bg-[#fafafa]"
            >
              Refresh videos
            </button>
          </div>

          {videoErrors.length ? (
            <div className="border-b border-[#efefef] px-4 py-3 text-sm text-[#8a4b00]">
              {videoErrors.join(" ")}
            </div>
          ) : null}

          {isLoadingVideos ? (
            <div className="p-8 text-center text-sm text-[#737373]">
              Loading account videos...
            </div>
          ) : videos.length ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-3">
              {videos.map((video) => {
                const isSelected = selectedVideoId === video.id;

                return (
                  <button
                    key={video.id}
                    onClick={() => setSelectedVideoId(video.id)}
                    className={`overflow-hidden rounded-md border bg-white text-left transition hover:border-[#262626] ${
                      isSelected ? "border-[#262626]" : "border-[#dbdbdb]"
                    }`}
                  >
                    <div className="aspect-[9/12] w-full overflow-hidden bg-[#f7f7f7]">
                      {video.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[#737373]">
                          <Video size={28} />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-[#737373]">
                          {video.username}
                        </span>
                        {isSelected ? <Check size={16} /> : null}
                      </div>
                      <p className="line-clamp-2 min-h-10 text-sm font-semibold text-[#262626]">
                        {video.caption}
                      </p>
                      <p className="mt-2 text-xs text-[#737373]">
                        {video.timestamp ? formatDate(video.timestamp) : "Video"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4">
              <div className="rounded-md border border-[#efefef] p-4">
                <p className="text-sm font-semibold text-[#262626]">
                  No videos were found for this account filter.
                </p>
                <p className="mt-1 text-sm text-[#737373]">
                  Add a reel or video permalink manually to set automation for it.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <input
                    value={manualCaption}
                    onChange={(event) => setManualCaption(event.target.value)}
                    placeholder="Video name"
                    className="h-10 rounded-md border border-[#dbdbdb] px-3 text-sm outline-none focus:border-[#262626]"
                  />
                  <input
                    value={manualPermalink}
                    onChange={(event) => setManualPermalink(event.target.value)}
                    placeholder="Instagram video URL"
                    className="h-10 rounded-md border border-[#dbdbdb] px-3 text-sm outline-none focus:border-[#262626]"
                  />
                  <button
                    onClick={submitManualVideo}
                    className="h-10 rounded-md bg-[#262626] px-4 text-sm font-semibold text-white hover:bg-[#111]"
                  >
                    Add video
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md border border-[#dbdbdb] bg-white">
          <div className="border-b border-[#efefef] px-4 py-3">
            <p className="text-sm font-semibold text-[#262626]">
              Saved video automations
            </p>
          </div>
          {automations.length ? (
            automations.map((automation) => (
              <div
                key={automation.id}
                className="flex items-center justify-between gap-3 border-b border-[#efefef] px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md border border-[#efefef] bg-[#f7f7f7]">
                    {automation.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={automation.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#262626]">
                      {automation.caption}
                    </p>
                    <p className="truncate text-sm text-[#4a4a4a]">
                      When: {automation.trigger}
                    </p>
                    <p className="truncate text-xs text-[#737373]">
                      {automation.accountUsername} · {automation.target}
                    </p>
                    <p className="truncate text-xs text-[#737373]">
                      Sends: {automation.deliveryTitle || "DM content"}
                      {automation.followersOnly ? " · Followers only" : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[#f2f2f2] px-2.5 py-1 text-xs font-semibold capitalize text-[#4a4a4a]">
                  {automation.status}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-sm text-[#737373]">
              No video automations saved for this filter.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border border-[#dbdbdb] bg-white p-4">
        <p className="text-sm font-semibold text-[#262626]">Set automation</p>
        <p className="mt-1 text-xs text-[#737373]">
          Choose one video and define what should happen when people comment.
        </p>

        {selectedVideo ? (
          <div className="mt-4 rounded-md border border-[#efefef] p-3">
            <p className="line-clamp-2 text-sm font-semibold text-[#262626]">
              {selectedVideo.caption}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#737373]">
              <span className="truncate">{selectedVideo.username}</span>
              {selectedVideo.permalink ? (
                <a
                  href={selectedVideo.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1 font-semibold text-[#262626]"
                >
                  Open <ExternalLink size={13} />
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-[#efefef] p-3 text-sm text-[#737373]">
            Select a video from the list.
          </div>
        )}

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-[#4a4a4a]">
            Trigger keywords
          </span>
          <input
            value={automationTrigger}
            onChange={(event) => setAutomationTrigger(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] px-3 text-sm outline-none focus:border-[#262626]"
            placeholder="price, details, link"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-[#4a4a4a]">Action</span>
          <select
            value={automationTarget}
            onChange={(event) => setAutomationTarget(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] bg-white px-3 text-sm outline-none focus:border-[#262626]"
          >
            <option>Comment reply + DM</option>
            <option>DM only</option>
            <option>Comment reply only</option>
          </select>
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-[#4a4a4a]">Reply text</span>
          <textarea
            value={automationReply}
            onChange={(event) => setAutomationReply(event.target.value)}
            className="mt-1 min-h-28 w-full resize-none rounded-md border border-[#dbdbdb] px-3 py-2 text-sm outline-none focus:border-[#262626]"
          />
        </label>

        <div className="mt-4 border-t border-[#efefef] pt-4">
          <p className="text-sm font-semibold text-[#262626]">DM content</p>
          <p className="mt-1 text-xs text-[#737373]">
            This is what the automation sends when the person is allowed to receive
            the link.
          </p>
        </div>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-[#4a4a4a]">
            Content name
          </span>
          <input
            value={deliveryTitle}
            onChange={(event) => setDeliveryTitle(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] px-3 text-sm outline-none focus:border-[#262626]"
            placeholder="Workout PDF, Notion template, free guide"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-[#4a4a4a]">
            Link to send
          </span>
          <input
            value={deliveryUrl}
            onChange={(event) => setDeliveryUrl(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] px-3 text-sm outline-none focus:border-[#262626]"
            placeholder="https://..."
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-[#4a4a4a]">
            DM message with content
          </span>
          <textarea
            value={deliveryMessage}
            onChange={(event) => setDeliveryMessage(event.target.value)}
            className="mt-1 min-h-24 w-full resize-none rounded-md border border-[#dbdbdb] px-3 py-2 text-sm outline-none focus:border-[#262626]"
          />
        </label>

        <label className="mt-4 flex items-start gap-3 rounded-md border border-[#dbdbdb] p-3">
          <input
            checked={followersOnly}
            onChange={(event) => setFollowersOnly(event.target.checked)}
            type="checkbox"
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-semibold text-[#262626]">
              Only send link to followers
            </span>
            <span className="block text-xs leading-5 text-[#737373]">
              Non-followers get a follow request first, then can tap confirmation.
            </span>
          </span>
        </label>

        {followersOnly ? (
          <div className="mt-3 rounded-md border border-[#dbdbdb] p-3">
            <p className="text-xs font-semibold text-[#4a4a4a]">
              Non-follower message
            </p>
            <textarea
              value={nonFollowerMessage}
              onChange={(event) => setNonFollowerMessage(event.target.value)}
              className="mt-1 min-h-24 w-full resize-none rounded-md border border-[#dbdbdb] px-3 py-2 text-sm outline-none focus:border-[#262626]"
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label>
                <span className="text-xs font-semibold text-[#4a4a4a]">
                  Profile button
                </span>
                <input
                  value={visitProfileLabel}
                  onChange={(event) => setVisitProfileLabel(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] px-3 text-sm outline-none focus:border-[#262626]"
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-[#4a4a4a]">
                  Confirm button
                </span>
                <input
                  value={confirmFollowLabel}
                  onChange={(event) => setConfirmFollowLabel(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-[#dbdbdb] px-3 text-sm outline-none focus:border-[#262626]"
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-md border border-[#efefef] p-3">
          <p className="text-xs font-semibold text-[#4a4a4a]">DM preview</p>
          <div className="mt-2 space-y-2 text-sm text-[#262626]">
            {followersOnly ? (
              <div className="rounded-md border border-[#dbdbdb] p-3">
                <p>{nonFollowerMessage}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <span className="rounded-md border border-[#dbdbdb] px-3 py-2 text-center text-xs font-semibold">
                    {visitProfileLabel}
                  </span>
                  <span className="rounded-md border border-[#dbdbdb] px-3 py-2 text-center text-xs font-semibold">
                    {confirmFollowLabel}
                  </span>
                </div>
              </div>
            ) : null}
            <div className="rounded-md border border-[#dbdbdb] p-3">
              <p>{deliveryMessage}</p>
              {deliveryUrl ? (
                <p className="mt-2 truncate text-xs font-semibold text-[#262626]">
                  {deliveryUrl}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <button
          onClick={saveVideoAutomation}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#262626] px-3 text-sm font-semibold text-white transition hover:bg-[#111]"
        >
          <Sparkles size={16} />
          Save automation
        </button>
      </div>
    </div>
  );
}

function ListView({
  rows,
  emptyLabel,
}: {
  rows: {
    id: string;
    icon: typeof Inbox;
    title: string;
    subtitle: string;
    meta: string;
    badge: string;
    status?: string;
  }[];
  emptyLabel: string;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-md border border-[#dbdbdb] bg-white p-8 text-center text-sm text-[#737373]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[#dbdbdb] bg-white">
      {rows.map((row) => {
        const Icon = row.icon;

        return (
          <div
            key={row.id}
            className="flex items-center justify-between gap-4 border-b border-[#efefef] px-4 py-3 last:border-b-0 hover:bg-[#fafafa]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center text-[#262626]">
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#262626]">
                  {row.title}
                </p>
                <p className="truncate text-sm text-[#4a4a4a]">{row.subtitle}</p>
                <p className="truncate text-xs text-[#737373]">{row.meta}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-[#f2f2f2] px-2.5 py-1 text-xs font-semibold capitalize text-[#4a4a4a]">
              {row.badge}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ActivityView({
  accounts,
  selectedAccount,
}: {
  accounts: ConnectedAccount[];
  selectedAccount: AccountFilter;
}) {
  const rows = accounts
    .filter((account) => matchesAccount(account.userId, selectedAccount))
    .map((account) => ({
      id: account.userId,
      title: `${account.username} connected`,
      subtitle: `OAuth account added on ${formatDate(account.connectedAt)}`,
    }));

  return (
    <Panel title="Recent activity">
      <CompactRows
        rows={
          rows.length
            ? rows
            : [
                {
                  id: "empty",
                  title: "No activity yet",
                  subtitle: "Connect an account or change filters to see events.",
                },
              ]
        }
      />
    </Panel>
  );
}

function SettingsView({
  accounts,
  selectedAccount,
  removeAccount,
}: {
  accounts: ConnectedAccount[];
  selectedAccount: AccountFilter;
  removeAccount: (userId: string) => Promise<void>;
}) {
  const rows = accounts.filter((account) =>
    matchesAccount(account.userId, selectedAccount),
  );

  return (
    <div className="rounded-md border border-[#dbdbdb] bg-white">
      <div className="border-b border-[#efefef] px-4 py-3">
        <p className="text-sm font-semibold text-[#262626]">Connected accounts</p>
      </div>
      {rows.length ? (
        rows.map((account) => (
          <div
            key={account.userId}
            className="flex items-center justify-between gap-3 border-b border-[#efefef] px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#262626]">
                {account.username}
              </p>
              <p className="truncate text-xs text-[#737373]">
                {account.accountType || "Instagram profile"} · Connected{" "}
                {formatDate(account.connectedAt)}
              </p>
            </div>
            <button
              onClick={() => void removeAccount(account.userId)}
              className="flex h-9 items-center gap-2 rounded-md border border-[#dbdbdb] px-3 text-sm font-semibold text-[#4a4a4a] hover:bg-[#fafafa]"
            >
              <Trash2 size={15} />
              Remove
            </button>
          </div>
        ))
      ) : (
        <div className="px-4 py-8 text-sm text-[#737373]">
          No connected account matches this filter.
        </div>
      )}
    </div>
  );
}

function HelpView() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Connection checklist">
        <CompactRows
          rows={[
            {
              id: "1",
              title: "Meta redirect URI",
              subtitle: "The ngrok callback must exactly match the app settings.",
            },
            {
              id: "2",
              title: "Professional account",
              subtitle: "Use an Instagram professional account for API access.",
            },
            {
              id: "3",
              title: "Reconnect after ngrok changes",
              subtitle: "Restart OAuth when the public URL changes.",
            },
          ]}
        />
      </Panel>
      <Panel title="Support">
        <p className="text-sm leading-6 text-[#4a4a4a]">
          Use the account filter to isolate one profile or choose all accounts to
          review the complete workspace. Every sidebar section now updates this
          workspace and the right-side filter panel.
        </p>
      </Panel>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-md border border-[#dbdbdb] bg-white p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center text-[#262626]">
        <Icon size={18} />
      </div>
      <p className="text-2xl font-semibold text-[#262626]">{value}</p>
      <p className="text-sm text-[#737373]">{label}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#dbdbdb] bg-white">
      <div className="border-b border-[#efefef] px-4 py-3">
        <p className="text-sm font-semibold text-[#262626]">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CompactRows({
  rows,
}: {
  rows: { id: string; title: string; subtitle: string; status?: string }[];
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-[#262626]">
            {row.status === "done" ? <Check size={15} /> : <Activity size={15} />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#262626]">
              {row.title}
            </p>
            <p className="line-clamp-2 text-sm text-[#737373]">{row.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
