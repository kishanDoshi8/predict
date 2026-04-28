import { useCreatePlayer, usePlayer } from "@/store/player";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Brand from "./Brand";
import { Button, Input, Spinner } from "@/components";
import { toast } from "sonner";

function CreatePlayer() {
	const { data: player, isPending: isPlayerLoading } = usePlayer();
	const { mutate: createPlayer, isPending: isCreatingPlayer } =
		useCreatePlayer();
	const navigate = useNavigate();

	const [username, setUsername] = useState("");

	useEffect(() => {
		if (!isPlayerLoading && player) {
			navigate("/");
		}
	}, [player, isPlayerLoading, navigate]);

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
			onSuccess: () => {
				toast.success(`Welcome ${username}!`, {
					position: "top-center",
				});
				navigate("/");
			},
			onError: (error) => {
				toast.error("Failed to create player.", {
					description: (error as Error).message,
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
