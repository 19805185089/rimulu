import thinkingPatrickGif from "../../assets/chat_thinking_patrick.gif";
import { createBlueStyleProfile } from "./template";

export const patrickPinkStyle = createBlueStyleProfile({
  id: "patrick-pink",
  label: "派大星-粉",
  description: "派大星主题风格，粉色主视觉与轻松活泼的界面氛围。",
  assistantName: "派大星",
  mainImage: "/character-options/patrick-main.png",
  mainImageScale: 1.5,
  mainGlossOpacity: 0.08,
  mainGlossBackground:
    "radial-gradient(circle at 44% 20%, rgba(255, 255, 255, 0.24), rgba(255, 215, 232, 0.12) 50%, rgba(255, 155, 190, 0) 76%)",
  mainImageFilter:
    "saturate(1.05) brightness(1.02) drop-shadow(0 0 8px rgba(255, 132, 170, 0.18)) drop-shadow(0 0 12px rgba(255, 190, 214, 0.22))",
  mainButtonFilter: "none",
  mainButtonHoverFilter: "none",
  mainIdleAnimation: "idle-breathe 2.2s ease-in-out infinite",
  mainImageIdleAnimation: "none",
  mainGlossAnimation: "none",
  thinkingGif: thinkingPatrickGif,
  defaultSystemPrompt: "你是派大星桌面助手，回答时请保持轻松、友好、直白的中文表达，并优先给出简单可执行的建议。",
  tokens: {
    panelBg: "rgba(255, 246, 250, 0.97)",
    panelBorder: "rgba(244, 169, 198, 0.9)",
    titleText: "#be4f7e",
    bodyText: "rgba(120, 50, 84, 0.95)",
    mutedText: "rgba(142, 74, 106, 0.9)",
    menuText: "rgba(131, 56, 92, 0.95)",
    menuBorder: "rgba(242, 175, 205, 0.9)",
    menuBg:
      "radial-gradient(circle at 28% 18%, rgba(255, 255, 255, 0.99), rgba(255, 231, 241, 0.96) 42%, rgba(255, 187, 214, 0.9) 76%, rgba(245, 143, 183, 0.88) 100%)",
    toastBg:
      "radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 1), rgba(255, 226, 239, 0.95) 46%, rgba(245, 154, 193, 0.88) 100%)",
    toastBorder: "rgba(241, 148, 189, 0.93)",
    toastText: "#ad3f72",
    footerBg: "rgba(255, 244, 249, 0.97)",
    footerBorder: "rgba(241, 166, 197, 0.86)",
    expTrackBg: "rgba(247, 177, 206, 0.34)",
    expFillFrom: "rgba(253, 140, 188, 0.94)",
    expFillTo: "rgba(233, 97, 161, 0.95)",
    mpTrackBg: "rgba(201, 233, 146, 0.34)",
    mpFillFrom: "rgba(181, 222, 96, 0.94)",
    mpFillTo: "rgba(137, 189, 55, 0.95)",
  },
});
