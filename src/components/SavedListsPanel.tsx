import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bookmark,
  FolderOpen,
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
  Search,
  X,
  Sparkles,
  Cpu,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { signInWithGoogle, signOutUser } from '../firebase';
import {
  SavedUserList,
  SavedListItem,
  SavedCloudSummary,
  ListCategory,
  ListItemType,
  subscribeToUserLists,
  subscribeToListItems,
  createUserList,
  deleteUserList,
  addItemToUserList,
  updateListItemNotes,
  deleteItemFromUserList,
  deleteCustomExactResource,
  loadLocalLists,
  loadLocalListItems,
  getDefaultCloudListId,
} from '../services/listsService';
import { extractExactVideoResources } from '../services/exactResourceExtractor';
import { APP_THEMES } from '../constants';
import { ThemeId, VideoMetadata, TranscriptSegment, ExactVideoResource } from '../types';
import { speechService } from '../services/speechService';

// URL Safety check (BUG-040)
function isSafeHttpUrl(url?: string): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim());
}

interface SavedListsPanelProps {
  currentTheme: ThemeId;
  currentVideoMetadata: VideoMetadata | null;
  currentVideoUrl: string;
  currentSummaryMarkdown: string;
  currentTranscriptSegments?: TranscriptSegment[];
  savedSummaries?: SavedCloudSummary[];
  customResources?: ExactVideoResource[];
  onRefreshCustomResources?: (resources: ExactVideoResource[]) => void;
  onLoadSavedVideo: (url: string, savedMarkdown?: string, savedTitle?: string) => void;
  onAppendToSummary?: (markdownText: string, noticeLabel?: string) => void;
  onOpenTechWords?: () => void;
  user: User | null;
}

const CATEGORY_LABELS: Record<ListCategory, string> = {
  favorites: 'Favorites & Summaries',
  reading: 'Sources, Books & Papers',
  videos: 'Videos & Media',
  study: 'Study Notes & Quotes',
  general: 'General Artifacts',
};

const ITEM_TYPE_LABELS: Record<ListItemType, string> = {
  summary: 'Video Summary',
  video: 'YouTube Video',
  book: 'Book / Publication',
  article: 'Exact Source / Paper',
  note: 'Personal Note / Artifact',
};

