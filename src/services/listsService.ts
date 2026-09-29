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
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { ExactVideoResource } from '../types';

export type ListCategory = 'general' | 'videos' | 'reading' | 'study' | 'favorites';
export type ListItemType = 'video' | 'summary' | 'book' | 'article' | 'note';

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

function generateSafeId(prefix: string): string {
  const raw = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, MAX_ID_LEN);
  return ID_REGEX.test(cleaned) ? cleaned : `id_${Date.now()}`;
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

export function loadLocalLists(): SavedUserList[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_LISTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const defaultList: SavedUserList = {
    id: 'list_default_favorites',
    ownerId: 'local_user',
    name: 'My Favorite Video Summaries',
    description: 'Saved videos, summaries, books, and key takeaways.',
    category: 'favorites',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveLocalLists([defaultList]);
  return [defaultList];
}

export function saveLocalLists(lists: SavedUserList[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_LISTS_KEY, JSON.stringify(lists));
  } catch {}
}

export function loadLocalListItems(): SavedListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ITEMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalListItems(items: SavedListItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(items));
  } catch {}
}

export function loadLocalSummaries(): SavedCloudSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUMMARIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalSummaries(summaries: SavedCloudSummary[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SUMMARIES_KEY, JSON.stringify(summaries));
  } catch {}
}

export function loadLocalCustomResources(): ExactVideoResource[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_RESOURCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalCustomResources(resources: ExactVideoResource[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_RESOURCES_KEY, JSON.stringify(resources));
  } catch {}
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
    const q = query(collection(db, 'lists'), where('ownerId', '==', user.uid));
    const snap = await getDocs(q);
    const existsAlready = snap.docs.some((d) => d.id === targetListId);
    if (!existsAlready) {
      const sanitized = sanitizeListPayload(
        user.uid,
        fallbackName,
        'Videos, summaries, books, and exact citations synced with Firebase.',
        'favorites'
      );
      await setDoc(doc(db, 'lists', targetListId), {
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
  onUpdate: (lists: SavedUserList[]) => void
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
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Subscribe to items in a specific list (`/lists/{listId}/items` where `ownerId == uid`)
 */
export function subscribeToListItems(
  listId: string,
  userId: string,
  onUpdate: (items: SavedListItem[]) => void
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
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Subscribe to the signed-in user's saved summaries in Firestore (`/summaries` where `ownerId == uid`)
 */
export function subscribeToSavedSummaries(
  userId: string,
  onUpdate: (summaries: SavedCloudSummary[]) => void
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
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Subscribe to the signed-in user's custom exact resources in Firestore (`/resources` where `ownerId == uid`)
 */
export function subscribeToCustomResources(
  userId: string,
  onUpdate: (resources: ExactVideoResource[]) => void
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
      handleFirestoreError(error, OperationType.LIST, path);
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
      await setDoc(doc(db, 'lists', listId), {
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
      for (const itemDoc of snap.docs) {
        await deleteDoc(doc(db, 'lists', listId, 'items', itemDoc.id));
      }
      await deleteDoc(doc(db, 'lists', listId));
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
  const cleanVid = (input.videoId || input.videoTitle || 'video')
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .slice(0, 36) || 'vid';

  if (user) {
    const cleanUid = user.uid.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 48) || 'user';
    const summaryId = `sum_${cleanUid}_${cleanVid}`;
    const path = `summaries/${summaryId}`;
    const sanitized = sanitizeSavedSummaryPayload(user.uid, input);

    try {
      const q = query(collection(db, 'summaries'), where('ownerId', '==', user.uid));
      const snap = await getDocs(q);
      const existsAlready = snap.docs.some((d) => d.id === summaryId);

      if (existsAlready) {
        await updateDoc(doc(db, 'summaries', summaryId), {
          videoId: sanitized.videoId,
          videoUrl: sanitized.videoUrl,
          videoTitle: sanitized.videoTitle,
          authorName: sanitized.authorName,
          summaryType: sanitized.summaryType,
          markdown: sanitized.markdown,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'summaries', summaryId), {
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
  const summaryId = `sum_local_${cleanVid}`;
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

  // Always update local cache for instant access
  const currentLocal = loadLocalCustomResources();
  saveLocalCustomResources([createdResource, ...currentLocal]);

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

  return createdResource;
}

/**
 * Delete a custom Exact Video Resource from Firestore (`/resources/{resourceId}`) and localStorage
 */
export async function deleteCustomExactResource(resourceId: string): Promise<void> {
  const updatedLocal = loadLocalCustomResources().filter((r) => r.id !== resourceId);
  saveLocalCustomResources(updatedLocal);

  const user = auth.currentUser;
  if (user && ID_REGEX.test(resourceId)) {
    const path = `resources/${resourceId}`;
    try {
      await deleteDoc(doc(db, 'resources', resourceId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

/**
 * Automatically migrate any local lists, items, summaries, and custom resources into Firebase Firestore upon sign-in
 */
export async function syncLocalDataToFirestore(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // 1. Ensure default cloud Favorites list exists
    const defaultListId = await ensureCloudListExists(getDefaultCloudListId(user.uid));

    // 2. Sync any local items that aren't in Firestore yet
    const localItems = loadLocalListItems();
    if (localItems.length > 0) {
      const existingItemsSnap = await getDocs(
        query(collection(db, `lists/${defaultListId}/items`), where('ownerId', '==', user.uid))
      );
      const existingTitles = new Set(existingItemsSnap.docs.map((d) => d.data().title));
      for (const item of localItems) {
        if (!existingTitles.has(item.title)) {
          const itemId = ID_REGEX.test(item.id) ? item.id.slice(0, MAX_ID_LEN) : generateSafeId('item');
          const sanitized = sanitizeListItemPayload(defaultListId, user.uid, item);
          await setDoc(doc(db, 'lists', defaultListId, 'items', itemId), {
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    // 3. Sync any local custom exact resources into Firestore `/resources`
    const localResources = loadLocalCustomResources();
    if (localResources.length > 0) {
      const existingResSnap = await getDocs(
        query(collection(db, 'resources'), where('ownerId', '==', user.uid))
      );
      const existingResTitles = new Set(existingResSnap.docs.map((d) => d.data().title));
      for (const res of localResources) {
        if (!existingResTitles.has(res.title)) {
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
        }
      }
    }
  } catch (err) {
    console.warn('Background Firebase sync warning:', err);
  }
}
