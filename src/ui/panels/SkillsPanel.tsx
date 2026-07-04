import { useState } from 'react'
import type { Game, SkillName, Skills } from '../../engine'
import { MAX_LEVEL, SKILL_NAMES, xpForLevel } from '../../engine'
import { SkillIcon } from '../icons/SkillIcon'

function title(skill: SkillName): string {
  return skill.charAt(0).toUpperCase() + skill.slice(1)
}

/**
 * Detail row shown when a skill is tapped/selected. Surfaces the same
 * information as the hover tooltip so it is reachable on touch devices:
 * current (and base, when boosted/drained) level, total xp, and the xp
 * remaining to the next level. Reads live values so it tracks xp gains.
 */
function SkillDetail({ skills, skill }: { skills: Skills; skill: SkillName }) {
  const base = skills.getLevel(skill)
  const current = skills.getCurrentLevel(skill)
  const xp = Math.floor(skills.getXp(skill))
  const atMax = base >= MAX_LEVEL
  const boostClass = current < base ? ' drained' : current > base ? ' boosted' : ''
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
    </div>
  )
}

/**
 * All 23 skills as current/base with an exact-xp tooltip + combat level.
 * Each cell is a button: tapping it toggles a detail row that shows the
 * xp figures without needing a hover tooltip (which touch devices lack).
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
