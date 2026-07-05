import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import type { ReactNode } from "react";

const queryClient = new QueryClient();

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				{children}
				<Toaster />
			</AuthProvider>
		</QueryClientProvider>
	);
}
