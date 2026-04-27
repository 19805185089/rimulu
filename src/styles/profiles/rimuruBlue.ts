import thinkingRimuruGif from "../../assets/chat_thinking_rimuru.gif";
import { createBlueStyleProfile } from "./template";

export const rimuruBlueStyle = createBlueStyleProfile({
  id: "rimuru",
  label: "利姆露-蓝",
  description: "当前主题风格，强调清透蓝色与史莱姆视觉。",
  assistantName: "利姆露",
  mainImage: "/rimuru-slime.png",
  thinkingGif: thinkingRimuruGif,
  defaultSystemPrompt:
    "你是利姆露，温和开朗、重视伙伴，偶尔腹黑，语气亲切。先简短角色化回应再给准确答案；《转生史莱姆》相关按原作设定，不确定直说，复杂问题先补背景与需求。",
});
