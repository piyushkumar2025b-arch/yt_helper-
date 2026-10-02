import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getDocs,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, logFirestoreError, OperationType } from '../firebase';
import { ExactVideoResource } from '../types';

export type ListCategory = 'general' | 'videos' | 'reading' | 'study' | 'favorites';
export type ListItemType = 'video' | 'summary' | 'book' | 'article' | 'note';
export type ActivityActionType =
  | 'video'
  | 'summary'
  | 'word_lookup'
  | 'research_search'
  | 'transcript_search'
  | 'ai_question'
  | 'artifact_saved'
  | 'audio_narration';

export interface ActivityHistoryItem {
  id: string;
  ownerId: string;
  actionType: ActivityActionType;
  queryOrTitle: string;
  detail: string;
  url: string;
  videoId: string;
  dateKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedUserList {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  category: ListCategory;
  createdAt: string;
  updatedAt: string;
}

export interface SavedListItem {
  id: string;
  listId: string;
  ownerId: string;
  itemType: ListItemType;
  title: string;
  url: string;
  subtitle: string;
  content: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedCloudSummary {
  id: string;
  ownerId: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  authorName: string;
  summaryType: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
}

// Validation & Truncation Constants synced strictly with firebase-blueprint.json
const MAX_ID_LEN = 128;
const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const MAX_LIST_NAME_LEN = 100;
const MAX_LIST_DESC_LEN = 500;
const MAX_ITEM_TITLE_LEN = 300;
const MAX_ITEM_URL_LEN = 1000;
const MAX_ITEM_SUBTITLE_LEN = 300;
const MAX_ITEM_CONTENT_LEN = 50000;
const MAX_ITEM_NOTES_LEN = 5000;
const MAX_VIDEO_ID_LEN = 64;
const MAX_AUTHOR_LEN = 200;
const MAX_SUMMARY_TYPE_LEN = 64;
const MAX_RESOURCE_TYPE_LEN = 64;
const MAX_RESOURCE_DESC_LEN = 2000;
const MAX_RESOURCE_QUOTE_LEN = 2000;
const MAX_FORMATTED_TIME_LEN = 32;

const ALLOWED_CATEGORIES: ListCategory[] = ['general', 'videos', 'reading', 'study', 'favorites'];
const ALLOWED_ITEM_TYPES: ListItemType[] = ['video', 'summary', 'book', 'article', 'note'];
const ALLOWED_ACTIVITY_TYPES: ActivityActionType[] = [
  'video',
  'summary',
  'word_lookup',
  'research_search',
  'transcript_search',
  'ai_question',
  'artifact_saved',
  'audio_narration',
];

export function formatDateKey(dateInput?: Date | string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateKeyReadable(dateKey: string): string {
  const todayKey = formatDateKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  const parts = dateKey.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const formatted = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (dateKey === todayKey) return `Today — ${formatted}`;
    if (dateKey === yesterdayKey) return `Yesterday — ${formatted}`;
    return formatted;
  }
  return dateKey;
}

function generateSafeId(prefix: string): string {
  const raw = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, MAX_ID_LEN);
  return ID_REGEX.test(cleaned) ? cleaned : `id_${Date.now()}`;
}

function computeStableHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(36) + (h1 >>> 0).toString(36)).slice(0, 16);
}

export function isContentTruncatedForStorage(content?: string): boolean {
  return Boolean(content && content.length > MAX_ITEM_CONTENT_LEN);
}

export function getDefaultCloudListId(userId: string): string {
  const cleanUid = userId.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64) || 'user';
  return `list_fav_${cleanUid}`;
}

function sanitizeListPayload(
  ownerId: string,
  name: string,
  description: string,
  category: ListCategory
) {
  const safeName = (name || 'Untitled List').trim().slice(0, MAX_LIST_NAME_LEN) || 'Untitled List';
  const safeDesc = (description || '').trim().slice(0, MAX_LIST_DESC_LEN);
  const safeCategory: ListCategory = ALLOWED_CATEGORIES.includes(category) ? category : 'general';
  return {
    ownerId: ownerId.slice(0, MAX_ID_LEN),
    name: safeName,
    description: safeDesc,
    category: safeCategory,
  };
}

function sanitizeListItemPayload(
  listId: string,
  ownerId: string,
  input: {
    itemType: ListItemType;
    title: string;
    url?: string;
    subtitle?: string;
    content?: string;
    notes?: string;
  }
) {
  const safeType: ListItemType = ALLOWED_ITEM_TYPES.includes(input.itemType) ? input.itemType : 'note';
  const safeTitle = (input.title || 'Saved Item').trim().slice(0, MAX_ITEM_TITLE_LEN) || 'Saved Item';
  const safeUrl = (input.url || '').trim().slice(0, MAX_ITEM_URL_LEN);
  const safeSubtitle = (input.subtitle || '').trim().slice(0, MAX_ITEM_SUBTITLE_LEN);
  const safeContent = (input.content || '').slice(0, MAX_ITEM_CONTENT_LEN);
  const safeNotes = (input.notes || '').slice(0, MAX_ITEM_NOTES_LEN);
  return {
    listId: listId.slice(0, MAX_ID_LEN),
    ownerId: ownerId.slice(0, MAX_ID_LEN),
    itemType: safeType,
    title: safeTitle,
    url: safeUrl,
    subtitle: safeSubtitle,
    content: safeContent,
    notes: safeNotes,
  };
}

