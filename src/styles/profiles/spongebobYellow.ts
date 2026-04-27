import thinkingSpongebobGif from "../../assets/chat_thinking_spongebob.gif";
import { createBlueStyleProfile } from "./template";

export const spongebobYellowStyle = createBlueStyleProfile({
  id: "spongebob-yellow",
  label: "海绵宝宝-黄",
  description: "海绵宝宝主题风格，明亮黄色主视觉与动画感配色。",
  assistantName: "海绵宝宝",
  mainImage: "/character-options/spongebob-main.png",
  mainImageScale: 1.5,
  mainGlossOpacity: 0.12,
  mainGlossBackground:
    "radial-gradient(circle at 40% 18%, rgba(255, 255, 255, 0.3), rgba(255, 245, 176, 0.16) 48%, rgba(255, 213, 74, 0) 74%)",
  mainImageFilter:
    "saturate(1.06) brightness(1.02) drop-shadow(0 0 9px rgba(232, 186, 25, 0.2)) drop-shadow(0 0 14px rgba(255, 232, 127, 0.26))",
  mainButtonFilter: "none",
  mainButtonHoverFilter: "none",
  mainIdleAnimation: "idle-breathe 2s ease-in-out infinite",
  mainImageIdleAnimation: "none",
  mainGlossAnimation: "none",
  thinkingGif: thinkingSpongebobGif,
  defaultSystemPrompt: "你是海绵宝宝桌面助手，回答时请保持热情、乐观、友好的中文表达，并尽量把建议说得清楚且好执行。",
  tokens: {
    panelBg: "rgba(255, 252, 235, 0.97)",
    panelBorder: "rgba(231, 198, 58, 0.9)",
    titleText: "#aa7a00",
    bodyText: "rgba(116, 79, 4, 0.95)",
    mutedText: "rgba(139, 100, 12, 0.9)",
    menuText: "rgba(127, 90, 6, 0.95)",
    menuBorder: "rgba(229, 198, 70, 0.9)",
    menuBg:
      "radial-gradient(circle at 28% 18%, rgba(255, 255, 255, 0.99), rgba(255, 248, 194, 0.96) 44%, rgba(247, 220, 93, 0.9) 76%, rgba(228, 186, 33, 0.9) 100%)",
    toastBg:
      "radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 1), rgba(255, 244, 181, 0.95) 46%, rgba(240, 203, 60, 0.9) 100%)",
    toastBorder: "rgba(229, 185, 26, 0.94)",
    toastText: "#926700",
    footerBg: "rgba(255, 251, 232, 0.97)",
    footerBorder: "rgba(232, 200, 71, 0.86)",
    expTrackBg: "rgba(235, 205, 84, 0.35)",
    expFillFrom: "rgba(255, 210, 74, 0.95)",
    expFillTo: "rgba(235, 178, 32, 0.95)",
    mpTrackBg: "rgba(144, 209, 248, 0.33)",
    mpFillFrom: "rgba(83, 184, 242, 0.95)",
    mpFillTo: "rgba(30, 140, 214, 0.95)",
  },
});
