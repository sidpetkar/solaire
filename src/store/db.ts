import localforage from 'localforage';

export const imageStore = localforage.createInstance({
  name: 'solaire',
  storeName: 'images',
  description: 'Saved edited images',
});

export const thumbnailStore = localforage.createInstance({
  name: 'solaire',
  storeName: 'thumbnails',
  description: 'Image thumbnails for gallery',
});

export const metaStore = localforage.createInstance({
  name: 'solaire',
  storeName: 'meta',
  description: 'Image metadata',
});

export const settingsStore = localforage.createInstance({
  name: 'solaire',
  storeName: 'settings',
  description: 'App settings and preferences',
});

export const folderStore = localforage.createInstance({
  name: 'solaire',
  storeName: 'folders',
  description: 'Photo folders',
});

export const editStore = localforage.createInstance({
  name: 'solaire',
  storeName: 'editSessions',
  description: 'Persistent edit history per image',
});
