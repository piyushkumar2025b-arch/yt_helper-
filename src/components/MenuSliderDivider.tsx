import React, { useState, useEffect, useCallback } from 'react';
import { ThemeId } from '../types';

interface MenuSliderDividerProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onResize: (newWidth: number) => void;
  currentTheme: ThemeId;
}

export const MenuSliderDivider: React.FC<MenuSliderDividerProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  onResize,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = Math.max(240, Math.min(520, e.clientX));
      onResize(newWidth);
    },
    [isDragging, onResize]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      onMouseDown={isSidebarOpen ? handleMouseDown : undefined}
      onDoubleClick={onToggleSidebar}
      onClick={!isSidebarOpen ? onToggleSidebar : undefined}
      className={`relative flex items-center justify-center shrink-0 z-30 select-none transition-colors ${
        isSidebarOpen
          ? 'w-1.5 cursor-col-resize bg-slate-500/10 hover:bg-indigo-500/50'
          : 'w-1.5 cursor-pointer bg-slate-500/10 hover:bg-indigo-500/50'
      } ${isDragging ? 'bg-indigo-500' : ''}`}
      title={
        isSidebarOpen
          ? 'Drag to resize sidebar (Double-click to collapse)'
          : 'Click to expand sidebar'
      }
    >
      <div className="w-0.5 h-10 rounded-full bg-slate-400/30 pointer-events-none" />
    </div>
  );
};