function sanitizeSavedSummaryPayload(
  ownerId: string,
  input: {
    videoId?: string;
    videoUrl?: string;
    videoTitle: string;
    authorName?: string;
    summaryType?: string;
    markdown: string;
  }
) {
  return {
    ownerId: ownerId.slice(0, MAX_ID_LEN),
    videoId: (input.videoId || '').trim().slice(0, MAX_VIDEO_ID_LEN),
    videoUrl: (input.videoUrl || '').trim().slice(0, MAX_ITEM_URL_LEN),
    videoTitle: (input.videoTitle || 'YouTube Video Summary').trim().slice(0, MAX_ITEM_TITLE_LEN) || 'YouTube Video Summary',
    authorName: (input.authorName || 'YouTube').trim().slice(0, MAX_AUTHOR_LEN),
    summaryType: (input.summaryType || 'massive').trim().slice(0, MAX_SUMMARY_TYPE_LEN) || 'massive',
    markdown: (input.markdown || 'Summary').slice(0, MAX_ITEM_CONTENT_LEN) || 'Summary',
  };
}

function sanitizeCustomResourcePayload(
  ownerId: string,
  input: {
    videoId?: string;
    title: string;
    type?: ExactVideoResource['type'] | string;
    description?: string;
    primaryUrl: string;
    authorOrCreator?: string;
    formattedTime?: string;
    exactQuote?: string;
  }
) {
  const safeTitle = (input.title || 'Exact Resource').trim().slice(0, MAX_ITEM_TITLE_LEN) || 'Exact Resource';
  const safeUrl = (input.primaryUrl || `https://scholar.google.com/scholar?q=${encodeURIComponent(safeTitle)}`)
    .trim()
    .slice(0, MAX_ITEM_URL_LEN);
  return {
    ownerId: ownerId.slice(0, MAX_ID_LEN),
    videoId: (input.videoId || '').trim().slice(0, MAX_VIDEO_ID_LEN),
    title: safeTitle,
    resourceType: (input.type || 'Custom Resource').trim().slice(0, MAX_RESOURCE_TYPE_LEN) || 'Custom Resource',
    description: (input.description || '').trim().slice(0, MAX_RESOURCE_DESC_LEN),
    primaryUrl: safeUrl || 'https://scholar.google.com',
    authorOrCreator: (input.authorOrCreator || '').trim().slice(0, MAX_AUTHOR_LEN),
    formattedTime: (input.formattedTime || '').trim().slice(0, MAX_FORMATTED_TIME_LEN),
    exactQuote: (input.exactQuote || '').trim().slice(0, MAX_RESOURCE_QUOTE_LEN),
  };
}

const LOCAL_LISTS_KEY = 'opentranscript_saved_lists_v1';
const LOCAL_ITEMS_KEY = 'opentranscript_saved_list_items_v1';
const LOCAL_SUMMARIES_KEY = 'opentranscript_saved_summaries_v1';
const LOCAL_RESOURCES_KEY = 'opentranscript_custom_exact_resources_v1';
const LOCAL_HISTORY_KEY = 'opentranscript_activity_history_v1';

const historyListeners = new Set<(items: ActivityHistoryItem[]) => void>();
let lastRecordedSignature = '';
let lastRecordedTimestamp = 0;

function sanitizeActivityHistoryPayload(
  ownerId: string,
  input: {
    actionType: ActivityActionType;
    queryOrTitle: string;
    detail?: string;
    url?: string;
    videoId?: string;
    dateKey?: string;
  }
) {
  const safeAction: ActivityActionType = ALLOWED_ACTIVITY_TYPES.includes(input.actionType)
    ? input.actionType
    : 'research_search';
  const safeQuery = (input.queryOrTitle || 'Activity').trim().slice(0, MAX_ITEM_TITLE_LEN) || 'Activity';
  const safeDetail = (input.detail || '').trim().slice(0, MAX_RESOURCE_DESC_LEN);
  const safeUrl = (input.url || '').trim().slice(0, MAX_ITEM_URL_LEN);
  const safeVideoId = (input.videoId || '').trim().slice(0, MAX_VIDEO_ID_LEN);
  const rawDate = (input.dateKey || '').trim();
  const safeDateKey = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rawDate) ? rawDate : formatDateKey();

  return {
    ownerId: ownerId.slice(0, MAX_ID_LEN),
    actionType: safeAction,
    queryOrTitle: safeQuery,
    detail: safeDetail,
    url: safeUrl,
    videoId: safeVideoId,
    dateKey: safeDateKey,
  };
}

