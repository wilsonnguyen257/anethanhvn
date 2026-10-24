import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App";
import "./index.css";
import { languageFromPath, withLanguagePrefix } from "./lib/locale";

const { pathname, search, hash } = window.location;
const isEnglish = languageFromPath(pathname) === 'en';

// A visitor who previously chose English lands on the English version of a
// public page. Crawlers keep no storage, so they always get the URL they asked for.
let prefersEnglish = false;
try {
  prefersEnglish = localStorage.getItem("language") === "en";
} catch {
  /* storage unavailable */
}

if (!isEnglish && prefersEnglish && !/^\/(admin|login)(\/|$)/.test(pathname)) {
  window.location.replace(withLanguagePrefix(pathname, "en") + search + hash);
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter basename={isEnglish ? "/en" : undefined}>
        <Analytics />
        <SpeedInsights />
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}
