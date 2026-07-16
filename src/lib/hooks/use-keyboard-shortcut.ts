import { useEffect } from 'react';

export function useKeyboardShortcut(
  keys: string[],
  callback: (e: KeyboardEvent) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (keys.includes('cmd+n') && ctrlOrCmd && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        callback(e);
      }
      if (keys.includes('/') && e.key === '/' && !ctrlOrCmd) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          callback(e);
        }
      }
      if (keys.includes('cmd+k') && ctrlOrCmd && e.key === 'k') {
        e.preventDefault();
        callback(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keys, callback, enabled]);
}