import { useState, type ReactElement } from 'react';

export type ShellChromeKey = 'leftSidebar' | 'rightSidebar' | 'topControls' | 'timeline' | 'sceneOverlay';

export interface ShellChromeVisibility {
  readonly leftSidebar: boolean;
  readonly rightSidebar: boolean;
  readonly topControls: boolean;
  readonly timeline: boolean;
  readonly sceneOverlay: boolean;
}

export const DEFAULT_SHELL_CHROME_VISIBILITY: ShellChromeVisibility = {
  leftSidebar: true,
  rightSidebar: true,
  topControls: true,
  timeline: true,
  sceneOverlay: true,
};

interface ShellChromeControlsProps {
  readonly visibility: ShellChromeVisibility;
  readonly onToggle: (key: ShellChromeKey) => void;
  readonly onShowAll: () => void;
  readonly onHideAll: () => void;
}

const OPTIONS: ReadonlyArray<{
  readonly key: ShellChromeKey;
  readonly label: string;
  readonly description: string;
}> = [
  { key: 'leftSidebar', label: '左側欄', description: '輸入與教學內容' },
  { key: 'rightSidebar', label: '右側欄', description: '即時數值與狀態' },
  { key: 'topControls', label: '頂部控制', description: '顯示、語言與頁面工具' },
  { key: 'timeline', label: '底部時間軸', description: '播放、速度與拖曳' },
  { key: 'sceneOverlay', label: '場景疊圖', description: '換手解說、字幕與收據' },
];

export function ShellChromeControls({
  visibility,
  onToggle,
  onShowAll,
  onHideAll,
}: ShellChromeControlsProps): ReactElement {
  const [open, setOpen] = useState(false);
  const allVisible = OPTIONS.every(option => visibility[option.key]);
  const hiddenCount = OPTIONS.filter(option => !visibility[option.key]).length;

  return (
    <div className="leo-shell-chrome-controls" data-testid="shell-chrome-controls">
      <button
        type="button"
        className="leo-shell-chrome-controls__toggle"
        data-testid="shell-chrome-controls-toggle"
        aria-expanded={open}
        aria-controls="shell-chrome-controls-panel"
        aria-label="開啟畫面顯示控制"
        title="顯示或隱藏畫面功能"
        onClick={() => setOpen(value => !value)}
      >
        <span aria-hidden="true">☷</span>
        <span>{hiddenCount === 0 ? '介面' : `顯示介面 · ${hiddenCount}`}</span>
      </button>

      {!open ? null : (
        <div
          id="shell-chrome-controls-panel"
          className="leo-shell-chrome-controls__panel"
          role="group"
          aria-label="畫面顯示控制"
        >
          <div className="leo-shell-chrome-controls__heading">
            <strong>畫面顯示</strong>
            <span>{allVisible ? '完整介面' : '舞台模式可隨時恢復'}</span>
          </div>
          <div className="leo-shell-chrome-controls__options">
            {OPTIONS.map(option => {
              const visible = visibility[option.key];
              return (
                <button
                  key={option.key}
                  type="button"
                  className="leo-shell-chrome-controls__option"
                  data-testid={`shell-chrome-toggle-${option.key}`}
                  aria-pressed={visible}
                  onClick={() => onToggle(option.key)}
                >
                  <span
                    className="leo-shell-chrome-controls__indicator"
                    aria-hidden="true"
                  >
                    {visible ? '●' : '○'}
                  </span>
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="leo-shell-chrome-controls__actions">
            <button type="button" onClick={onShowAll}>全部顯示</button>
            <button type="button" onClick={onHideAll}>只留舞台</button>
          </div>
        </div>
      )}
    </div>
  );
}
