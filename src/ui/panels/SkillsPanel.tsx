import type { Game, SkillName } from '../../engine'
import { MAX_LEVEL, SKILL_NAMES, xpForLevel } from '../../engine'

function title(skill: SkillName): string {
  return skill.charAt(0).toUpperCase() + skill.slice(1)
}

/** All 23 skills as current/base with an exact-xp tooltip + combat level. */
export function SkillsPanel({ game }: { game: Game }) {
  const skills = game.player.skills
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
          return (
            <div key={skill} className="skill-cell" title={tooltip}>
              <span className="skill-name">{title(skill)}</span>
              <span className={`skill-level${current < base ? ' drained' : ''}`}>
                {current}/{base}
              </span>
            </div>
          )
        })}
      </div>
      <div className="combat-level">Combat level: {skills.combatLevel()}</div>
    </div>
  )
}
