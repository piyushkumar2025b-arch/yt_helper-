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
const ALLOWED_CATEGORIES: ListCategory[] = ['general', 'videos', 'reading', 'study', 'favorites'];
const ALLOWED_ITEM_TYPES: ListItemType[] = ['video', 'summary', 'book', 'article', 'note'];

function generateSafeId(prefix: string): string {
  const raw = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, MAX_ID_LEN);
  return ID_REGEX.test(cleaned) ? cleaned : `id_${Date.now()}`;
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

const LOCAL_LISTS_KEY = 'opentranscript_saved_lists_v1';
const LOCAL_ITEMS_KEY = 'opentranscript_saved_list_items_v1';

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
 * Create a new list in Firestore (if signed in) or localStorage
 */
export async function createUserList(
  name: string,
  description: string,
  category: ListCategory
): Promise<SavedUserList> {
  const user = auth.currentUser;
  const listId = generateSafeId('list');

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
    const path = `lists/${listId}/items/${itemId}`;
    const sanitized = sanitizeListItemPayload(listId, user.uid, input);
    try {
      await setDoc(doc(db, 'lists', listId, 'items', itemId), {
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

  const sanitized = sanitizeListItemPayload(listId, 'local_user', input);
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
