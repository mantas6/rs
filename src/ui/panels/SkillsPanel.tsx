import { useState } from 'react'
import { skillGuides } from '../../content/guide'
import type { Game, SkillName, Skills } from '../../engine'
import { getItemDef, MAX_LEVEL, SKILL_NAMES, xpForLevel } from '../../engine'
import { ItemIcon } from '../icons/ItemIcon'
import { SkillIcon } from '../icons/SkillIcon'

function title(skill: SkillName): string {
  return skill.charAt(0).toUpperCase() + skill.slice(1)
}

/**
 * Detail shown when a skill is tapped/selected. Surfaces the xp figures
 * (reachable on touch, unlike the hover tooltip) — current (and base, when
 * boosted/drained) level, total xp, xp to the next level — AND that skill's
 * training guide: how to train it, the items involved, and where to obtain
 * them. Stats read live engine state; guide text comes from content/guide.ts.
 */
function SkillDetail({ skills, skill }: { skills: Skills; skill: SkillName }) {
  const base = skills.getLevel(skill)
  const current = skills.getCurrentLevel(skill)
  const xp = Math.floor(skills.getXp(skill))
  const atMax = base >= MAX_LEVEL
  const boostClass = current < base ? ' drained' : current > base ? ' boosted' : ''
  const entry = skillGuides[skill]
  return (
    <div className="skill-detail" role="status" aria-live="polite">
      <div className="skill-detail-head">
        <SkillIcon skill={skill} />
        <span className="skill-detail-name">{title(skill)}</span>
      </div>
      <dl className="skill-detail-stats">
        <div className="skill-detail-stat">
          <dt>Level</dt>
          <dd className={`skill-detail-value${boostClass}`}>
            {current === base ? base : `${current} / ${base}`}
          </dd>
        </div>
        <div className="skill-detail-stat">
          <dt>XP</dt>
          <dd className="skill-detail-value">{xp.toLocaleString()}</dd>
        </div>
        <div className="skill-detail-stat">
          <dt>{atMax ? 'Next level' : `To level ${base + 1}`}</dt>
          <dd className="skill-detail-value">
            {atMax ? 'Max level' : `${(xpForLevel(base + 1) - xp).toLocaleString()} xp`}
          </dd>
        </div>
      </dl>
      <div className="skill-guide">
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
    </div>
  )
}

/**
 * All 23 skills as current/base with an exact-xp tooltip + combat level.
 * Each cell is a button: tapping it toggles a detail that shows the xp
 * figures and that skill's training guide (works on touch, where hover
 * tooltips don't). The guide lives here rather than in a separate tab.
 */
export function SkillsPanel({ game }: { game: Game }) {
  const skills = game.player.skills
  const [selected, setSelected] = useState<SkillName | null>(null)
  return (
    <div className="skills-panel">
      <div className="skills-grid">
        {SKILL_NAMES.map((skill) => {
          const base = skills.getLevel(skill)
          const current = skills.getCurrentLevel(skill)
          const xp = Math.floor(skills.getXp(skill))
          const tooltip =
            base >= MAX_LEVEL
              ? `${title(skill)}: ${xp.toLocaleString()} xp (max level)`
              : `${title(skill)}: ${xp.toLocaleString()} xp — ` +
                `${(xpForLevel(base + 1) - xp).toLocaleString()} xp to level ${base + 1}`
          const isSelected = selected === skill
          return (
            <button
              type="button"
              key={skill}
              className={`skill-cell${isSelected ? ' selected' : ''}`}
              title={tooltip}
              aria-pressed={isSelected}
              aria-label={tooltip}
              onClick={() => setSelected(isSelected ? null : skill)}
            >
              <span className="skill-label">
                <SkillIcon skill={skill} />
                <span className="skill-name">{title(skill)}</span>
              </span>
              <span className={`skill-level${current < base ? ' drained' : ''}`}>
                {current}/{base}
              </span>
            </button>
          )
        })}
      </div>
      {selected !== null && <SkillDetail skills={skills} skill={selected} />}
      <div className="combat-level">Combat level: {skills.combatLevel()}</div>
    </div>
  )
}
