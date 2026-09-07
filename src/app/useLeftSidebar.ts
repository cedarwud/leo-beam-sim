import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  getDefaultLeftSidebarTabForMode,
  type InitialRuntimeState,
  type LeftSidebarTab,
} from './appRuntimeModel';

export interface UseLeftSidebarParameters {
  initialRuntime: InitialRuntimeState;
}

export interface UseLeftSidebarResult {
  leftSidebarTab: LeftSidebarTab;
  setLeftSidebarTab: Dispatch<SetStateAction<LeftSidebarTab>>;
  leftSidebarCollapsed: boolean;
  setLeftSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
}

export function useLeftSidebar({ initialRuntime }: UseLeftSidebarParameters): UseLeftSidebarResult {
  const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>(
      () => getDefaultLeftSidebarTabForMode(initialRuntime.handoverMode),
    );
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  return { leftSidebarTab, setLeftSidebarTab, leftSidebarCollapsed, setLeftSidebarCollapsed };
}
