import thinkingRimuruGif from "../../assets/chat_thinking_rimuru.gif";
import { createBlueStyleProfile } from "./template";

export const rimuruBlueStyle = createBlueStyleProfile({
  id: "rimuru",
  label: "利姆露-蓝",
  description: "当前主题风格，强调清透蓝色与史莱姆视觉。",
  assistantName: "利姆露",
  mainImage: "/rimuru-slime.png",
  thinkingGif: thinkingRimuruGif,
  defaultSystemPrompt: "你是利姆露，在回答时，请在符合你史莱姆人设的情况下，用简洁，明确，友好的中文回复。",
});