export function loadLocalActivityHistory(): ActivityHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local activity history:', err);
  }
  const todayKey = formatDateKey();
  const nowIso = new Date().toISOString();
  const initialHistory: ActivityHistoryItem[] = [
    {
      id: 'hist_initial_stanford_2005',
      ownerId: 'local_user',
      actionType: 'video',
      queryOrTitle: "Steve Jobs' 2005 Stanford Commencement Address",
      detail: 'Stanford University · Connecting the Dots, Love & Loss, Stay Hungry Stay Foolish',
      url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
      videoId: 'UF8uR6Z6KLc',
      dateKey: todayKey,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
  return initialHistory;
}

export function saveLocalActivityHistory(items: ActivityHistoryItem[]) {
  if (typeof window === 'undefined') return;
  try {
    const bounded = items.slice(0, 400);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(bounded));
    historyListeners.forEach((cb) => cb(bounded));
  } catch (err) {
    console.warn('Local storage quota exceeded while saving activity history:', err);
  }
}

export function subscribeToLocalActivityHistory(
  onUpdate: (items: ActivityHistoryItem[]) => void
): () => void {
  historyListeners.add(onUpdate);
  return () => {
    historyListeners.delete(onUpdate);
  };
}

export function loadLocalLists(): SavedUserList[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_LISTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local lists from storage:', err);
  }
  const defaultList: SavedUserList = {
    id: 'list_default_favorites',
    ownerId: 'local_user',
    name: 'My Favorite Video Summaries',
    description: 'Saved videos, summaries, books, and key takeaways.',
    category: 'favorites',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
  return [defaultList];
}

export function saveLocalLists(lists: SavedUserList[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_LISTS_KEY, JSON.stringify(lists));
  } catch (err) {
    console.warn('Local storage quota exceeded while saving lists:', err);
  }
}

export function loadLocalListItems(): SavedListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ITEMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local list items from storage:', err);
  }
  return [];
}

export function saveLocalListItems(items: SavedListItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Local storage quota exceeded while saving list items:', err);
  }
}

export function loadLocalSummaries(): SavedCloudSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUMMARIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local summaries from storage:', err);
  }
  return [];
}

export function saveLocalSummaries(summaries: SavedCloudSummary[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SUMMARIES_KEY, JSON.stringify(summaries));
  } catch (err) {
    console.warn('Local storage quota exceeded while saving summaries:', err);
  }
}

export function loadLocalCustomResources(): ExactVideoResource[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_RESOURCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read local custom resources from storage:', err);
  }
  return [];
}

export function saveLocalCustomResources(resources: ExactVideoResource[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_RESOURCES_KEY, JSON.stringify(resources));
  } catch (err) {
    console.warn('Local storage quota exceeded while saving custom resources:', err);
  }
}

function formatFirestoreTimestamp(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  return new Date().toISOString();
}

function parseTimeSeconds(formattedTime?: string): number | undefined {
  if (!formattedTime) return undefined;
  const parts = formattedTime.replace(/[\[\]]/g, '').split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return undefined;
}

/**
 * Ensure a parent list exists in Firestore for the signed-in user before adding subcollection items
 */
export async function ensureCloudListExists(
  requestedListId?: string,
  fallbackName = 'My Favorite Video Summaries'
): Promise<string> {
  const user = auth.currentUser;
  if (!user) return requestedListId || 'list_default_favorites';

  const targetListId =
    !requestedListId || requestedListId === 'list_default_favorites' || !ID_REGEX.test(requestedListId)
      ? getDefaultCloudListId(user.uid)
      : requestedListId.slice(0, MAX_ID_LEN);

  try {
    const listRef = doc(db, 'lists', targetListId);
    const snap = await getDoc(listRef);
    if (!snap.exists()) {
      const sanitized = sanitizeListPayload(
        user.uid,
        fallbackName,
        'Videos, summaries, books, and exact citations synced with Firebase.',
        'favorites'
      );
      await setDoc(listRef, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `lists/${targetListId}`);
  }

  return targetListId;
}

/**
 * Subscribe to the signed-in user's lists in Firestore (`/lists` where `ownerId == uid`)
 */
export function subscribeToUserLists(
  userId: string,
  onUpdate: (lists: SavedUserList[]) => void,
  onError?: (errMessage: string) => void
): () => void {
  const path = 'lists';
  const q = query(collection(db, path), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const lists: SavedUserList[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: data.ownerId,
          name: data.name,
          description: data.description || '',
          category: data.category || 'general',
          createdAt: formatFirestoreTimestamp(data.createdAt),
          updatedAt: formatFirestoreTimestamp(data.updatedAt),
        };
      });
      lists.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onUpdate(lists);
    },
    (error) => {
      const info = logFirestoreError(error, OperationType.LIST, path);
      onUpdate([]);
      onError?.(info.error);
    }
  );
}

/**
 * Subscribe to items in a specific list (`/lists/{listId}/items` where `ownerId == uid`)
 */
export function subscribeToListItems(
  listId: string,
  userId: string,
  onUpdate: (items: SavedListItem[]) => void,
  onError?: (errMessage: string) => void
): () => void {
  if (!listId || !userId || listId === 'list_default_favorites') {
    onUpdate([]);
    return () => {};
  }
  const path = `lists/${listId}/items`;
  const q = query(collection(db, path), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedListItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          listId: data.listId || listId,
          ownerId: data.ownerId,
          itemType: data.itemType || 'note',
          title: data.title || 'Saved Item',
          url: data.url || '',
          subtitle: data.subtitle || '',
          content: data.content || '',
          notes: data.notes || '',
          createdAt: formatFirestoreTimestamp(data.createdAt),
          updatedAt: formatFirestoreTimestamp(data.updatedAt),
        };
      });
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onUpdate(items);
    },
    (error) => {
      const info = logFirestoreError(error, OperationType.LIST, path);
      onUpdate([]);
      onError?.(info.error);
    }
  );
}

