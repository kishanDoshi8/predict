import { useCreatePlayer, usePlayer } from "@/features/home";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Brand from "./Brand";
import { Button, Input, Spinner } from "@/shared/ui";
import { toast } from "sonner";

function CreatePlayer() {
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const { mutate: createPlayer, isPending: isCreatingPlayer } =
		useCreatePlayer();
	const navigate = useNavigate();
	const location = useLocation();
	const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

	const [username, setUsername] = useState("");

	useEffect(() => {
		if (!isPlayerLoading && player) {
			navigate(from, { replace: true });
		}
	}, [player, isPlayerLoading, navigate, from]);

	const handleCreatePlayer = () => {
		if (username.trim() === "") {
			return;
		} else if (username.length < 3) {
			toast.error("Username must be at least 3 characters long.", {
				position: "top-center",
			});
			return;
		}

		createPlayer(username, {
			onSuccess: (data) => {
				toast.success(`Welcome ${data.username}!`, {
					position: "top-center",
				});
				navigate(from, { replace: true });
			},
			onError: (error) => {
				toast.error("Failed to create player.", {
					description: error.message,
					position: "top-center",
				});
			},
		});
	};

	return (
		<div className={`p-8 mt-4 flex flex-col items-center gap-8`}>
			<Brand />

			<div className={`flex flex-col`}>
				<div className={`flex flex-col gap-4 border-2 p-8`}>
					<Input
						placeholder='Enter a username'
						value={username}
						onChange={(e) => setUsername(e.target.value)}
					/>
					<Button
						onClick={handleCreatePlayer}
						disabled={isCreatingPlayer}
					>
						{isCreatingPlayer && <Spinner />}
						Get Started
					</Button>
				</div>
			</div>
		</div>
	);
}

export default CreatePlayer;
