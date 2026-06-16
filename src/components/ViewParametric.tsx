interface ViewParametricProps {
  xtExpr: string
  ytExpr: string
}

export function ViewParametric({ xtExpr, ytExpr }: ViewParametricProps) {
  return (
    <div className="view-parametric">
      <div className="parametric-placeholder">
        <p className="parametric-info">
          媒介変数モード — バックエンド実装後に描画されます
        </p>
        <ul className="parametric-exprs">
          <li>
            <span className="fn-label">x(t) =</span>
            <code>{xtExpr || '—'}</code>
          </li>
          <li>
            <span className="fn-label">y(t) =</span>
            <code>{ytExpr || '—'}</code>
          </li>
        </ul>
      </div>
    </div>
  )
}