export const SavedListsPanel: React.FC<SavedListsPanelProps> = ({
  currentTheme,
  currentVideoMetadata,
  currentVideoUrl,
  currentSummaryMarkdown,
  currentTranscriptSegments = [],
  savedSummaries = [],
  customResources = [],
  onRefreshCustomResources,
  onLoadSavedVideo,
  onAppendToSummary,
  onOpenTechWords,
  user,
}) => {
  const themeConfig = APP_THEMES[currentTheme] || APP_THEMES.midnight;

  const [lists, setLists] = useState<SavedUserList[]>([]);
  // 'all_artifacts' shows everything (list items + cloud summaries + custom exact resources) in one unified folder view
  const [selectedFolderView, setSelectedFolderView] = useState<string>('all_artifacts');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [items, setItems] = useState<SavedListItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | ListItemType>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Create new folder form state
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListCategory, setNewListCategory] = useState<ListCategory>('reading');
  const [isSubmittingList, setIsSubmittingList] = useState(false);

  // Add custom artifact form state
  const [isAddingCustomItem, setIsAddingCustomItem] = useState(false);
  const [customItemType, setCustomItemType] = useState<ListItemType>('article');
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
  const [savedAllSources, setSavedAllSources] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [speakingItemId, setSpeakingItemId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const currentVideoExactResources = useMemo(() => {
    return extractExactVideoResources(
      currentVideoMetadata,
      currentTranscriptSegments,
      currentSummaryMarkdown
    );
  }, [currentVideoMetadata, currentTranscriptSegments, currentSummaryMarkdown]);

  // Load folders from Firestore when signed in, or from localStorage when signed out
  useEffect(() => {
    if (user) {
      const unsub = subscribeToUserLists(user.uid, async (remoteLists) => {
        if (remoteLists.length === 0) {
          try {
            const created = await createUserList(
              'My Saved Artifacts',
              'Saved sources, video summaries, books, papers, and personal study notes.',
              'favorites',
              getDefaultCloudListId(user.uid)
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

  // Load items for the currently selected folder
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
      if (selectedFolderView === 'all_artifacts') {
        setItems(allLocal);
      } else {
        setItems(allLocal.filter((i) => i.listId === selectedListId));
      }
    }
  }, [selectedListId, selectedFolderView, user, lists]);

  const activeList = lists.find((l) => l.id === selectedListId) || lists[0] || null;

  // Combine list items + cloud summaries + custom exact resources when viewing "all_artifacts"
  const unifiedArtifacts = useMemo<SavedListItem[]>(() => {
    if (selectedFolderView !== 'all_artifacts') {
      return items;
    }

    const combined: SavedListItem[] = [...items];
    const seenTitles = new Set(combined.map((i) => i.title.toLowerCase().trim()));

    for (const res of customResources) {
      const key = res.title.toLowerCase().trim();
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        combined.push({
          id: res.id,
          listId: activeList?.id || 'list_default_favorites',
          ownerId: user?.uid || 'local_user',
          itemType: res.type === 'Book / Publication' ? 'book' : 'article',
          title: res.title,
          url: res.primaryUrl,
          subtitle: `${res.type}${res.authorOrCreator ? ` · ${res.authorOrCreator}` : ''}${
            res.formattedTime ? ` · [${res.formattedTime}]` : ''
          }`,
          content: res.description,
          notes: res.exactQuote || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    for (const sum of savedSummaries) {
      const key = sum.videoTitle.toLowerCase().trim();
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        combined.push({
          id: sum.id,
          listId: activeList?.id || 'list_default_favorites',
          ownerId: sum.ownerId,
          itemType: 'summary',
          title: sum.videoTitle,
          url: sum.videoUrl,
          subtitle: sum.authorName || 'YouTube Video Summary',
          content: sum.markdown,
          notes: '',
          createdAt: sum.createdAt,
          updatedAt: sum.updatedAt,
        });
      }
    }

    return combined;
  }, [selectedFolderView, items, customResources, savedSummaries, activeList?.id, user?.uid]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
      showNotice('Signed in with Google! Your Artifacts Folder is synced with Firebase.');
    } catch (err: any) {
      setAuthError(err?.message || 'Could not sign in with Google.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      showNotice('Signed out. Showing your local Artifacts Folder.');
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
      setSelectedFolderView(created.id);
      setNewListName('');
      setNewListDesc('');
      setIsCreatingList(false);
      showNotice(`Created folder "${created.name}"`);
    } catch {
      showNotice('Could not create folder. Please try again.');
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
      setSelectedFolderView('all_artifacts');
      showNotice(`Removed folder "${listToDelete.name}"`);
    } catch {
      showNotice('Could not delete folder.');
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
        setItems(loadLocalListItems());
      }
      setSavedCurrentVideo(true);
      setTimeout(() => setSavedCurrentVideo(false), 3000);
      showNotice(`Saved video & summary "${currentVideoMetadata.title}" to Artifacts Folder`);
    } catch {
      showNotice('Could not save video to Artifacts Folder.');
    }
  };

  const handleSaveAllVideoSourcesToArtifacts = async () => {
    if (!activeList || currentVideoExactResources.length === 0) return;
    try {
      const existingTitles = new Set(unifiedArtifacts.map((a) => a.title.toLowerCase().trim()));
      let addedCount = 0;
      for (const r of currentVideoExactResources) {
        if (!existingTitles.has(r.title.toLowerCase().trim())) {
          await addItemToUserList(activeList.id, {
            itemType: r.type === 'Book / Publication' ? 'book' : 'article',
            title: r.title,
            url: r.primaryUrl,
            subtitle: `${r.type}${r.authorOrCreator ? ` · ${r.authorOrCreator}` : ''}${
              r.formattedTime ? ` · [${r.formattedTime}]` : ''
            }`,
            content: r.description,
            notes: r.exactQuote || '',
          });
          addedCount++;
        }
      }
      if (!user) {
        setItems(loadLocalListItems());
      }
      setSavedAllSources(true);
      setTimeout(() => setSavedAllSources(false), 3000);
      showNotice(
        addedCount > 0
          ? `Saved ${addedCount} exact video resources into your Artifacts Folder!`
          : 'All exact video resources are already saved in your Artifacts Folder.'
      );
    } catch {
      showNotice('Could not save video sources to Artifacts Folder.');
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
        setItems(loadLocalListItems());
      }
      setCustomTitle('');
      setCustomUrl('');
      setCustomSubtitle('');
      setCustomContent('');
      setCustomNotes('');
      setIsAddingCustomItem(false);
      showNotice(`Saved "${customTitle}" to Artifacts Folder`);
    } catch {
      showNotice('Could not add artifact to folder.');
    }
  };

  const handleSaveEditedNotes = async (item: SavedListItem) => {
    const targetListId = item.listId || activeList?.id || 'list_default_favorites';
    try {
      await updateListItemNotes(targetListId, item.id, editingNotesText);
      if (!user) {
        setItems(loadLocalListItems());
      }
      setEditingItemId(null);
      showNotice('Saved your notes on this artifact.');
    } catch {
      showNotice('Could not update notes.');
    }
  };

  const handleRemoveItem = async (item: SavedListItem) => {
    const targetListId = item.listId || activeList?.id || 'list_default_favorites';
    try {
      if (item.id.startsWith('res_') || item.id.startsWith('custom-res-')) {
        await deleteCustomExactResource(item.id);
        onRefreshCustomResources?.(customResources.filter((r) => r.id !== item.id));
      } else {
        await deleteItemFromUserList(targetListId, item.id);
      }
      if (!user) {
        setItems(loadLocalListItems());
      }
      showNotice(`Removed "${item.title}" from Artifacts Folder.`);
    } catch {
      showNotice('Could not remove artifact.');
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

  const filteredItems = unifiedArtifacts.filter((it) => {
    if (typeFilter !== 'all' && it.itemType !== typeFilter) return false;
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      it.title.toLowerCase().includes(q) ||
      it.subtitle.toLowerCase().includes(q) ||
      it.notes.toLowerCase().includes(q) ||
      it.content.toLowerCase().includes(q)
    );
  });

  const formatListAsMarkdown = () => {
    const folderTitle =
      selectedFolderView === 'all_artifacts'
        ? 'All Saved Artifacts, Sources & Summaries'
        : activeList?.name || 'Artifacts Folder';
    let md = `# ${folderTitle}\n\n`;
    if (activeList?.description && selectedFolderView !== 'all_artifacts') {
      md += `*${activeList.description}*\n\n`;
    }
    md += `---\n\n`;
    for (const it of filteredItems) {
      md += `## ${it.title}\n`;
      md += `* **Type:** ${ITEM_TYPE_LABELS[it.itemType] || 'Artifact'}\n`;
      if (it.subtitle) md += `* **Source:** ${it.subtitle}\n`;
      if (it.url) md += `* **Link:** ${it.url}\n`;
      if (it.notes) md += `\n> **Notes / Quote:** ${it.notes}\n`;
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
    const md = formatListAsMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artifacts-folder-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-4">
      {/* Header & Firebase Cloud Sync Bar */}
      <div className={`pb-3 border-b ${themeConfig.borderLight} space-y-2.5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <h2 className={`text-sm sm:text-base font-bold tracking-tight ${themeConfig.textPrimary}`}>
                Artifacts Folder
              </h2>
              <span className={`text-xs ${themeConfig.textMuted} tabular-nums`}>
                · {unifiedArtifacts.length} saved {unifiedArtifacts.length === 1 ? 'artifact' : 'artifacts'}
              </span>
            </div>
            <p className={`text-xs ${themeConfig.textMuted}`}>
              Save and organize exact video sources, research papers, books, summaries, links, and study notes in one place.
            </p>
          </div>

          {/* Firebase Account & Cloud Sync Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {user ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400">
                  <Cloud className="w-3 h-3" />
                  <span>Synced to Firebase ({user.displayName || user.email})</span>
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
                <span>Sign in with Google to Sync Artifacts to Firebase</span>
              </button>
            )}
          </div>
        </div>

        {authError && <div className="text-xs text-rose-400 py-1">{authError}</div>}

        {statusBanner && (
          <div className="text-xs text-emerald-400 font-medium py-1 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* Quick 1-Click Save Bar for Current Video & Exact Sources */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* All Artifacts Unified Tab */}
            <button
              type="button"
              onClick={() => setSelectedFolderView('all_artifacts')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedFolderView === 'all_artifacts'
                  ? 'bg-amber-500/15 text-amber-400 font-semibold'
                  : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>All Artifacts ({unifiedArtifacts.length})</span>
            </button>

            {/* User Sub-Folders */}
            {lists.map((list) => {
              const isSelected = selectedFolderView === list.id;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => {
                    setSelectedListId(list.id);
                    setSelectedFolderView(list.id);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
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
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/20`}
            >
              <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>+ New Sub-Folder</span>
            </button>
          </div>

          {/* 1-Click Save Actions for Current Video, Exact Sources, Custom Artifact & Tech Words Searcher */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {onOpenTechWords && (
              <button
                type="button"
                onClick={onOpenTechWords}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 cursor-pointer transition-colors"
                title="Open Tech, AI & CSE Words Searcher + Multi-Dictionary"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Tech, AI &amp; CSE Words Searcher</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAddingCustomItem(!isAddingCustomItem)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingCustomItem ? 'Close Form' : '+ Add Source / Note / Link'}</span>
            </button>

            {currentVideoExactResources.length > 0 && (
              <button
                type="button"
                onClick={handleSaveAllVideoSourcesToArtifacts}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 cursor-pointer transition-colors"
              >
                {savedAllSources ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>
                  {savedAllSources
                    ? 'Saved Video Sources!'
                    : `+ Save ${currentVideoExactResources.length} Video Sources`}
                </span>
              </button>
            )}

            {activeList && currentVideoMetadata && (
              <button
                type="button"
                onClick={handleSaveCurrentVideoToList}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer transition-colors`}
              >
                {savedCurrentVideo ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>
                  {savedCurrentVideo ? 'Saved Current Summary!' : '+ Save Current Video Summary'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create New Sub-Folder Form */}
      {isCreatingList && (
        <form
          onSubmit={handleCreateList}
          className={`p-4 rounded-xl border ${themeConfig.borderLight} bg-slate-500/5 space-y-3 max-w-2xl`}
        >
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold ${themeConfig.textPrimary}`}>Create a New Artifact Folder</h3>
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
              <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>Folder Name</label>
              <input
                type="text"
                required
                maxLength={100}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Primary Sources, AI Papers, Books to Read, Project Artifacts..."
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
              placeholder="What sources or notes are stored in this folder?"
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
              {isSubmittingList ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      )}

      {/* Add Custom Artifact / Source / Note Form */}
      {isAddingCustomItem && (
        <form
          onSubmit={handleAddCustomItem}
          className={`p-4 rounded-xl border ${themeConfig.borderLight} bg-slate-500/5 space-y-3 max-w-3xl`}
        >
          <div className="flex items-center justify-between">
            <h4 className={`text-sm font-bold ${themeConfig.textPrimary}`}>
              Save a New Artifact, Source, Link, or Note to Folder
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
              <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>Artifact Type</label>
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
              <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>Title *</label>
              <input
                type="text"
                required
                maxLength={300}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Title of the source, paper, book, dataset, video, or note..."
                className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>
                Source Link / URL (optional)
              </label>
              <input
                type="text"
                maxLength={1000}
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://..."
                className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
              />
            </div>

            <div className="space-y-1">
              <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>
                Author / Channel / Publication (optional)
              </label>
              <input
                type="text"
                maxLength={300}
                value={customSubtitle}
                onChange={(e) => setCustomSubtitle(e.target.value)}
                placeholder="e.g., Stewart Brand, arXiv, Stanford..."
                className={`w-full px-3 py-2 rounded-md text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className={`text-xs font-medium ${themeConfig.textSecondary}`}>
              Description, Excerpt, or Personal Notes
            </label>
            <textarea
              rows={3}
              maxLength={5000}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Paste key quotes, timestamps, takeaways, or why you saved this artifact..."
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
              Save to Artifacts Folder
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar & Folder Export Controls */}
      <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b ${themeConfig.borderLight}`}>
        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              { id: 'all', label: `All (${unifiedArtifacts.length})` },
              { id: 'article', label: 'Sources & Papers' },
              { id: 'book', label: 'Books' },
              { id: 'summary', label: 'Video Summaries' },
              { id: 'video', label: 'Videos' },
              { id: 'note', label: 'Notes & Quotes' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                typeFilter === tab.id
                  ? `${themeConfig.accentBg} ${themeConfig.accent} font-semibold`
                  : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search artifacts, sources, notes..."
              className={`pl-8 pr-3 py-1 rounded text-xs bg-slate-500/10 ${themeConfig.textPrimary} focus:outline-none`}
            />
          </div>

          <button
            type="button"
            onClick={handleCopyList}
            disabled={filteredItems.length === 0}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer disabled:opacity-40`}
          >
            {copiedList ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedList ? 'Copied' : 'Copy All'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadList}
            disabled={filteredItems.length === 0}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} hover:bg-slate-500/10 cursor-pointer disabled:opacity-40`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export (.md)</span>
          </button>

          {selectedFolderView !== 'all_artifacts' && activeList && lists.length > 1 && (
            <button
              type="button"
              onClick={() => handleDeleteList(activeList)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
              title="Delete this folder"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Folder</span>
            </button>
          )}
        </div>
      </div>

      {/* Saved Artifacts Feed */}
      {filteredItems.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <FolderOpen className={`w-8 h-8 mx-auto opacity-40 text-amber-400`} />
          <div className="space-y-1 max-w-md mx-auto">
            <p className={`text-sm font-semibold ${themeConfig.textPrimary}`}>
              Your Artifacts Folder is ready
            </p>
            <p className={`text-xs ${themeConfig.textMuted}`}>
              Click &ldquo;+ Save Video Sources&rdquo; or &ldquo;+ Save Current Video Summary&rdquo; above, or click &ldquo;+ Save to Artifacts&rdquo; on any source, book, paper, or quote across the app.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            {currentVideoExactResources.length > 0 && (
              <button
                type="button"
                onClick={handleSaveAllVideoSourcesToArtifacts}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ Save All {currentVideoExactResources.length} Exact Video Sources Now</span>
              </button>
            )}
            {currentVideoMetadata && (
              <button
                type="button"
                onClick={handleSaveCurrentVideoToList}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer transition-colors`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Save Current Video Summary</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={`divide-y ${themeConfig.borderLight}`}>
          {filteredItems.map((item) => {
            const isExpanded = expandedItemId === item.id;
            const isEditing = editingItemId === item.id;
            const isYouTubeItem =
              /youtube\.com|youtu\.be/i.test(item.url) ||
              item.itemType === 'summary' ||
              item.itemType === 'video';

            return (
              <div key={item.id} className="py-4 first:pt-1 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 max-w-4xl">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="text-amber-400 font-semibold">
                        {ITEM_TYPE_LABELS[item.itemType] || 'Saved Artifact'}
                      </span>
                      {item.subtitle && (
                        <>
                          <span aria-hidden="true" className={themeConfig.textMuted}>·</span>
                          <span className={themeConfig.textSecondary}>{item.subtitle}</span>
                        </>
                      )}
                      <span aria-hidden="true" className={themeConfig.textMuted}>·</span>
                      <span className={`text-[11px] ${themeConfig.textMuted} tabular-nums`}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className={`text-sm sm:text-base font-bold ${themeConfig.textPrimary}`}>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{item.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                        </a>
                      ) : (
                        item.title
                      )}
                    </h4>
                  </div>

                  {/* Artifact Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {item.url && !isYouTubeItem && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                      >
                        <span>Open Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

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
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${themeConfig.primaryButton} cursor-pointer transition-colors`}
                      >
                        <Play className="w-3 h-3" />
                        <span>{item.itemType === 'summary' ? 'Open Video & Summary' : 'Load Video'}</span>
                      </button>
                    )}

                    {onAppendToSummary && item.itemType !== 'summary' && (
                      <button
                        type="button"
                        onClick={() => {
                          onAppendToSummary(
                            `\n\n### ${item.url ? `[${item.title}](${item.url})` : item.title}${
                              item.subtitle ? ` — *${item.subtitle}*` : ''
                            }\n${item.content ? `${item.content}\n` : ''}${
                              item.notes ? `> *Note:* ${item.notes}\n` : ''
                            }`,
                            `Inserted "${item.title}" from Artifacts into Summary`
                          );
                          showNotice(`Inserted "${item.title}" into Video Summary`);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 hover:bg-slate-500/20 cursor-pointer`}
                      >
                        <Plus className="w-3 h-3 text-indigo-400" />
                        <span>+ Insert in Summary</span>
                      </button>
                    )}

                    {item.content && item.itemType === 'summary' && (
                      <button
                        type="button"
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer`}
                      >
                        <FileText className="w-3 h-3" />
                        <span>{isExpanded ? 'Hide Summary' : 'Read Summary'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleReadItemAloud(item)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                        speakingItemId === item.id
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : `${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10`
                      }`}
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>{speakingItemId === item.id ? 'Stop' : 'Listen'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemId(isEditing ? null : item.id);
                        setEditingNotesText(item.notes || '');
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${themeConfig.textSecondary} hover:${themeConfig.textPrimary} bg-slate-500/10 cursor-pointer`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{item.notes ? 'Edit Note' : 'Add Note'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item)}
                      className="p-1 rounded text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      title="Remove from Artifacts Folder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Artifact Content / Excerpt (for non-summary items, show directly!) */}
                {item.content && item.itemType !== 'summary' && (
                  <p className={`text-xs ${themeConfig.textSecondary} leading-relaxed max-w-4xl`}>
                    {item.content}
                  </p>
                )}

                {/* Personal Notes Display or Editor */}
                {isEditing ? (
                  <div className="space-y-2 max-w-2xl pt-1">
                    <textarea
                      rows={3}
                      maxLength={5000}
                      value={editingNotesText}
                      onChange={(e) => setEditingNotesText(e.target.value)}
                      placeholder="Add your personal thoughts, timestamps, or study notes..."
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
                    <blockquote className="border-l-2 border-amber-500/60 pl-3 py-0.5 text-xs italic opacity-90 max-w-3xl">
                      {item.notes}
                    </blockquote>
                  )
                )}

                {/* Expanded Saved Markdown Summary */}
                {isExpanded && item.content && (
                  <div className={`mt-2 pt-3 border-t ${themeConfig.borderLight} prose ${themeConfig.proseClass} max-w-none text-sm`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
