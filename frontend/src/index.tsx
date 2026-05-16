import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./globals.css";
import App from "./App";

// Fix TypeScript null check
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Don't register a new service worker.
// The backend serves /sw.js as a kill-switch that unregisters any existing
// SW and clears caches — this prevents the old PWA cache from masking new
// deploys (which is what hid the grocery tab on already-installed phones).
