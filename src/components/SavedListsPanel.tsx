import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bookmark,
  Plus,
  Trash2,
  FolderPlus,
  Check,
  ExternalLink,
  Play,
  Volume2,
  LogIn,
  LogOut,
  Cloud,
  Edit3,
  Copy,
  Download,
  FileText,
  BookOpen,
  Sparkles,
  Search,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from '../firebase';
import {
  SavedUserList,
  SavedListItem,
  ListCategory,
  ListItemType,
  subscribeToUserLists,
  subscribeToListItems,
  createUserList,
  deleteUserList,
  addItemToUserList,
  updateListItemNotes,
  deleteItemFromUserList,
  loadLocalLists,
  loadLocalListItems,
} from '../services/listsService';
import { APP_THEMES } from '../constants';
import { ThemeId, VideoMetadata } from '../types';
import { speechService } from '../services/speechService';

interface SavedListsPanelProps {
  currentTheme: ThemeId;
  currentVideoMetadata: VideoMetadata | null;
  currentVideoUrl: string;
  currentSummaryMarkdown: string;
  onLoadSavedVideo: (url: string, savedMarkdown?: string, savedTitle?: string) => void;
  onAppendToSummary?: (markdownText: string) => void;
  user: User | null;
}

const CATEGORY_LABELS: Record<ListCategory, string> = {
  favorites: 'Favorites',
  videos: 'Videos to Watch',
  study: 'Study Notes',
  reading: 'Books & Articles',
  general: 'General',
};

const ITEM_TYPE_LABELS: Record<ListItemType, string> = {
  summary: 'Video Summary',
  video: 'YouTube Video',
  book: 'Book',
  article: 'Article',
  note: 'Personal Note',
};

