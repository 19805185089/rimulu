import { useMemo, type CSSProperties } from "react";
import type { PetState } from "../types/app";
import type { HatchPetConfig } from "../styles/profiles";

type Props = {
  state: PetState;
  config: HatchPetConfig;
  className?: string;
  ariaLabel: string;
};

const DEFAULT_COLUMNS = 8;
const DEFAULT_ROWS = 9;
const DEFAULT_CELL_WIDTH = 192;
const DEFAULT_CELL_HEIGHT = 208;
const DEFAULT_FRAME_DURATION = 120;
const DEFAULT_ANIMATIONS: Partial<Record<PetState, { row: number; frames: number; durations: number[] }>> = {
  idle: { row: 0, frames: 6, durations: [280, 110, 110, 140, 140, 320] },
  "running-right": { row: 1, frames: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  "running-left": { row: 2, frames: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  hover: { row: 6, frames: 6, durations: [150, 150, 150, 150, 150, 260] },
  active: { row: 6, frames: 6, durations: [150, 150, 150, 150, 150, 260] },
  processing: { row: 7, frames: 6, durations: [120, 120, 120, 120, 120, 220] },
};

export default function HatchPetSprite({ state, config, className, ariaLabel }: Props) {
  const columns = config.columns ?? DEFAULT_COLUMNS;
  const rows = config.rows ?? DEFAULT_ROWS;
  const cellWidth = config.cellWidth ?? DEFAULT_CELL_WIDTH;
  const cellHeight = config.cellHeight ?? DEFAULT_CELL_HEIGHT;
  const animation = config.animations?.[state] ?? DEFAULT_ANIMATIONS[state] ?? config.animations?.idle ?? DEFAULT_ANIMATIONS.idle ?? { row: 0 };
  const frameCount = Math.min(animation.frames ?? columns, columns);
  const durations = useMemo(
    () =>
      Array.from(
        { length: frameCount },
        (_, index) => animation.durations?.[index] ?? animation.durations?.[0] ?? DEFAULT_FRAME_DURATION,
      ),
    [animation.durations, frameCount],
  );
  const animationDuration = durations.reduce((total, duration) => total + duration, 0);

  const spriteStyle = {
    backgroundImage: `url("${config.spritesheet}")`,
    backgroundSize: `${columns * cellWidth}px ${rows * cellHeight}px`,
    backgroundPosition: `0px -${animation.row * cellHeight}px`,
    width: `${cellWidth}px`,
    height: `${cellHeight}px`,
    "--hatch-frame-count": frameCount,
    "--hatch-frame-width": `${cellWidth}px`,
    "--hatch-row-y": `-${animation.row * cellHeight}px`,
    "--hatch-animation-duration": `${animationDuration}ms`,
  } as CSSProperties;

  return (
    <div className={className} role="img" aria-label={ariaLabel} title={config.displayName}>
      <span key={`${state}-${animation.row}-${frameCount}`} className="hatch-pet-frame" style={spriteStyle} aria-hidden="true" />
    </div>
  );
}
