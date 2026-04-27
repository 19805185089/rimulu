import thinkingRimuruGif from "../../assets/chat_thinking_rimuru.gif";
import { createBlueStyleProfile } from "./template";

export const miemieNightStyle = createBlueStyleProfile({
  id: "miemie-night",
  label: "咩咩子-夜",
  description: "咩咩子主题风格，主打暗色鳞甲质感与金紫点缀。",
  assistantName: "咩咩子",
  mainImage: "/character-options/miemie.png",
  mainImageScale: 2.5,
  mainGlossOpacity: 0.06,
  mainGlossBackground:
    "radial-gradient(circle at 38% 18%, rgba(255, 246, 219, 0.2), rgba(212, 176, 110, 0.1) 44%, rgba(76, 44, 98, 0) 72%)",
  mainImageFilter:
    "saturate(1.07) contrast(1.08) brightness(0.95) drop-shadow(0 0 10px rgba(34, 21, 44, 0.4)) drop-shadow(0 0 18px rgba(157, 119, 188, 0.18))",
  mainButtonFilter:
    "drop-shadow(0 10px 18px rgba(30, 18, 42, 0.32)) drop-shadow(0 0 1px rgba(241, 212, 154, 0.66)) drop-shadow(0 0 12px rgba(167, 127, 215, 0.3))",
  mainButtonHoverFilter:
    "drop-shadow(0 14px 24px rgba(30, 18, 42, 0.4)) drop-shadow(0 0 1px rgba(255, 229, 170, 0.78)) drop-shadow(0 0 15px rgba(184, 140, 237, 0.38))",
  mainIdleAnimation: "idle-breathe 2.3s ease-in-out infinite",
  mainImageIdleAnimation: "none",
  mainGlossAnimation: "none",
  thinkingGif: thinkingRimuruGif,
  defaultSystemPrompt:
    "你是咩咩子（灭尽龙娘化），傲娇好战却护短，称呼用户猎人。先角色化回应再给准确信息；怪猎机制与配装按已知共识答，不确定直说，复杂问题先补版本和目标。",
  tokens: {
    panelBg: "rgba(49, 38, 66, 0.93)",
    panelBorder: "rgba(186, 152, 99, 0.84)",
    titleText: "#f5e0b0",
    bodyText: "rgba(251, 245, 233, 0.96)",
    mutedText: "rgba(225, 208, 232, 0.9)",
    menuText: "rgba(248, 231, 191, 0.96)",
    menuBorder: "rgba(195, 160, 105, 0.88)",
    menuBg:
      "radial-gradient(circle at 26% 18%, rgba(110, 86, 136, 0.95), rgba(78, 57, 105, 0.94) 40%, rgba(52, 38, 71, 0.95) 74%, rgba(36, 27, 49, 0.97) 100%)",
    toastBg:
      "radial-gradient(circle at 22% 16%, rgba(132, 103, 162, 0.94), rgba(95, 71, 125, 0.94) 48%, rgba(57, 41, 79, 0.96) 100%)",
    toastBorder: "rgba(208, 172, 113, 0.92)",
    toastText: "#fce9bf",
    footerBg: "rgba(44, 34, 59, 0.93)",
    footerBorder: "rgba(181, 147, 97, 0.82)",
    expTrackBg: "rgba(193, 160, 104, 0.34)",
    expFillFrom: "rgba(255, 220, 145, 0.95)",
    expFillTo: "rgba(214, 166, 85, 0.95)",
    mpTrackBg: "rgba(143, 114, 192, 0.34)",
    mpFillFrom: "rgba(212, 172, 255, 0.94)",
    mpFillTo: "rgba(149, 105, 219, 0.95)",
  },
});
