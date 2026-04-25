import type { CSSProperties, RefObject } from "react";
import { Check, FileText, MessageCircle, Settings, Zap } from "lucide-react";
import { MENU_ITEMS, MENU_ORBIT_RADIUS } from "../constants/app";

type Props = {
  menuOpen: boolean;
  pressedMenuKey: string | null;
  setPressedMenuKey: (key: string | null) => void;
  menuRingRef: RefObject<HTMLDivElement | null>;
  onCheckin: () => void;
  onToggleSkills: () => void;
  onOpenMemo: () => void;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  onFallbackClick: (label: string) => void;
};

export default function MenuRing({
  menuOpen,
  pressedMenuKey,
  setPressedMenuKey,
  menuRingRef,
  onCheckin,
  onToggleSkills,
  onOpenMemo,
  onOpenChat,
  onOpenSettings,
  onFallbackClick,
}: Props) {
  return (
    <div className={`menu-ring ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen} ref={menuRingRef}>
      {MENU_ITEMS.map((item, index) => {
        const radians = (item.angle * Math.PI) / 180;
        const x = Math.cos(radians) * MENU_ORBIT_RADIUS;
        const y = Math.sin(radians) * MENU_ORBIT_RADIUS;
        return (
          <button
            key={item.key}
            className={`menu-item ${pressedMenuKey === item.key ? "is-pressed" : ""}`}
            style={
              {
                transform: `translate(${x}px, ${y}px)`,
                transitionDelay: `${index * 24}ms`,
              } as CSSProperties
            }
            onMouseDown={(event) => {
              event.stopPropagation();
              setPressedMenuKey(item.key);
            }}
            onMouseUp={() => setPressedMenuKey(null)}
            onMouseLeave={() => setPressedMenuKey(null)}
            onBlur={() => setPressedMenuKey(null)}
            onClick={(event) => {
              event.stopPropagation();
              if (item.key === "checkin") {
                onCheckin();
                return;
              }
              if (item.key === "skills") {
                onToggleSkills();
                return;
              }
              if (item.key === "memo") {
                onOpenMemo();
                return;
              }
              if (item.key === "chat") {
                onOpenChat();
                return;
              }
              if (item.key === "settings") {
                onOpenSettings();
                return;
              }
              onFallbackClick(item.label);
            }}
            aria-label={item.label}
            title={item.label}
          >
            {item.key === "checkin" && <Check className="menu-item-icon" size={22} strokeWidth={2.3} />}
            {item.key === "skills" && <Zap className="menu-item-icon" size={22} strokeWidth={2.3} />}
            {item.key === "memo" && <FileText className="menu-item-icon" size={22} strokeWidth={2.2} />}
            {item.key === "chat" && <MessageCircle className="menu-item-icon" size={22} strokeWidth={2.2} />}
            {item.key === "settings" && <Settings className="menu-item-icon" size={22} strokeWidth={2.2} />}
            <span className="menu-item-sr">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
