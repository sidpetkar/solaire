import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  type DocumentData,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { imageStore, thumbnailStore, metaStore, editStore } from '../store/db';
import type { EditSession } from '../hooks/useEditSession';

export interface CloudImageMeta {
  id: string;
  timestamp: number;
  lutId?: string;
  folderId?: string;
  imageUrl?: string;
  thumbUrl?: string;
}

function imagesCol(uid: string) {
  return collection(db, 'users', uid, 'images');
}

function imageRef(uid: string, imageId: string) {
  return ref(storage, `users/${uid}/images/${imageId}.jpg`);
}

function thumbRef(uid: string, imageId: string) {
  return ref(storage, `users/${uid}/thumbs/${imageId}.jpg`);
}

export async function uploadImageToCloud(
  uid: string,
  id: string,
  blob: Blob,
  thumbBlob: Blob,
  meta: { timestamp: number; lutId?: string; folderId?: string },
): Promise<void> {
  if (!db || !storage) return;

  try {
    const [imageUrl, thumbUrl] = await Promise.all([
      uploadBytes(imageRef(uid, id), blob, { contentType: 'image/jpeg' }).then((snap) =>
        getDownloadURL(snap.ref),
      ),
      uploadBytes(thumbRef(uid, id), thumbBlob, { contentType: 'image/jpeg' }).then((snap) =>
        getDownloadURL(snap.ref),
      ),
    ]);

    await setDoc(doc(imagesCol(uid), id), {
      id,
      timestamp: meta.timestamp,
      lutId: meta.lutId ?? null,
      folderId: meta.folderId ?? null,
      imageUrl,
      thumbUrl,
    });
  } catch (err) {
    console.error('Cloud upload failed (will retry later):', err);
  }
}

export async function deleteImageFromCloud(uid: string, id: string): Promise<void> {
  if (!db || !storage) return;

  try {
    await Promise.all([
      deleteObject(imageRef(uid, id)).catch(() => {}),
      deleteObject(thumbRef(uid, id)).catch(() => {}),
      deleteDoc(doc(imagesCol(uid), id)),
    ]);
  } catch (err) {
    console.error('Cloud delete failed:', err);
  }
}

export async function syncFromCloud(uid: string): Promise<number> {
  if (!db || !storage) return 0;

  try {
    const q = query(imagesCol(uid), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);

    let synced = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as DocumentData;
      const id = data.id as string;

      const existsLocally = await metaStore.getItem(id);
      if (existsLocally) continue;

      try {
        const [imageResp, thumbResp] = await Promise.all([
          fetch(data.imageUrl as string),
          fetch(data.thumbUrl as string),
        ]);

        if (!imageResp.ok || !thumbResp.ok) continue;

        const [imageBlob, thumbBlob] = await Promise.all([
          imageResp.blob(),
          thumbResp.blob(),
        ]);

        await imageStore.setItem(id, imageBlob);
        await thumbnailStore.setItem(id, thumbBlob);
        await metaStore.setItem(id, {
          id,
          timestamp: data.timestamp as number,
          lutId: (data.lutId as string) ?? undefined,
          folderId: (data.folderId as string) ?? undefined,
        });

        synced++;
      } catch {
        // skip individual image failures
      }
    }

    return synced;
  } catch (err) {
    console.error('Cloud sync failed:', err);
    return 0;
  }
}

// ── Edit state cloud sync ───────────────────────────────────────────

function editStatesCol(uid: string) {
  return collection(db, 'users', uid, 'editStates');
}

export async function uploadEditState(uid: string, imageId: string, session: EditSession): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(editStatesCol(uid), imageId), {
      imageId: session.imageId,
      history: JSON.stringify(session.history),
      historyIndex: session.historyIndex,
      filterStrength: session.filterStrength,
      activePanel: session.activePanel,
      updatedAt: session.updatedAt,
    });
  } catch (err) {
    console.error('Edit state upload failed:', err);
  }
}

export async function downloadEditState(uid: string, imageId: string): Promise<EditSession | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(editStatesCol(uid), imageId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      imageId: data.imageId as string,
      history: JSON.parse(data.history as string),
      historyIndex: data.historyIndex as number,
      filterStrength: data.filterStrength as number,
      activePanel: data.activePanel as string,
      updatedAt: data.updatedAt as number,
    };
  } catch (err) {
    console.error('Edit state download failed:', err);
    return null;
  }
}

export async function syncEditStatesFromCloud(uid: string): Promise<void> {
  if (!db) return;
  try {
    const snapshot = await getDocs(editStatesCol(uid));
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const imageId = data.imageId as string;
      const local = await editStore.getItem<EditSession>(imageId);
      const cloudUpdated = data.updatedAt as number;
      if (local && local.updatedAt >= cloudUpdated) continue;
      await editStore.setItem(imageId, {
        imageId,
        history: JSON.parse(data.history as string),
        historyIndex: data.historyIndex as number,
        filterStrength: data.filterStrength as number,
        activePanel: data.activePanel as string,
        updatedAt: cloudUpdated,
      });
    }
  } catch (err) {
    console.error('Edit states sync failed:', err);
  }
}

export async function uploadAllLocalToCloud(uid: string): Promise<void> {
  if (!db || !storage) return;

  interface LocalMeta {
    id: string;
    timestamp: number;
    lutId?: string;
    folderId?: string;
  }

  const metas: LocalMeta[] = [];
  await metaStore.iterate<LocalMeta, void>((value) => {
    metas.push(value);
  });

  for (const meta of metas) {
    const imageBlob = await imageStore.getItem<Blob>(meta.id);
    const thumbBlob = await thumbnailStore.getItem<Blob>(meta.id);
    if (!imageBlob || !thumbBlob) continue;

    await uploadImageToCloud(uid, meta.id, imageBlob, thumbBlob, meta);
  }

  // Also push any local edit sessions
  await editStore.iterate<EditSession, void>(async (session, key) => {
    await uploadEditState(uid, key, session);
  });
}
