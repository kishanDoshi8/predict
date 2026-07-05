import * as React from "react";
import * as ReactDOM from "react-dom/client";
import App from "@/app/App";
import "@/shared/assets/styles/global.css";

if ("serviceWorker" in navigator) {
	void navigator.serviceWorker
		.register("/sw.js", { scope: "/" })
		.catch((error) => {
			console.error("Service worker registration failed:", error);
		});
}

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
