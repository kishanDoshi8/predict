import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { AppProviders } from "@/app/providers/AppProviders";
import { useAppUpdate } from "@/shared/lib/appUpdate";

export default function App() {
  useAppUpdate();

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
