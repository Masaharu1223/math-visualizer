interface ControlsProps {
  playing: boolean
  onTogglePlay: () => void
  speed: number
  onSpeedChange: (s: number) => void
  x: number
  onXChange: (x: number) => void
  xRange: [number, number]
  onResetView?: () => void
}

const SPEEDS = [0.25, 0.5, 1, 2, 4]

export function Controls({
  playing,
  onTogglePlay,
  speed,
  onSpeedChange,
  x,
  onXChange,
  xRange,
  onResetView,
}: ControlsProps) {
  const [min, max] = xRange
  return (
    <div className="controls">
      <button className="play-btn" onClick={onTogglePlay} title={playing ? '停止' : '再生'}>
        {playing ? '⏸' : '▶'}
      </button>
      <label className="control-item">
        速度
        <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </label>
      <label className="control-item x-slider">
        <span className="x-readout">x = {x.toFixed(2)}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={(max - min) / 500}
          value={x}
          onChange={(e) => onXChange(Number(e.target.value))}
        />
      </label>
      {onResetView && (
        <button className="ghost-btn" onClick={onResetView}>
          表示範囲をリセット
        </button>
      )}
    </div>
  )
}
