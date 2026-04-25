import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ChatWindowApp from "./ChatWindowApp";
import MemoWindowApp from "./MemoWindowApp";

const panelType = (() => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("panel");
})();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {panelType === "chat" ? <ChatWindowApp /> : panelType === "memo" ? <MemoWindowApp /> : <App />}
  </React.StrictMode>,
);
