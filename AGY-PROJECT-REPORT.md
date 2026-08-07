# Project Report

## Summary
The non-EE classroom reset slice was successfully completed, adding a dedicated "Restart measurement" / "重新開始量測" control to the `TeachingEnergyCard` to clear the measurement window without affecting experimental parameters or EE scientific semantics.

## Changed Files
1. `src/App.tsx`: Introduced a separate `teachingEnergyExplicitEpoch` state. The `handleTeachingEnergyReset` callback explicitly resets `energyLedgerRef.current = EMPTY_ENERGY_LEDGER` and `energyLedgerSampleWallMsRef.current = null`, then increments this epoch to trigger a refresh via the `teachingEnergy` memo without conflating it into the pure configuration-identity key `energyLedgerResetKey`.
2. `src/ui/InfoPanel.tsx`: Added `onTeachingEnergyReset` prop and passed it to `TeachingEnergyCard`.
3. `src/ui/info-panel/TeachingEnergyCard.tsx`: Added a reset button alongside the `GroupHeading` and integrated the `PanelHelp` helper text tooltip next to it, matching existing UI patterns and tokens.
4. `src/i18n/strings.ts`: Added localization keys for the reset label and helper text (`panel.energy.reset.label`, `panel.energy.reset.help`) for both `zh-TW` and `en` locales.
5. `src/ui/info-panel/TeachingEnergyCard.test.tsx`: Removed dead callback-test code (SSR does not test clicks). Imported exported locale dictionaries to directly verify exact helper strings. The automated test boundary is limited to statically rendered HTML elements and localized strings, leaving callback execution wiring to type-checking and manual source review.

## Verifications & Tests Run
- `node --import tsx/esm --test src/teaching/energyLedger.test.ts`: Passed (48 tests). Confirms the underlying ledger logic was undisturbed.
- `node --import tsx/esm --test src/ui/info-panel/TeachingEnergyCard.test.tsx`: Passed (1 test). Verifies localized labels and test selector.
- `npm run lint`: Passed with no errors.
- `npm run build`: Passed, demonstrating a successful build in the Vite environment.

## Blockers
None. Controller feedback was integrated, establishing purer reset semantics and true test boundaries.
