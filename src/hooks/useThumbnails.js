import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function useThumbnails(imageList) {
  const [thumbnails, setThumbnails] = useState({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    // If there are no images, reset the state and do nothing.
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
      // Start loading and clear any previous thumbnails
      setLoading(true);
      setThumbnails({});
      setProgress({ completed: 0, total: imageList.length });

      // 1. Listen for individual thumbnail generation events
      unlistenThumbs = await listen('thumbnail-generated', (event) => {
        const { path, data } = event.payload;
        setThumbnails(prev => ({ ...prev, [path]: data }));
      });

      // 2. Listen for progress updates
      unlistenProgress = await listen('thumbnail-progress', (event) => {
        const { completed, total } = event.payload;
        setProgress({ completed, total });
      });

      // 3. Listen for the completion event to stop the loading indicator
      unlistenComplete = await listen('thumbnail-generation-complete', () => {
        setLoading(false);
      });

      // 4. Invoke the backend command (use the progressive version)
      try {
        await invoke('generate_thumbnails_progressive', { paths: imageList });
      } catch (error) {
        console.error("Failed to invoke thumbnail generation:", error);
        setLoading(false);
      }
    };

    setupListenersAndInvoke();

    // Cleanup function
    return () => {
      if (unlistenThumbs) unlistenThumbs();
      if (unlistenComplete) unlistenComplete();
      if (unlistenProgress) unlistenProgress();
    };
  }, [imageList]);

  return { thumbnails, loading, progress };
}