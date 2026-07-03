// Reusable right-click context menu: a fixed-position option list over a
// full-screen overlay that closes the menu on any outside click.

export interface MenuOption {
  label: string
  onClick: () => void
}

export interface MenuState {
  x: number
  y: number
  options: MenuOption[]
}

export function ContextMenu({
  menu,
  onClose,
}: {
  menu: MenuState
  onClose: () => void
}) {
  return (
    <div
      className="context-menu-overlay"
      onMouseDown={onClose}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <ul
        className="context-menu"
        style={{ left: menu.x, top: menu.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <li className="context-menu-title">Choose Option</li>
        {menu.options.map((option, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => {
                option.onClick()
                onClose()
              }}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
