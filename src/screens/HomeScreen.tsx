import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GearSix, Trash, X } from '@phosphor-icons/react';
import ScreenShell from '../components/ScreenShell';
import ScreenHeader from '../components/ScreenHeader';
import MasonryGrid from '../components/MasonryGrid';
import HomeFAB from '../components/HomeFAB';
import PhotoFolderTabs from '../components/PhotoFolderTabs';
import FolderContextMenu from '../components/FolderContextMenu';
import WelcomeGreeting from '../components/WelcomeGreeting';
import { useImageStore } from '../hooks/useImageStore';
import { useFolderStore } from '../hooks/useFolderStore';
import { useGreeting } from '../hooks/useGreeting';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { initLUTs } from '../engine/lutManager';
import { FREE_IMAGE_LIMIT } from '../engine/lutTier';
import PricingModal from '../components/PricingModal';
import { SettingsDrawer } from './SettingsScreen';

const SCROLL_HIDE_THRESHOLD = 10;

export default function HomeScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isProUser } = useSubscription();
  const firstName = user?.displayName?.split(' ')[0] ?? null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const { images, importImages, deleteImage, refresh: refreshImages } = useImageStore();
  const { folders, createFolder, deleteFolder, renameFolder, refresh: refreshFolders } = useFolderStore(refreshImages);
  const [barsHidden, setBarsHidden] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    folderId: string;
    folderName: string;
    rect: DOMRect;
  } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;
  const [showSettings, setShowSettings] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => { initLUTs(); }, []);

  useEffect(() => {
    const handler = () => refreshImages();
    window.addEventListener('solaire-cloud-sync', handler);
    return () => window.removeEventListener('solaire-cloud-sync', handler);
  }, [refreshImages]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      if (files.length === 1) {
        const url = URL.createObjectURL(files[0]);
        navigate('/edit', { state: { imageUrl: url } });
      } else {
        const blobs = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (blobs.length === 0) {
          e.target.value = '';
          return;
        }
        if (!isProUser && images.length + blobs.length > FREE_IMAGE_LIMIT) {
          setShowPricing(true);
          e.target.value = '';
          return;
        }
        if (blobs.length > 0) await importImages(blobs);
      }

      e.target.value = '';
    },
    [navigate, importImages, isProUser, images.length],
  );

  const handleImportFolder = useCallback(async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const folderName: string = dirHandle.name;
        const blobs: Blob[] = [];

        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            const file: File = await entry.getFile();
            if (file.type.startsWith('image/')) {
              blobs.push(file);
            }
          }
        }

        if (blobs.length > 0) {
          if (!isProUser && images.length + blobs.length > FREE_IMAGE_LIMIT) {
            setShowPricing(true);
            return;
          }
          const folderId = await createFolder(folderName);
          await importImages(blobs, folderId);
        }
      } catch {
        // User cancelled the picker
      }
    } else {
      dirInputRef.current?.click();
    }
  }, [createFolder, importImages, isProUser, images.length]);

  const handleDirSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const blobs = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (blobs.length === 0) {
        e.target.value = '';
        return;
      }

      const firstPath = (files[0] as any).webkitRelativePath as string | undefined;
      const folderName = firstPath ? firstPath.split('/')[0] : 'Imported';

      if (!isProUser && images.length + blobs.length > FREE_IMAGE_LIMIT) {
        setShowPricing(true);
        e.target.value = '';
        return;
      }

      const folderId = await createFolder(folderName);
      await importImages(blobs, folderId);
      e.target.value = '';
    },
    [createFolder, importImages, isProUser, images.length],
  );

  const handleDoubleTap = useCallback(
    (id: string) => navigate('/edit', { state: { imageId: id } }),
    [navigate],
  );

  // --- Multi-select handlers ---

  const handleLongPress = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setDeletingIds(new Set(ids));

    await new Promise((r) => setTimeout(r, 350));

    for (const id of ids) {
      await deleteImage(id);
    }
    setDeletingIds(new Set());
    setSelectedIds(new Set());
  }, [selectedIds, deleteImage]);

  // --- Folder handlers ---

  const handleFolderTap = useCallback(
    (id: string) => {
      setActiveFolderId((prev) => (prev === id ? null : id));
    },
    [],
  );

  const handleFolderLongPress = useCallback(
    (id: string, rect: DOMRect) => {
      const folder = folders.find((f) => f.id === id);
      if (folder) {
        setContextMenu({ folderId: id, folderName: folder.name, rect });
      }
    },
    [folders],
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      await deleteFolder(id);
      if (activeFolderId === id) setActiveFolderId(null);
    },
    [deleteFolder, activeFolderId],
  );

  const handleRenameFolder = useCallback(
    async (id: string, name: string) => {
      await renameFolder(id, name);
      await refreshFolders();
    },
    [renameFolder, refreshFolders],
  );

  const filteredImages = useMemo(() => {
    if (!activeFolderId) return images;
    return images.filter((img) => img.folderId === activeFolderId);
  }, [images, activeFolderId]);

  const greetingFrames = useGreeting(firstName, images.length);

  const enableScrollHide = images.length >= SCROLL_HIDE_THRESHOLD && !selectMode;

  const handleScroll = useCallback(() => {
    if (!enableScrollHide) return;
    setBarsHidden(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setBarsHidden(false), 50);
  }, [enableScrollHide]);

  return (
    <ScreenShell>
      <div className="h-full flex flex-col relative">
        <MasonryGrid
          images={filteredImages}
          onDoubleTap={handleDoubleTap}
          onEmptyDoubleTap={() => fileInputRef.current?.click()}
          onScroll={handleScroll}
          folderTabs={
            folders.length > 0 ? (
              <PhotoFolderTabs
                folders={folders}
                activeFolderId={activeFolderId}
                onFolderTap={handleFolderTap}
                onFolderLongPress={handleFolderLongPress}
              />
            ) : undefined
          }
          selectedIds={selectedIds}
          deletingIds={deletingIds}
          selectMode={selectMode}
          onLongPress={handleLongPress}
          onToggleSelect={handleToggleSelect}
        />

        {/* Header */}
        <div
          className={`absolute top-0 inset-x-0 z-10 fade-down pointer-events-none transition-transform ease-out ${
            !selectMode && barsHidden ? '-translate-y-full duration-500' : 'translate-y-0 duration-300'
          }`}
          style={{ height: 'calc(env(safe-area-inset-top, 0px) + 140px)' }}
        >
          <div className="pointer-events-auto">
            {selectMode ? (
              <ScreenHeader
                left={
                  <div className="flex items-center gap-3">
                    <button onClick={handleClearSelection} className="text-accent p-1">
                      <X size={22} weight="bold" />
                    </button>
                    <span className="text-base font-medium tracking-wider normal-case">
                      {selectedIds.size} Selected
                    </span>
                  </div>
                }
                right={
                  <button onClick={handleBulkDelete} className="text-red-400 p-1">
                    <Trash size={22} weight="fill" />
                  </button>
                }
              />
            ) : (
              <ScreenHeader
                left={<WelcomeGreeting frames={greetingFrames} logoSrc="/logo-solaire.png" />}
                center={
                  <img
                    src="/logo-solaire.png"
                    alt="Solaire"
                    className="hidden md:block object-contain"
                    style={{ height: 46 }}
                  />
                }
                right={
                  <button
                    onClick={() => {
                      if (window.innerWidth >= 768) setShowSettings(true);
                      else navigate('/settings');
                    }}
                    className="text-accent p-1"
                  >
                    <GearSix size={22} weight="fill" />
                  </button>
                }
              />
            )}
          </div>
        </div>

        {/* FAB - hidden in select mode */}
        {!selectMode && (
          <HomeFAB
            onTakePhoto={() => navigate('/camera')}
            onChooseGallery={() => fileInputRef.current?.click()}
            onImportFolder={handleImportFolder}
          />
        )}

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} />
        <input
          ref={dirInputRef}
          type="file"
          accept="image/*"
          onChange={handleDirSelect}
          {...({ webkitdirectory: '', directory: '' } as any)}
        />

        {/* Folder context menu */}
        {contextMenu && (
          <FolderContextMenu
            folderId={contextMenu.folderId}
            folderName={contextMenu.folderName}
            anchorRect={contextMenu.rect}
            onDelete={handleDeleteFolder}
            onRename={handleRenameFolder}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>

      {showSettings && (
        <SettingsDrawer onClose={() => setShowSettings(false)} />
      )}

      <PricingModal open={showPricing} onClose={() => setShowPricing(false)} />
    </ScreenShell>
  );
}
