import thinkingDoraemonGif from "../../assets/chat_thinking_doraemon.gif";
import { createBlueStyleProfile } from "./template";

export const doraemonBlueStyle = createBlueStyleProfile({
  id: "doraemon-blue",
  label: "哆啦A梦-蓝",
  description: "哆啦A梦主题风格，保留通用交互与蓝色清爽视觉。",
  assistantName: "哆啦A梦",
  mainImage: "/doraemon.png",
  mainImageScale: 1.5,
  mainGlossOpacity: 0.14,
  mainGlossBackground:
    "radial-gradient(circle at 42% 22%, rgba(255, 255, 255, 0.24), rgba(205, 236, 255, 0.12) 48%, rgba(0, 162, 232, 0) 74%)",
  mainImageFilter:
    "saturate(1.04) brightness(1.01) drop-shadow(0 0 8px rgba(0, 142, 220, 0.16)) drop-shadow(0 0 14px rgba(132, 210, 248, 0.2))",
  mainButtonFilter: "none",
  mainButtonHoverFilter: "none",
  mainIdleAnimation: "doraemon-idle-sway 8s ease-in-out infinite",
  mainImageIdleAnimation: "none",
  mainGlossAnimation: "none",
  thinkingGif: thinkingDoraemonGif,
  defaultSystemPrompt: "你是哆啦A梦桌面助手，在回答时请保持友好、简洁、明确的中文表达风格，并尽量给出可执行建议。",
  tokens: {
    panelBg: "rgba(245, 252, 255, 0.97)",
    panelBorder: "rgba(34, 156, 227, 0.92)",
    titleText: "#0077be",
    bodyText: "rgba(20, 82, 120, 0.96)",
    mutedText: "rgba(28, 102, 149, 0.9)",
    menuText: "rgba(0, 92, 148, 0.98)",
    menuBorder: "rgba(15, 148, 223, 0.95)",
    menuBg:
      "radial-gradient(circle at 28% 18%, rgba(255, 255, 255, 0.99), rgba(224, 244, 255, 0.95) 40%, rgba(96, 191, 245, 0.9) 72%, rgba(0, 162, 232, 0.9) 100%)",
    toastBg:
      "radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 1), rgba(216, 241, 255, 0.95) 46%, rgba(71, 181, 242, 0.9) 100%)",
    toastBorder: "rgba(0, 162, 232, 0.94)",
    toastText: "#006eae",
    footerBg: "rgba(244, 252, 255, 0.96)",
    footerBorder: "rgba(52, 165, 231, 0.86)",
    expTrackBg: "rgba(90, 187, 241, 0.32)",
    expFillFrom: "rgba(0, 176, 240, 0.94)",
    expFillTo: "rgba(0, 125, 201, 0.96)",
    mpTrackBg: "rgba(80, 171, 231, 0.32)",
    mpFillFrom: "rgba(42, 154, 236, 0.94)",
    mpFillTo: "rgba(0, 108, 190, 0.96)",
  },
});
