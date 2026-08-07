import { useState } from 'react';
import type { ExperimentRecord } from '../../teaching';

export interface ExperimentRecordCardProps {
  record: ExperimentRecord | null;
}

export function ExperimentRecordCard({ record }: ExperimentRecordCardProps) {
  const [downloading, setDownloading] = useState(false);

  if (!record) {
    return null;
  }

  const handleDownload = () => {
    setDownloading(true);
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(record, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `experiment-record-${record.experimentId || 'unknown'}-${record.windowId || 'unknown'}.json`);
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="leo-info-panel__card" style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--leo-surface-subtle)', borderRadius: '8px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--leo-text-primary)' }}>實驗紀錄</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--leo-text-secondary)', marginBottom: '16px' }}>
        <div>實驗 ID: {record.experimentId}</div>
        <div>情境: {record.scenarioIdentity}</div>
        <div>窗口 ID: {record.windowId}</div>
        <div>窗口時間: {record.windowStartSec} - {record.windowEndSec}s</div>
      </div>
      
      <button 
        onClick={handleDownload}
        disabled={downloading}
        style={{
          width: '100%',
          padding: '8px',
          backgroundColor: 'var(--leo-accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        下載 JSON 紀錄
      </button>
    </div>
  );
}
