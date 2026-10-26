import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { AppProviders } from "@/app/providers/AppProviders";
import { useAppUpdate } from "@/shared/lib/appUpdate";
import { useEffect } from "react";

// A tapped notification while the app is open: the service worker asks us to
// open the page, pushed on top of wherever the person is.
function useNotificationNavigation() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const path = event.data?.type === "navigate" ? event.data.path : null;
      if (typeof path === "string" && path.startsWith("/")) {
        void router.navigate(path);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
}

export default function App() {
  useAppUpdate();
  useNotificationNavigation();

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
