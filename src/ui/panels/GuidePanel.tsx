import { useState } from 'react'
import { skillGuides } from '../../content/guide'
import type { Game, SkillName } from '../../engine'
import { getItemDef, SKILL_NAMES } from '../../engine'
import { ItemIcon } from '../icons/ItemIcon'
import { SkillIcon } from '../icons/SkillIcon'

function title(skill: SkillName): string {
  return skill.charAt(0).toUpperCase() + skill.slice(1)
}

/**
 * Read-only training guide, one collapsible section per skill. Each section
 * shows the skill's current base level, a summary, ordered progression steps
 * (with level and the items involved) and notes on where/how to obtain
 * things. All content comes from src/content/guide.ts; this panel only reads
 * engine state (never mutates it) and renders. Tapping a header toggles it,
 * which keeps the list compact and scrollable on small touch screens.
 */
export function GuidePanel({ game }: { game: Game }) {
  const skills = game.player.skills
  const [open, setOpen] = useState<SkillName | null>(null)

  return (
    <div className="guide-panel">
      <p className="guide-intro">
        How to train each skill, the items involved, and where to obtain them.
      </p>
      <div className="guide-list">
        {SKILL_NAMES.map((skill) => {
          const entry = skillGuides[skill]
          const isOpen = open === skill
          const level = skills.getLevel(skill)
          return (
            <div key={skill} className={`guide-skill${entry.trainable ? '' : ' locked'}`}>
              <button
                type="button"
                className="guide-skill-head"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : skill)}
              >
                <span className="guide-skill-name">
                  <SkillIcon skill={skill} />
                  {title(skill)}
                </span>
                <span className="guide-skill-meta">
                  <span className="guide-skill-level">Lv {level}</span>
                  <span className="guide-skill-caret" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="guide-skill-body">
                  <p className="guide-summary">{entry.summary}</p>
                  {entry.steps.length > 0 && (
                    <ol className="guide-steps">
                      {entry.steps.map((step, index) => (
                        <li key={index} className="guide-step">
                          <div className="guide-step-head">
                            <span className="guide-step-level">Lv {step.level}</span>
                            <span className="guide-step-action">{step.action}</span>
                          </div>
                          {step.itemIds && step.itemIds.length > 0 && (
                            <div className="guide-step-items">
                              {step.itemIds.map((itemId) => (
                                <span key={itemId} className="guide-item" title={getItemDef(itemId).name}>
                                  <ItemIcon itemId={itemId} />
                                  {getItemDef(itemId).name}
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                  {entry.notes.length > 0 && (
                    <ul className="guide-notes">
                      {entry.notes.map((note, index) => (
                        <li key={index} className="guide-note">
                          {note}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
