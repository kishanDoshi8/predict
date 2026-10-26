import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth";
import type { ReactNode } from "react";

const queryClient = new QueryClient();

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<QueryClientProvider client={queryClient}>
			{/* Respect the OS "reduce motion" setting for every animation. */}
			<MotionConfig reducedMotion='user'>
				<AuthProvider>
					{children}
					<Toaster />
				</AuthProvider>
			</MotionConfig>
		</QueryClientProvider>
	);
}
