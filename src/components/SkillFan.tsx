import type { CSSProperties, RefObject } from "react";
import { Droplets, Flame } from "lucide-react";
import { SKILL_FAN_ITEMS, SKILL_MP_COST } from "../constants/app";

type Props = {
  open: boolean;
  skillFanRef: RefObject<HTMLDivElement | null>;
  onCastSkill: (skillLabel: string) => void;
};

export default function SkillFan({ open, skillFanRef, onCastSkill }: Props) {
  if (!open) return null;

  return (
    <div className="skill-fan" onClick={(event) => event.stopPropagation()} ref={skillFanRef}>
      {SKILL_FAN_ITEMS.map((skill) => (
        <button
          key={skill.key}
          type="button"
          className="skill-fan-item"
          style={
            {
              "--offset-x": `${skill.offsetX}px`,
              "--offset-y": `${skill.offsetY}px`,
              "--skill-delay": `${skill.delay}ms`,
            } as CSSProperties
          }
          onClick={() => onCastSkill(skill.label)}
          aria-label={`${skill.label} -${SKILL_MP_COST}MP`}
          title={`${skill.label} -${SKILL_MP_COST}MP`}
        >
          {skill.key === "water" && <Droplets size={12} strokeWidth={2.1} />}
          {skill.key === "fire" && <Flame size={12} strokeWidth={2.1} />}
          <span className="skill-fan-sr">
            {skill.label} -{SKILL_MP_COST}MP
          </span>
        </button>
      ))}
    </div>
  );
}
