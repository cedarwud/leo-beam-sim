import type { VisualLabFocus, VisualLabView } from './VisualLabScene';
import {
  VISUAL_LAB_INPUT_GROUPS,
  VISUAL_LAB_RESULT_DOMAINS,
  type LocalizedCopy,
  type VisualLabInputGroupKey,
  type VisualLabLocale,
  type VisualLabResultDomainKey,
} from '../../visualLab/experiment';

export type VisualLabControlModuleKey = 'scene' | VisualLabInputGroupKey;

/**
 * Result-focus compatibility keys.  These are accepted by the result dock
 * and moduleDefinition(), but deliberately do not belong to the visible
 * VISUAL_LAB_MODULES control strip and can never select editable inputs.
 */
export type VisualLabResultModuleKey = 'handover' | 'throughput' | 'ee';

export type VisualLabModuleKey = VisualLabControlModuleKey | VisualLabResultModuleKey;

export interface VisualLabModuleDefinition {
  readonly key: VisualLabModuleKey;
  /** Chinese fallback retained for older shell consumers during migration. */
  readonly label: string;
  readonly shortLabel: string;
  readonly labels: LocalizedCopy;
  readonly shortLabels: LocalizedCopy;
  readonly symbol: string;
  readonly tone: 'scene' | 'handover' | 'sinr' | 'power' | 'throughput' | 'ee';
  readonly view: VisualLabView;
  readonly focus: Exclude<VisualLabFocus, 'none'>;
}

const localized = (zhHant: string, en: string): LocalizedCopy => Object.freeze({ 'zh-Hant': zhHant, en });

function schemaGroup(key: VisualLabInputGroupKey): { readonly label: LocalizedCopy } {
  const group = VISUAL_LAB_INPUT_GROUPS.find((candidate) => candidate.key === key);
  if (group === undefined) throw new Error(`Unknown visual-lab input group: ${key}`);
  return group;
}

function schemaResult(key: VisualLabResultDomainKey): { readonly label: LocalizedCopy } {
  const result = VISUAL_LAB_RESULT_DOMAINS.find((candidate) => candidate.key === key);
  if (result === undefined) throw new Error(`Unknown visual-lab result domain: ${key}`);
  return result;
}

function module(
  key: VisualLabModuleKey,
  labels: LocalizedCopy,
  shortLabels: LocalizedCopy,
  symbol: string,
  tone: VisualLabModuleDefinition['tone'],
  view: VisualLabView,
  focus: Exclude<VisualLabFocus, 'none'>,
): VisualLabModuleDefinition {
  return {
    key,
    label: labels['zh-Hant'],
    shortLabel: shortLabels['zh-Hant'],
    labels,
    shortLabels,
    symbol,
    tone,
    view,
    focus,
  };
}

export const VISUAL_LAB_MODULES: readonly VisualLabModuleDefinition[] = [
  module('scene', localized('場景與軌道資料', 'Scene and orbit data'), localized('場景資料', 'Scene'), 'TLE', 'scene', 'earth', 'geometry'),
  module('sinr', schemaGroup('sinr').label, schemaGroup('sinr').label, 'γ', 'sinr', 'service', 'geometry'),
  module('power', schemaGroup('power').label, schemaGroup('power').label, 'P', 'power', 'service', 'energy'),
] as const;

/**
 * Read-only result identities retained for the right-side result dock.  Keep
 * these definitions out of VISUAL_LAB_MODULES: they are not left-side tabs.
 */
export const VISUAL_LAB_RESULT_MODULES: readonly VisualLabModuleDefinition[] = [
  module('handover', localized('換手', 'Handover'), localized('換手', 'Handover'), 'HO', 'handover', 'service', 'handover'),
  module('throughput', schemaResult('throughput').label, schemaResult('throughput').label, 'R', 'throughput', 'service', 'handover'),
  module('ee', schemaResult('ee').label, schemaResult('ee').label, 'η', 'ee', 'service', 'energy'),
] as const;

export const VISUAL_LAB_MODULE_KEYS = VISUAL_LAB_MODULES.map((module) => module.key);

export function isInputModule(module: VisualLabModuleKey): module is VisualLabInputGroupKey {
  return module === 'sinr' || module === 'power';
}

export function isControlModule(module: VisualLabModuleKey): module is VisualLabControlModuleKey {
  return module === 'scene' || isInputModule(module);
}

export function isResultModule(module: VisualLabModuleKey): module is VisualLabResultModuleKey {
  return module === 'handover' || module === 'throughput' || module === 'ee';
}

export function moduleDefinition(module: VisualLabModuleKey): VisualLabModuleDefinition {
  return VISUAL_LAB_MODULES.find((candidate) => candidate.key === module)
    ?? VISUAL_LAB_RESULT_MODULES.find((candidate) => candidate.key === module)
    ?? VISUAL_LAB_MODULES[0]!;
}

export function moduleLabel(module: VisualLabModuleKey, locale: VisualLabLocale): string {
  return moduleDefinition(module).labels[locale];
}

export function moduleShortLabel(module: VisualLabModuleKey, locale: VisualLabLocale): string {
  return moduleDefinition(module).shortLabels[locale];
}
