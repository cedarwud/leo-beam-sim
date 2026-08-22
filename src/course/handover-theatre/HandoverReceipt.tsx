import type { ReactElement } from 'react';

/**
 * The handover receipt.
 *
 * The act's job is to make a handover feel like a DECISION WITH A COST rather
 * than a free transition, so every commit writes a line: what it cost, what it
 * bought, and how long the rule had to hold first.
 */

export interface HandoverReceipt {
  readonly id: string;
  readonly fromName: string;
  readonly toName: string;
  readonly committedAtUtc: string;
  readonly deltaSinrDb: number;
  readonly servingElevationDeg: number;
  readonly candidateElevationDeg: number;
  readonly heldSec: number;
}

export function HandoverReceiptRail({ receipts }: {
  readonly receipts: readonly HandoverReceipt[];
}): ReactElement {
  return (
    <div className="theatre__receipts">
      <span>換手收據</span>
      {receipts.length === 0
        ? <p className="theatre__receipts-empty">還沒有換手。條件成立、而且持續夠久，才會有第一張。</p>
        : receipts.map(receipt => (
          <article key={receipt.id} className="theatre__receipt">
            <header>
              <strong>{receipt.fromName}</strong>
              <em>→</em>
              <strong>{receipt.toName}</strong>
            </header>
            <dl>
              <div><dt>條件持續</dt><dd>{receipt.heldSec} s</dd></div>
              <div><dt>ΔSINR</dt><dd>+{receipt.deltaSinrDb.toFixed(2)} dB</dd></div>
              <div><dt>舊星仰角</dt><dd>{receipt.servingElevationDeg.toFixed(1)}°</dd></div>
              <div><dt>新星仰角</dt><dd>{receipt.candidateElevationDeg.toFixed(1)}°</dd></div>
            </dl>
            <p>
              換手不是免費的：訊令要送、鏈路要重建，中斷的那一小段時間固定功耗照燒。
              每一張收據都是一筆能量帳——Act 5 就是在算這個。
            </p>
            <small>{receipt.committedAtUtc}</small>
          </article>
        ))}
    </div>
  );
}
