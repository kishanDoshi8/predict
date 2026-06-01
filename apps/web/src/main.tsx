import * as React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "@/assests/styles/global.css";

if ("serviceWorker" in navigator) {
	void navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
