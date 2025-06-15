import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function useThumbnails(imageList) {
  const [thumbnails, setThumbnails] = useState({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    if (!imageList || imageList.length === 0) {
      setThumbnails({});
      setLoading(false);
      setProgress({ completed: 0, total: 0 });
      return;
    }

    let unlistenThumbs;
    let unlistenComplete;
    let unlistenProgress;

    const setupListenersAndInvoke = async () => {
      setLoading(true);
      setThumbnails({});
      setProgress({ completed: 0, total: imageList.length });

      unlistenThumbs = await listen('thumbnail-generated', (event) => {
        const { path, data } = event.payload;
        setThumbnails(prev => ({ ...prev, [path]: data }));
      });

      unlistenProgress = await listen('thumbnail-progress', (event) => {
        const { completed, total } = event.payload;
        setProgress({ completed, total });
      });

      unlistenComplete = await listen('thumbnail-generation-complete', () => {
        setLoading(false);
      });

      try {
        await invoke('generate_thumbnails_progressive', { paths: imageList });
      } catch (error) {
        console.error("Failed to invoke thumbnail generation:", error);
        setLoading(false);
      }
    };

    setupListenersAndInvoke();

    return () => {
      if (unlistenThumbs) unlistenThumbs();
      if (unlistenComplete) unlistenComplete();
      if (unlistenProgress) unlistenProgress();
    };
  }, [imageList]);

  return { thumbnails, loading, progress };
}