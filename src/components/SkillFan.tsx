import type { CSSProperties, RefObject } from "react";
import { Droplets, Flame, X } from "lucide-react";
import { MEMO_BOOST, SKILL_FAN_ITEMS, SKILL_MP_COST } from "../constants/app";

type Props = {
  open: boolean;
  skillFanRef: RefObject<HTMLDivElement | null>;
  position: { x: number; y: number };
  onHeaderMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  onClose: () => void;
  onCastSkill: (skillLabel: string) => void;
};

export default function SkillFan({ open, skillFanRef, position, onHeaderMouseDown, onClose, onCastSkill }: Props) {
  if (!open) return null;

  return (
    <div
      className="skill-fan"
      onClick={(event) => event.stopPropagation()}
      ref={skillFanRef}
      style={
        {
          left: `${position.x}px`,
          top: `${position.y}px`,
          "--memo-boost": `${MEMO_BOOST}`,
        } as CSSProperties
      }
    >
      <header className="skill-panel-header" onMouseDown={onHeaderMouseDown}>
        <span className="skill-panel-title">技能</span>
        <button type="button" className="memo-top-btn" onClick={onClose} aria-label="关闭技能菜单" title="关闭技能菜单">
          <X size={9} strokeWidth={2.2} />
        </button>
      </header>
      <div className="skill-panel-list">
      {SKILL_FAN_ITEMS.map((skill) => (
        <button
          key={skill.key}
          type="button"
          className="skill-fan-item"
          onClick={() => onCastSkill(skill.label)}
          aria-label={`${skill.label} -${SKILL_MP_COST}MP`}
          title={`${skill.label} -${SKILL_MP_COST}MP`}
        >
          <span className={`skill-fan-icon skill-fan-icon-${skill.key}`}>
            {skill.key === "water" && <Droplets size={12} strokeWidth={2.1} />}
            {skill.key === "fire" && <Flame size={12} strokeWidth={2.1} />}
          </span>
          <span className="skill-fan-label">{skill.label}</span>
          <span className="skill-fan-cost">-{SKILL_MP_COST} MP</span>
        </button>
      ))}
      </div>
    </div>
  );
}