/**
 * Subscribe to the signed-in user's saved summaries in Firestore (`/summaries` where `ownerId == uid`)
 */
export function subscribeToSavedSummaries(
  userId: string,
  onUpdate: (summaries: SavedCloudSummary[]) => void,
  onError?: (errMessage: string) => void
): () => void {
  const path = 'summaries';
  const q = query(collection(db, path), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const summaries: SavedCloudSummary[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: data.ownerId,
          videoId: data.videoId || '',
          videoUrl: data.videoUrl || '',
          videoTitle: data.videoTitle || 'YouTube Video Summary',
          authorName: data.authorName || 'YouTube',
          summaryType: data.summaryType || 'massive',
          markdown: data.markdown || '',
          createdAt: formatFirestoreTimestamp(data.createdAt),
          updatedAt: formatFirestoreTimestamp(data.updatedAt),
        };
      });
      summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onUpdate(summaries);
    },
    (error) => {
      const info = logFirestoreError(error, OperationType.LIST, path);
      onUpdate([]);
      onError?.(info.error);
    }
  );
}

/**
 * Subscribe to the signed-in user's custom exact resources in Firestore (`/resources` where `ownerId == uid`)
 */
export function subscribeToCustomResources(
  userId: string,
  onUpdate: (resources: ExactVideoResource[]) => void,
  onError?: (errMessage: string) => void
): () => void {
  const path = 'resources';
  const q = query(collection(db, path), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const resources: ExactVideoResource[] = snapshot.docs.map((d) => {
        const data = d.data();
        const title = data.title || 'Exact Resource';
        const formattedTime = data.formattedTime || undefined;
        return {
          id: d.id,
          title,
          type: (data.resourceType as ExactVideoResource['type']) || 'Custom Resource',
          description: data.description || '',
          primaryUrl: data.primaryUrl || `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`,
          primaryLabel: 'Open Exact Resource',
          authorOrCreator: data.authorOrCreator || undefined,
          formattedTime,
          timestampSeconds: parseTimeSeconds(formattedTime),
          exactQuote: data.exactQuote || undefined,
          verified: true,
          secondaryLinks: [
            {
              label: 'Google Scholar',
              url: `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`,
              sourceName: 'Google Scholar',
            },
            {
              label: 'Wikipedia',
              url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(title)}`,
              sourceName: 'Wikipedia',
            },
            {
              label: 'OpenLibrary',
              url: `https://openlibrary.org/search?q=${encodeURIComponent(title)}`,
              sourceName: 'OpenLibrary',
            },
          ],
        };
      });
      onUpdate(resources);
    },
    (error) => {
      const info = logFirestoreError(error, OperationType.LIST, path);
      onUpdate([]);
      onError?.(info.error);
    }
  );
}

/**
 * Create a new list in Firestore (if signed in) or localStorage
 */
