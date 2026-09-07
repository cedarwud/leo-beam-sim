import { LocaleProvider, LocaleToggle } from '../i18n';

export function GlobalLocaleToggleSlot() {
  return (
<div
        data-testid="global-locale-toggle-slot"
        style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}
      >
        <LocaleToggle />
      </div>
  );
}