export const SavedListsPanel: React.FC<SavedListsPanelProps> = ({
  currentTheme,
  currentVideoMetadata,
  currentVideoUrl,
  currentSummaryMarkdown,
  onLoadSavedVideo,
  onAppendToSummary,
  user,
}) => {
  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  const [lists, setLists] = useState<SavedUserList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [items, setItems] = useState<SavedListItem[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  // Create new list form state
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListCategory, setNewListCategory] = useState<ListCategory>('favorites');
  const [isSubmittingList, setIsSubmittingList] = useState(false);

  // Add custom item form state
  const [isAddingCustomItem, setIsAddingCustomItem] = useState(false);
  const [customItemType, setCustomItemType] = useState<ListItemType>('note');
  const [customTitle, setCustomTitle] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  // Editing item notes
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Status feedback
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [savedCurrentVideo, setSavedCurrentVideo] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [speakingItemId, setSpeakingItemId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 3500);
  };

  // Load lists from Firestore when signed in, or from localStorage when signed out
  useEffect(() => {
    if (user) {
      const unsub = subscribeToUserLists(user.uid, async (remoteLists) => {
        if (remoteLists.length === 0) {
          // Automatically create a friendly starter list in Firestore for a newly signed-in user
          try {
            const created = await createUserList(
              'My Favorite Video Summaries',
              'Videos, summaries, and big lessons I want to keep.',
              'favorites'
            );
            setLists([created]);
            setSelectedListId(created.id);
          } catch {}
        } else {
          setLists(remoteLists);
          setSelectedListId((prev) =>
            prev && remoteLists.some((l) => l.id === prev) ? prev : remoteLists[0].id
          );
        }
      });
      return () => unsub();
    } else {
      const local = loadLocalLists();
      setLists(local);
      if (local.length > 0) {
        setSelectedListId(local[0].id);
      }
    }
  }, [user]);

  // Load items for the currently selected list
  useEffect(() => {
    if (!selectedListId) {
      setItems([]);
      return;
    }
    if (user) {
      const ownsList = lists.some((l) => l.id === selectedListId && l.ownerId === user.uid);
      if (!ownsList || selectedListId === 'list_default_favorites') {
        setItems([]);
        return;
      }
      const unsub = subscribeToListItems(selectedListId, user.uid, (remoteItems) => {
        setItems(remoteItems);
      });
      return () => unsub();
    } else {
      const allLocal = loadLocalListItems();
      setItems(allLocal.filter((i) => i.listId === selectedListId));
    }
  }, [selectedListId, user, lists]);

  const activeList = lists.find((l) => l.id === selectedListId) || lists[0] || null;

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
      showNotice('Signed in with Google! Your lists are now synced with Firebase.');
    } catch (err: any) {
      setAuthError(err?.message || 'Could not sign in with Google.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      showNotice('Signed out. Showing your local lists.');
    } catch {}
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || isSubmittingList) return;
    setIsSubmittingList(true);
    try {
      const created = await createUserList(newListName, newListDesc, newListCategory);
      if (!user) {
        const updated = loadLocalLists();
        setLists(updated);
      }
      setSelectedListId(created.id);
      setNewListName('');
      setNewListDesc('');
      setIsCreatingList(false);
      showNotice(`Created list "${created.name}"`);
    } catch (err: any) {
      showNotice('Could not create list. Please try again.');
    } finally {
      setIsSubmittingList(false);
    }
  };

  const handleDeleteList = async (listToDelete: SavedUserList) => {
    try {
      await deleteUserList(listToDelete.id);
      if (!user) {
        const remaining = loadLocalLists();
        setLists(remaining);
        setSelectedListId(remaining[0]?.id || '');
      }
      showNotice(`Removed list "${listToDelete.name}"`);
    } catch {
      showNotice('Could not delete list.');
    }
  };

  const handleSaveCurrentVideoToList = async () => {
    if (!activeList || !currentVideoMetadata) return;
    try {
      await addItemToUserList(activeList.id, {
        itemType: 'summary',
        title: currentVideoMetadata.title || 'YouTube Video Summary',
        url: currentVideoUrl || currentVideoMetadata.url || '',
        subtitle: currentVideoMetadata.authorName || 'YouTube Channel',
        content: currentSummaryMarkdown || '',
        notes: '',
      });
      if (!user) {
        setItems(loadLocalListItems().filter((i) => i.listId === activeList.id));
      }
      setSavedCurrentVideo(true);
      setTimeout(() => setSavedCurrentVideo(false), 3000);
      showNotice(`Saved "${currentVideoMetadata.title}" to "${activeList.name}"`);
    } catch {
      showNotice('Could not save video to list.');
    }
  };

  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !customTitle.trim()) return;
    try {
      await addItemToUserList(activeList.id, {
        itemType: customItemType,
        title: customTitle,
        url: customUrl,
        subtitle: customSubtitle,
        content: customContent,
        notes: customNotes,
      });
      if (!user) {
        setItems(loadLocalListItems().filter((i) => i.listId === activeList.id));
      }
      setCustomTitle('');
      setCustomUrl('');
      setCustomSubtitle('');
      setCustomContent('');
      setCustomNotes('');
      setIsAddingCustomItem(false);
      showNotice(`Added "${customTitle}" to "${activeList.name}"`);
    } catch {
      showNotice('Could not add item to list.');
    }
  };

  const handleSaveEditedNotes = async (item: SavedListItem) => {
    if (!activeList) return;
    try {
      await updateListItemNotes(activeList.id, item.id, editingNotesText);
      if (!user) {
        setItems(loadLocalListItems().filter((i) => i.listId === activeList.id));
      }
      setEditingItemId(null);
      showNotice('Saved your personal notes.');
    } catch {
      showNotice('Could not update notes.');
    }
  };

  const handleRemoveItem = async (item: SavedListItem) => {
    if (!activeList) return;
    try {
      await deleteItemFromUserList(activeList.id, item.id);
      if (!user) {
        setItems(loadLocalListItems().filter((i) => i.listId === activeList.id));
      }
      showNotice(`Removed "${item.title}" from list.`);
    } catch {
      showNotice('Could not remove item.');
    }
  };

  const handleReadItemAloud = (item: SavedListItem) => {
    if (speakingItemId === item.id) {
      speechService.stop();
      setSpeakingItemId(null);
    } else {
      speechService.stop();
      setSpeakingItemId(item.id);
      const textToSpeak = `${item.title}. ${item.notes ? `Your notes: ${item.notes}. ` : ''}${
        item.content ? item.content.slice(0, 1200) : ''
      }`;
      speechService.speakSingle(textToSpeak, item.id);
    }
  };

  const formatListAsMarkdown = () => {
    if (!activeList) return '';
    let md = `# ${activeList.name}\n\n`;
    if (activeList.description) {
      md += `*${activeList.description}*\n\n`;
    }
    md += `---\n\n`;
    for (const it of items) {
      md += `## ${it.title}\n`;
      if (it.subtitle) md += `* **Source:** ${it.subtitle}\n`;
      if (it.url) md += `* **Link:** ${it.url}\n`;
      if (it.notes) md += `\n> **My Notes:** ${it.notes}\n`;
      if (it.content) md += `\n${it.content}\n`;
      md += `\n---\n\n`;
    }
    return md;
  };

  const handleCopyList = () => {
    const md = formatListAsMarkdown();
    navigator.clipboard.writeText(md);
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 2500);
  };

  const handleDownloadList = () => {
    if (!activeList) return;
    const md = formatListAsMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeList.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredItems = items.filter((it) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      it.title.toLowerCase().includes(q) ||
      it.subtitle.toLowerCase().includes(q) ||
      it.notes.toLowerCase().includes(q) ||
      it.content.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full space-y-3">
      {/* Header & Cloud Sync Bar */}
      <div className={`pb-2 border-b ${themeConfig.borderLight} space-y-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className={`text-sm sm:text-base font-bold tracking-tight ${themeConfig.textPrimary}`}>
              My Saved Lists
            </h2>
            <span className={`hidden md:inline text-[11px] ${themeConfig.textMuted}`}>
              · Synced with Firebase
            </span>
          </div>

          {/* Firebase Account & Cloud Sync Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {user ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400">
                  <Cloud className="w-3 h-3" />
                  <span>Synced ({user.displayName || user.email})</span>
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer transition-colors`}
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold ${themeConfig.primaryButton} cursor-pointer transition-colors`}
              >
                <LogIn className="w-3 h-3" />
                <span>Sign in with Google to Sync Lists</span>
              </button>
            )}
          </div>
        </div>

        {authError && (
          <div className="text-xs text-rose-400 py-1">{authError}</div>
        )}

        {statusBanner && (
          <div className="text-xs text-emerald-400 font-medium py-1 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* List Selector Tabs + New List Button */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
          <div className="flex items-center gap-1 flex-wrap">
            {lists.map((list) => {
              const isSelected = list.id === activeList?.id;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                      : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
                  }`}
                >
                  <Bookmark className="w-3 h-3 opacity-75" />
                  <span>{list.name}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsCreatingList(!isCreatingList)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-1 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/20`}
            >
              <FolderPlus className="w-3 h-3 text-indigo-400" />
              <span>+ New List</span>
            </button>
          </div>

          {/* Quick Save Current Video to Active List */}
          {activeList && currentVideoMetadata && (
            <button
              type="button"
              onClick={handleSaveCurrentVideoToList}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold ${themeConfig.primaryButton} cursor-pointer transition-colors`}
            >
              {savedCurrentVideo ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              <span>
                {savedCurrentVideo
                  ? `Saved to "${activeList.name}"`
                  : `Save Video to "${activeList.name}"`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Create New List Form */}
      {isCreatingList && (
        <form
          onSubmit={handleCreateList}
          className={`p-5 rounded-xl border ${themeConfig.borderLight} bg-slate-500/5 space-y-4 max-w-2xl`}
        >
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold ${themeConfig.textPrimary}`}>Create a New List</h3>
            <button
              type="button"
              onClick={() => setIsCreatingList(false)}
              className={`p-1 ${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>List Name</label>
              <input
                type="text"
                required
                maxLength={100}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Best AI Lectures, Startup Advice, Exam Study Notes..."
                className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
              />
            </div>

            <div className="space-y-1">
              <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>Category</label>
              <select
                value={newListCategory}
                onChange={(e) => setNewListCategory(e.target.value as ListCategory)}
                className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} cursor-pointer focus:outline-none`}
              >
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k} className="bg-slate-900 text-white">
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>
              Short Description (optional)
            </label>
            <input
              type="text"
              maxLength={500}
              value={newListDesc}
              onChange={(e) => setNewListDesc(e.target.value)}
              placeholder="What are you saving in this list?"
              className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreatingList(false)}
              className={`px-3 py-1.5 rounded-md text-xs ${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newListName.trim() || isSubmittingList}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer disabled:opacity-40`}
            >
              {isSubmittingList ? 'Saving...' : 'Create List'}
            </button>
          </div>
        </form>
      )}

      {/* Active List Details & Controls */}
      {activeList && (
        <div className="space-y-6">
          <div className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${themeConfig.borderLight}`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h3 className={`text-base sm:text-lg font-bold ${themeConfig.textPrimary}`}>
                  {activeList.name}
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium">
                  {CATEGORY_LABELS[activeList.category] || 'General'}
                </span>
                <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                  ({items.length} {items.length === 1 ? 'item' : 'items'})
                </span>
              </div>
              {activeList.description && (
                <p className={`text-xs ${themeConfig.textMuted}`}>{activeList.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter saved items..."
                  className={`pl-8 pr-3 py-1.5 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddingCustomItem(!isAddingCustomItem)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/20 cursor-pointer transition-colors`}
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                <span>Add Custom Note or Link</span>
              </button>

              <button
                type="button"
                onClick={handleCopyList}
                disabled={items.length === 0}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer disabled:opacity-40`}
              >
                {copiedList ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedList ? 'Copied' : 'Copy List'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadList}
                disabled={items.length === 0}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer disabled:opacity-40`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export (.md)</span>
              </button>

              {lists.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteList(activeList)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                  title="Delete this list"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete List</span>
                </button>
              )}
            </div>
          </div>

          {/* Add Custom Item Form */}
          {isAddingCustomItem && (
            <form
              onSubmit={handleAddCustomItem}
              className={`p-5 rounded-xl border ${themeConfig.borderLight} bg-slate-500/5 space-y-4 max-w-3xl`}
            >
              <div className="flex items-center justify-between">
                <h4 className={`text-sm font-bold ${themeConfig.textPrimary}`}>
                  Add a Custom Item to &ldquo;{activeList.name}&rdquo;
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomItem(false)}
                  className={`p-1 ${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>Type</label>
                  <select
                    value={customItemType}
                    onChange={(e) => setCustomItemType(e.target.value as ListItemType)}
                    className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} cursor-pointer focus:outline-none`}
                  >
                    {Object.entries(ITEM_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k} className="bg-slate-900 text-white">
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>Title</label>
                  <input
                    type="text"
                    required
                    maxLength={300}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Title of the note, video, book, or article..."
                    className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>
                    Link / YouTube URL (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={1000}
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>
                    Author / Channel / Source (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    value={customSubtitle}
                    onChange={(e) => setCustomSubtitle(e.target.value)}
                    placeholder="e.g., Stanford University, 3Blue1Brown..."
                    className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>
                  Your Personal Notes or Summary
                </label>
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Write what you want to remember about this..."
                  className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCustomItem(false)}
                  className={`px-3 py-1.5 rounded-md text-xs ${themeConfig.textMuted} hover:${themeConfig.textPrimary} cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customTitle.trim()}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer disabled:opacity-40`}
                >
                  Save to List
                </button>
              </div>
            </form>
          )}

          {/* Items Feed */}
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Bookmark className={`w-7 h-7 mx-auto opacity-40 ${themeConfig.textMuted}`} />
              <div className="space-y-1">
                <p className={`text-sm font-medium ${themeConfig.textPrimary}`}>
                  No saved items in &ldquo;{activeList.name}&rdquo; yet
                </p>
                <p className={`text-xs ${themeConfig.textMuted}`}>
                  Click &ldquo;Save Current Video &amp; Summary&rdquo; above, or save any lesson, word, book, or video while exploring.
                </p>
              </div>
            </div>
          ) : (
            <div className={`divide-y ${themeConfig.borderLight}`}>
              {filteredItems.map((item) => {
                const isExpanded = expandedItemId === item.id;
                const isEditing = editingItemId === item.id;
                const isYouTubeItem =
                  /youtube\.com|youtu\.be/i.test(item.url) || item.itemType === 'summary' || item.itemType === 'video';

                return (
                  <div key={item.id} className="py-5 first:pt-2 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1 max-w-4xl">
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="text-indigo-400 font-semibold">
                            {ITEM_TYPE_LABELS[item.itemType] || 'Saved Item'}
                          </span>
                          {item.subtitle && (
                            <>
                              <span aria-hidden="true" className={themeConfig.textMuted}>·</span>
                              <span className={themeConfig.textMuted}>{item.subtitle}</span>
                            </>
                          )}
                          <span aria-hidden="true" className={themeConfig.textMuted}>·</span>
                          <span className={`text-[11px] ${themeConfig.textMuted} tabular-nums`}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 className={`text-base font-bold ${themeConfig.textPrimary}`}>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline inline-flex items-center gap-1.5"
                            >
                              <span>{item.title}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                            </a>
                          ) : (
                            item.title
                          )}
                        </h4>
                      </div>

                      {/* Item Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {isYouTubeItem && item.url && (
                          <button
                            type="button"
                            onClick={() =>
                              onLoadSavedVideo(
                                item.url,
                                item.itemType === 'summary' ? item.content : undefined,
                                item.title
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer transition-colors`}
                          >
                            <Play className="w-3 h-3" />
                            <span>{item.itemType === 'summary' ? 'Load Video & Summary' : 'Load Video'}</span>
                          </button>
                        )}

                        {onAppendToSummary && item.itemType !== 'summary' && (
                          <button
                            type="button"
                            onClick={() =>
                              onAppendToSummary(
                                `\n\n### ${item.title}${item.subtitle ? ` — *${item.subtitle}*` : ''}\n${
                                  item.content ? `${item.content}\n` : ''
                                }${item.notes ? `> *Note:* ${item.notes}\n` : ''}`
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer`}
                          >
                            <Plus className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Add to Summary</span>
                          </button>
                        )}

                        {item.content && (
                          <button
                            type="button"
                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{isExpanded ? 'Hide Summary' : 'Read Saved Summary'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleReadItemAloud(item)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                            speakingItemId === item.id
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{speakingItemId === item.id ? 'Stop' : 'Listen'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(isEditing ? null : item.id);
                            setEditingNotesText(item.notes || '');
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{item.notes ? 'Edit Note' : 'Add Note'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item)}
                          className="p-1.5 rounded-md text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          title="Remove from list"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Personal Notes Display or Editor */}
                    {isEditing ? (
                      <div className="space-y-2 max-w-2xl pt-1">
                        <textarea
                          rows={3}
                          maxLength={5000}
                          value={editingNotesText}
                          onChange={(e) => setEditingNotesText(e.target.value)}
                          placeholder="Add your personal thoughts, timestamps, or study reminders..."
                          className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveEditedNotes(item)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer`}
                          >
                            Save Note
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className={`px-3 py-1 rounded-md text-xs ${themeConfig.textMuted} cursor-pointer`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      item.notes && (
                        <blockquote className="border-l-2 border-indigo-500/60 pl-3.5 py-0.5 text-xs sm:text-sm italic opacity-90">
                          {item.notes}
                        </blockquote>
                      )
                    )}

                    {/* Expanded Saved Markdown Summary */}
                    {isExpanded && item.content && (
                      <div className={`mt-3 pt-4 border-t ${themeConfig.borderLight} prose ${themeConfig.proseClass} max-w-none text-sm`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