export async function createUserList(
  name: string,
  description: string,
  category: ListCategory,
  customId?: string
): Promise<SavedUserList> {
  const user = auth.currentUser;
  const listId =
    customId && ID_REGEX.test(customId)
      ? customId.slice(0, MAX_ID_LEN)
      : generateSafeId('list');

  if (user) {
    const path = `lists/${listId}`;
    const sanitized = sanitizeListPayload(user.uid, name, description, category);
    try {
      const listRef = doc(db, 'lists', listId);
      const existingSnap = await getDoc(listRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        return {
          id: listId,
          ownerId: existingData.ownerId || user.uid,
          name: existingData.name || sanitized.name,
          description: existingData.description || sanitized.description,
          category: existingData.category || sanitized.category,
          createdAt: formatFirestoreTimestamp(existingData.createdAt),
          updatedAt: formatFirestoreTimestamp(existingData.updatedAt),
        };
      }
      await setDoc(listRef, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id: listId,
        ...sanitized,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  // Local fallback when not signed in
  const sanitized = sanitizeListPayload('local_user', name, description, category);
  const newList: SavedUserList = {
    id: listId,
    ...sanitized,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const current = loadLocalLists();
  saveLocalLists([newList, ...current]);
  return newList;
}

/**
 * Update an existing list's name, description, or category
 */
export async function updateUserList(
  listId: string,
  name: string,
  description: string,
  category: ListCategory
): Promise<void> {
  const user = auth.currentUser;
  if (user) {
    const path = `lists/${listId}`;
    const sanitized = sanitizeListPayload(user.uid, name, description, category);
    try {
      await updateDoc(doc(db, 'lists', listId), {
        name: sanitized.name,
        description: sanitized.description,
        category: sanitized.category,
        updatedAt: serverTimestamp(),
      });
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  const current = loadLocalLists();
  const updated = current.map((l) =>
    l.id === listId
      ? {
          ...l,
          name: name.trim().slice(0, MAX_LIST_NAME_LEN) || l.name,
          description: description.trim().slice(0, MAX_LIST_DESC_LEN),
          category,
          updatedAt: new Date().toISOString(),
        }
      : l
  );
  saveLocalLists(updated);
}

/**
 * Delete a user list and its subcollection items
 */
export async function deleteUserList(listId: string): Promise<void> {
  const user = auth.currentUser;
  if (user) {
    const itemsPath = `lists/${listId}/items`;
    try {
      const q = query(collection(db, itemsPath), where('ownerId', '==', user.uid));
      const snap = await getDocs(q);
      // Delete subcollection items in chunks of up to 450 operations per Firestore writeBatch,
      // committing the parent list deletion in the final batch (single-batch atomic when <= 449 items).
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 450) {
        const batch = writeBatch(db);
        for (const itemDoc of docs.slice(i, i + 450)) {
          batch.delete(doc(db, 'lists', listId, 'items', itemDoc.id));
        }
        if (i + 450 >= docs.length) {
          batch.delete(doc(db, 'lists', listId));
        }
        await batch.commit();
      }
      if (docs.length === 0) {
        await deleteDoc(doc(db, 'lists', listId));
      }
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `lists/${listId}`);
    }
  }

  const lists = loadLocalLists().filter((l) => l.id !== listId);
  saveLocalLists(lists);
  const items = loadLocalListItems().filter((i) => i.listId !== listId);
  saveLocalListItems(items);
}

/**
 * Add an item (video summary, book, article, or note) to a specific list
 */
export async function addItemToUserList(
  listId: string,
  input: {
    itemType: ListItemType;
    title: string;
    url?: string;
    subtitle?: string;
    content?: string;
    notes?: string;
  }
): Promise<SavedListItem> {
  const user = auth.currentUser;
  const itemId = generateSafeId('item');

  if (user) {
    const targetListId = await ensureCloudListExists(listId);
    const path = `lists/${targetListId}/items/${itemId}`;
    const sanitized = sanitizeListItemPayload(targetListId, user.uid, input);
    try {
      await setDoc(doc(db, 'lists', targetListId, 'items', itemId), {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id: itemId,
        ...sanitized,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  const sanitized = sanitizeListItemPayload(listId || 'list_default_favorites', 'local_user', input);
  const newItem: SavedListItem = {
    id: itemId,
    ...sanitized,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const current = loadLocalListItems();
  saveLocalListItems([newItem, ...current]);
  return newItem;
}

/**
 * Update personal notes or title on a saved item
 */
export async function updateListItemNotes(
  listId: string,
  itemId: string,
  notes: string,
  title?: string
): Promise<void> {
  const user = auth.currentUser;
  const safeNotes = (notes || '').slice(0, MAX_ITEM_NOTES_LEN);
  if (user) {
    const path = `lists/${listId}/items/${itemId}`;
    try {
      const payload: Record<string, any> = {
        notes: safeNotes,
        updatedAt: serverTimestamp(),
      };
      if (title !== undefined) {
        payload.title = title.trim().slice(0, MAX_ITEM_TITLE_LEN) || 'Saved Item';
      }
      await updateDoc(doc(db, 'lists', listId, 'items', itemId), payload);
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  const items = loadLocalListItems().map((it) =>
    it.id === itemId && it.listId === listId
      ? {
          ...it,
          notes: safeNotes,
          title: title !== undefined ? title.trim().slice(0, MAX_ITEM_TITLE_LEN) || it.title : it.title,
          updatedAt: new Date().toISOString(),
        }
      : it
  );
  saveLocalListItems(items);
}

/**
 * Delete a saved item from a list
 */
export async function deleteItemFromUserList(listId: string, itemId: string): Promise<void> {
  const user = auth.currentUser;
  if (user) {
    const path = `lists/${listId}/items/${itemId}`;
    try {
      await deleteDoc(doc(db, 'lists', listId, 'items', itemId));
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  const items = loadLocalListItems().filter((i) => !(i.id === itemId && i.listId === listId));
  saveLocalListItems(items);
}

/**
 * Save or update a Video Summary directly in Firestore (`/summaries/{summaryId}`)
 */
export async function saveSummaryToFirestore(input: {
  videoId?: string;
  videoUrl?: string;
  videoTitle: string;
  authorName?: string;
  summaryType?: string;
  markdown: string;
}): Promise<SavedCloudSummary> {
  const user = auth.currentUser;
  const rawVideoId = (input.videoId || '').trim().replace(/[^a-zA-Z0-9_\-]/g, '');
  const uniqueKey =
    rawVideoId.length >= 6
      ? rawVideoId.slice(0, 36)
      : `doc_${computeStableHash(`${input.videoTitle || ''}:${input.videoUrl || ''}:${(input.markdown || '').slice(0, 250)}`)}`;

  if (user) {
    const cleanUid = user.uid.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 48) || 'user';
    const summaryId = `sum_${cleanUid}_${uniqueKey}`;
    const path = `summaries/${summaryId}`;
    const sanitized = sanitizeSavedSummaryPayload(user.uid, input);

    try {
      const summaryRef = doc(db, 'summaries', summaryId);
      const snap = await getDoc(summaryRef);

      if (snap.exists()) {
        await updateDoc(summaryRef, {
          videoId: sanitized.videoId,
          videoUrl: sanitized.videoUrl,
          videoTitle: sanitized.videoTitle,
          authorName: sanitized.authorName,
          summaryType: sanitized.summaryType,
          markdown: sanitized.markdown,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(summaryRef, {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return {
        id: summaryId,
        ...sanitized,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  // Local fallback when not signed in
  const summaryId = `sum_local_${uniqueKey}`;
  const sanitized = sanitizeSavedSummaryPayload('local_user', input);
  const newSummary: SavedCloudSummary = {
    id: summaryId,
    ...sanitized,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const current = loadLocalSummaries().filter((s) => s.id !== summaryId);
  saveLocalSummaries([newSummary, ...current]);
  return newSummary;
}

/**
 * Create a custom Exact Video Resource in Firestore (`/resources/{resourceId}`) or localStorage
 */
export async function createCustomExactResource(input: {
  videoId?: string;
  title: string;
  type: ExactVideoResource['type'];
  description: string;
  primaryUrl: string;
  authorOrCreator?: string;
  formattedTime?: string;
  exactQuote?: string;
}): Promise<ExactVideoResource> {
  const user = auth.currentUser;
  const resourceId = generateSafeId('res');

  const createdResource: ExactVideoResource = {
    id: resourceId,
    title: input.title.trim(),
    type: input.type,
    description: input.description.trim(),
    primaryUrl: input.primaryUrl.trim(),
    primaryLabel: 'Open Exact Resource',
    authorOrCreator: input.authorOrCreator?.trim() || undefined,
    formattedTime: input.formattedTime?.trim() || undefined,
    timestampSeconds: parseTimeSeconds(input.formattedTime),
    exactQuote: input.exactQuote?.trim() || undefined,
    verified: true,
    secondaryLinks: [
      {
        label: 'Google Scholar',
        url: `https://scholar.google.com/scholar?q=${encodeURIComponent(input.title.trim())}`,
        sourceName: 'Google Scholar',
      },
      {
        label: 'Wikipedia',
        url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(input.title.trim())}`,
        sourceName: 'Wikipedia',
      },
      {
        label: 'OpenLibrary',
        url: `https://openlibrary.org/search?q=${encodeURIComponent(input.title.trim())}`,
        sourceName: 'OpenLibrary',
      },
    ],
  };

  if (user) {
    const path = `resources/${resourceId}`;
    const sanitized = sanitizeCustomResourcePayload(user.uid, input);
    try {
      await setDoc(doc(db, 'resources', resourceId), {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  // Update local cache after cloud write succeeds (or when in local mode)
  const currentLocal = loadLocalCustomResources();
  saveLocalCustomResources([createdResource, ...currentLocal]);

  return createdResource;
}

/**
 * Delete a custom Exact Video Resource from Firestore (`/resources/{resourceId}`) and localStorage
 */
export async function deleteCustomExactResource(resourceId: string): Promise<void> {
  const user = auth.currentUser;
  if (user && ID_REGEX.test(resourceId)) {
    const path = `resources/${resourceId}`;
    try {
      await deleteDoc(doc(db, 'resources', resourceId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  const updatedLocal = loadLocalCustomResources().filter((r) => r.id !== resourceId);
  saveLocalCustomResources(updatedLocal);
}

/**
 * Automatically migrate any local lists, items, summaries, and custom resources into Firebase Firestore upon sign-in,
 * preserving list mappings, deduplicating by ID + (title, url), isolating per-item errors, and clearing migrated local storage.
 */
export async function syncLocalDataToFirestore(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const defaultListId = await ensureCloudListExists(getDefaultCloudListId(user.uid));

    // 1. Migrate custom local lists (other than list_default_favorites)
    const rawListsStr = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_LISTS_KEY) : null;
    if (rawListsStr) {
      const localLists = loadLocalLists();
      for (const l of localLists) {
        if (!l || l.id === 'list_default_favorites') continue;
        try {
          const targetId = ID_REGEX.test(l.id) ? l.id.slice(0, MAX_ID_LEN) : generateSafeId('list');
          const ref = doc(db, 'lists', targetId);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            const sanitized = sanitizeListPayload(user.uid, l.name, l.description, l.category);
            await setDoc(ref, {
              ...sanitized,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.warn('Skipping single local list migration error:', err);
        }
      }
      try {
        localStorage.removeItem(LOCAL_LISTS_KEY);
      } catch {}
    }

    // 2. Migrate local list items into their mapped cloud list (or defaultListId)
    const localItems = loadLocalListItems();
    if (localItems.length > 0) {
      const unmigratedItems: SavedListItem[] = [];
      for (const item of localItems) {
        try {
          const mappedListId =
            !item.listId || item.listId === 'list_default_favorites' || !ID_REGEX.test(item.listId)
              ? defaultListId
              : await ensureCloudListExists(item.listId);
          const itemId = ID_REGEX.test(item.id)
            ? item.id.slice(0, MAX_ID_LEN)
            : `item_${computeStableHash(`${item.title}:${item.url}:${item.content?.slice(0, 100) || ''}`)}`;
          const itemRef = doc(db, 'lists', mappedListId, 'items', itemId);
          const snap = await getDoc(itemRef);
          if (!snap.exists()) {
            const sanitized = sanitizeListItemPayload(mappedListId, user.uid, item);
            await setDoc(itemRef, {
              ...sanitized,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.warn('Skipping single local item migration error:', err);
          unmigratedItems.push(item);
        }
      }
      saveLocalListItems(unmigratedItems);
    }

    // 3. Migrate local summaries into Firestore `/summaries`
    const localSummaries = loadLocalSummaries();
    if (localSummaries.length > 0) {
      const unmigratedSummaries: SavedCloudSummary[] = [];
      for (const s of localSummaries) {
        try {
          await saveSummaryToFirestore({
            videoId: s.videoId,
            videoUrl: s.videoUrl,
            videoTitle: s.videoTitle,
            authorName: s.authorName,
            summaryType: s.summaryType,
            markdown: s.markdown,
          });
        } catch (err) {
          console.warn('Skipping single local summary migration error:', err);
          unmigratedSummaries.push(s);
        }
      }
      saveLocalSummaries(unmigratedSummaries);
    }

    // 4. Migrate local custom exact resources into Firestore `/resources`
    const localResources = loadLocalCustomResources();
    if (localResources.length > 0) {
      const existingResSnap = await getDocs(
        query(collection(db, 'resources'), where('ownerId', '==', user.uid))
      );
      const existingResKeys = new Set(
        existingResSnap.docs.map((d) => `${d.data().title}::${d.data().primaryUrl || ''}`)
      );
      const unmigratedResources: ExactVideoResource[] = [];
      for (const res of localResources) {
        const dedupeKey = `${res.title}::${res.primaryUrl || ''}`;
        if (existingResKeys.has(dedupeKey)) continue;
        try {
          const resId = ID_REGEX.test(res.id) ? res.id.slice(0, MAX_ID_LEN) : generateSafeId('res');
          const sanitized = sanitizeCustomResourcePayload(user.uid, {
            title: res.title,
            type: res.type,
            description: res.description,
            primaryUrl: res.primaryUrl,
            authorOrCreator: res.authorOrCreator,
            formattedTime: res.formattedTime,
            exactQuote: res.exactQuote,
          });
          await setDoc(doc(db, 'resources', resId), {
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          existingResKeys.add(dedupeKey);
        } catch (err) {
          console.warn('Skipping single local resource migration error:', err);
          unmigratedResources.push(res);
        }
      }
      saveLocalCustomResources(unmigratedResources);
    }

    // 5. Migrate local activity & search history into Firestore `/history`
    const localHistory = loadLocalActivityHistory();
    if (localHistory.length > 0) {
      const existingHistSnap = await getDocs(
        query(collection(db, 'history'), where('ownerId', '==', user.uid))
      );
      const existingHistIds = new Set(existingHistSnap.docs.map((d) => d.id));
      const unmigratedHistory: ActivityHistoryItem[] = [];

      for (const h of localHistory.slice(0, 120)) {
        try {
          const histId = ID_REGEX.test(h.id)
            ? h.id.slice(0, MAX_ID_LEN)
            : `hist_${computeStableHash(`${h.actionType}:${h.queryOrTitle}:${h.dateKey}:${h.createdAt}`)}`;
          if (existingHistIds.has(histId)) continue;

          const sanitized = sanitizeActivityHistoryPayload(user.uid, {
            actionType: h.actionType,
            queryOrTitle: h.queryOrTitle,
            detail: h.detail,
            url: h.url,
            videoId: h.videoId,
            dateKey: h.dateKey,
          });
          await setDoc(doc(db, 'history', histId), {
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          existingHistIds.add(histId);
        } catch (err) {
          console.warn('Skipping single local history migration error:', err);
          unmigratedHistory.push(h);
        }
      }
      saveLocalActivityHistory(unmigratedHistory);
    }
  } catch (err) {
    console.warn('Background Firebase sync warning:', err);
  }
}

/**
 * Subscribe to the signed-in user's chronological activity & search history in Firestore (`/history` where `ownerId == uid`)
 */
export function subscribeToActivityHistory(
  userId: string,
  onUpdate: (items: ActivityHistoryItem[]) => void,
  onError?: (errMessage: string) => void
): () => void {
  const path = 'history';
  const q = query(collection(db, path), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ActivityHistoryItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        const createdIso = formatFirestoreTimestamp(data.createdAt);
        return {
          id: d.id,
          ownerId: data.ownerId || userId,
          actionType: ALLOWED_ACTIVITY_TYPES.includes(data.actionType) ? data.actionType : 'research_search',
          queryOrTitle: data.queryOrTitle || 'Activity',
          detail: data.detail || '',
          url: data.url || '',
          videoId: data.videoId || '',
          dateKey:
            typeof data.dateKey === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(data.dateKey)
              ? data.dateKey
              : formatDateKey(createdIso),
          createdAt: createdIso,
          updatedAt: formatFirestoreTimestamp(data.updatedAt),
        };
      });
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onUpdate(items);
    },
    (error) => {
      const info = logFirestoreError(error, OperationType.LIST, path);
      onUpdate(loadLocalActivityHistory());
      onError?.(info.error);
    }
  );
}

/**
 * Record any user search or action into date-grouped history (Firestore + localStorage fallback)
 */
export async function recordUserActivity(input: {
  actionType:
    | ActivityActionType
    | 'search'
    | 'dictionary'
    | 'techword'
    | 'knowledge'
    | 'chat'
    | 'transcript'
    | 'artifact';
  queryOrTitle?: string;
  title?: string;
  query?: string;
  detail?: string;
  details?: string;
  url?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoId?: string;
}): Promise<ActivityHistoryItem | null> {
  const actionMap: Record<string, ActivityActionType> = {
    video: 'video',
    summary: 'summary',
    word_lookup: 'word_lookup',
    dictionary: 'word_lookup',
    techword: 'word_lookup',
    knowledge: 'word_lookup',
    research_search: 'research_search',
    search: 'research_search',
    transcript_search: 'transcript_search',
    transcript: 'transcript_search',
    ai_question: 'ai_question',
    chat: 'ai_question',
    artifact_saved: 'artifact_saved',
    artifact: 'artifact_saved',
    audio_narration: 'audio_narration',
  };
  const normalizedAction: ActivityActionType = actionMap[input.actionType] || 'research_search';
  const cleanTitle = (input.queryOrTitle || input.title || input.query || '').trim();
  if (!cleanTitle || cleanTitle.length < 2) return null;

  const combinedDetail = [
    input.detail || input.details || '',
    input.videoTitle && !(input.detail || input.details || '').includes(input.videoTitle)
      ? `Video: ${input.videoTitle}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const resolvedUrl = input.url || input.videoUrl || '';

  const nowMs = Date.now();
  const signature = `${normalizedAction}::${cleanTitle.toLowerCase()}::${input.videoId || ''}`;
  if (signature === lastRecordedSignature && nowMs - lastRecordedTimestamp < 2500) {
    return null;
  }
  lastRecordedSignature = signature;
  lastRecordedTimestamp = nowMs;

  const user = auth.currentUser;
  const dateKey = formatDateKey();
  const historyId = generateSafeId('hist');
  const nowIso = new Date().toISOString();

  if (user) {
    const sanitized = sanitizeActivityHistoryPayload(user.uid, {
      actionType: normalizedAction,
      queryOrTitle: cleanTitle,
      detail: combinedDetail,
      url: resolvedUrl,
      videoId: input.videoId,
      dateKey,
    });
    try {
      await setDoc(doc(db, 'history', historyId), {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id: historyId,
        ...sanitized,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    } catch (error) {
      logFirestoreError(error, OperationType.CREATE, `history/${historyId}`);
    }
  }

  const sanitizedLocal = sanitizeActivityHistoryPayload('local_user', {
    actionType: normalizedAction,
    queryOrTitle: cleanTitle,
    detail: combinedDetail,
    url: resolvedUrl,
    videoId: input.videoId,
    dateKey,
  });
  const localItem: ActivityHistoryItem = {
    id: historyId,
    ...sanitizedLocal,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const current = loadLocalActivityHistory();
  saveLocalActivityHistory([localItem, ...current]);
  return localItem;
}

export async function deleteActivityHistoryItem(historyId: string): Promise<void> {
  const user = auth.currentUser;
  if (user && ID_REGEX.test(historyId)) {
    try {
      await deleteDoc(doc(db, 'history', historyId));
    } catch (error) {
      logFirestoreError(error, OperationType.DELETE, `history/${historyId}`);
    }
  }
  const current = loadLocalActivityHistory().filter((h) => h.id !== historyId);
  saveLocalActivityHistory(current);
}

export async function clearActivityHistoryByDate(dateKey: string): Promise<void> {
  const user = auth.currentUser;
  if (user) {
    try {
      const q = query(
        collection(db, 'history'),
        where('ownerId', '==', user.uid),
        where('dateKey', '==', dateKey)
      );
      const snap = await getDocs(q);
      for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = writeBatch(db);
        for (const d of snap.docs.slice(i, i + 450)) {
          batch.delete(doc(db, 'history', d.id));
        }
        await batch.commit();
      }
    } catch (error) {
      logFirestoreError(error, OperationType.DELETE, 'history');
    }
  }
  const current = loadLocalActivityHistory().filter((h) => h.dateKey !== dateKey);
  saveLocalActivityHistory(current);
}

export const clearActivityHistoryForDate = clearActivityHistoryByDate;

export async function clearAllActivityHistory(): Promise<void> {
  const user = auth.currentUser;
  if (user) {
    try {
      const q = query(collection(db, 'history'), where('ownerId', '==', user.uid));
      const snap = await getDocs(q);
      for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = writeBatch(db);
        for (const d of snap.docs.slice(i, i + 450)) {
          batch.delete(doc(db, 'history', d.id));
        }
        await batch.commit();
      }
    } catch (error) {
      logFirestoreError(error, OperationType.DELETE, 'history');
    }
  }
  saveLocalActivityHistory([]);
}

