import {
  FIXED_ELEVATION_DEG,
  SATELLITE_POSITION,
  UE_GROUND_POSITION,
  calculateAntennaGain,
} from './scientificExplain3DDirector';

interface InspectorProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly thetaDeg: number;
}

export function ScientificExplain3DInspector({
  isOpen,
  onClose,
  thetaDeg,
}: InspectorProps) {
  if (!isOpen) return null;

  const { gainRatio, gainDb } = calculateAntennaGain(thetaDeg);

  return (
    <aside
      className="se3d-inspector-drawer is-open"
      role="dialog"
      aria-label="幾何與公式詳細推導檢視器"
      aria-modal="true"
      data-testid="se3d-inspector-drawer"
    >
      <div className="se3d-inspector-header">
        <div>
          <span className="se3d-inspector-eyebrow">PHYSICAL & RF INSPECTOR</span>
          <h2>物理幾何與天線增益推導</h2>
        </div>
        <button
          type="button"
          className="se3d-inspector-close-btn"
          onClick={onClose}
          aria-label="關閉詳細檢視抽屜"
          data-testid="se3d-inspector-close"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      <div className="se3d-inspector-content">
        <section className="se3d-inspector-card">
          <h3>01 · 空間角度定義與頂點分離</h3>
          <p>
            <b>仰角 α (Elevation angle)：</b>頂點在地面用戶 (UE)，為用戶至衛星視線 (LOS) 與地平面切線之間的夾角。
            只要衛星與用戶空間位置未變，無論鏡頭如何旋轉或波束如何轉向，<strong>仰角 α 恆為常數 ({FIXED_ELEVATION_DEG.toFixed(1)}°)</strong>。
          </p>
          <p>
            <b>離軸角 θ (Off-axis angle)：</b>頂點在衛星天線相位中心，為波束中軸指向向量 b̂ 與用戶視線向量 û 之空間夾角：
          </p>
          <div className="se3d-inspector-formula">
            <code>θ = arccos(b̂ · û)</code>
          </div>
        </section>

        <section className="se3d-inspector-card">
          <h3>02 · 天線增益衰減函數</h3>
          <p>
            根據標準高斯／貝索常態化波束增益模型，天線發射增益隨著離軸角 $\theta$ 偏離中心而迅速下降：
          </p>
          <div className="se3d-inspector-formula">
            <code>G(&theta;) / G<sub>0</sub> = exp(&minus;0.18 &middot; &theta;<sup>2</sup>)</code>
          </div>
          <div className="se3d-inspector-formula">
            <code>G<sub>dB</sub>(&theta;) = 10 &middot; log<sub>10</sub>(G(&theta;) / G<sub>0</sub>) &approx; &minus;0.782 &middot; &theta;<sup>2</sup> dB</code>
          </div>
        </section>

        <section className="se3d-inspector-card">
          <h3>03 · 當前幾何與數值狀態</h3>
          <dl className="se3d-inspector-dl">
            <div>
              <dt>離軸角 &theta;</dt>
              <dd>{thetaDeg.toFixed(2)}&deg;</dd>
            </div>
            <div>
              <dt>地面仰角 &alpha;</dt>
              <dd>{FIXED_ELEVATION_DEG.toFixed(2)}&deg; (固定)</dd>
            </div>
            <div>
              <dt>天線相對增益比 G(&theta;)/G<sub>0</sub></dt>
              <dd>{gainRatio.toFixed(4)}</dd>
            </div>
            <div>
              <dt>天線增益差值 G<sub>dB</sub></dt>
              <dd>{gainDb.toFixed(2)} dB</dd>
            </div>
            <div>
              <dt>衛星位置 (X, Y, Z)</dt>
              <dd>[{SATELLITE_POSITION.join(', ')}]</dd>
            </div>
            <div>
              <dt>用戶位置 (X, Y, Z)</dt>
              <dd>[{UE_GROUND_POSITION.join(', ')}]</dd>
            </div>
          </dl>
        </section>
      </div>
    </aside>
  );
}
