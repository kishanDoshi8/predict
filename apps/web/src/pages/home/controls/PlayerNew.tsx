"use client";

import { Button } from "../../../components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "../../../components/ui/drawer";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { FieldDescription } from "../../../components/ui/field";
import React from "react";
import { Spinner } from "../../../components/ui/spinner";
import { TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCreatePlayer } from "@/store/player";
import { useJoinRoom } from "@/store/room";

type Props = {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	navigateTo?: string;
	joinRoomCode?: string;
};

export default function PlayerNew({
	isOpen,
	setIsOpen,
	navigateTo,
	joinRoomCode,
}: Readonly<Props>) {
	const navigate = useNavigate();
	const { mutate: createPlayer, isPending: isLoading } = useCreatePlayer();
	const { mutate: joinRoom } = useJoinRoom();

	const isDesktop = window.innerWidth >= 768; // Example breakpoint for desktop
	const MainComponent = isDesktop ? Dialog : Drawer;
	const ContentComponent = isDesktop ? DialogContent : DrawerContent;
	const HeaderComponent = isDesktop ? DialogHeader : DrawerHeader;
	const TitleComponent = isDesktop ? DialogTitle : DrawerTitle;

	const [username, setUsername] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);

	const handleRegisterUser = async () => {
		setError(null);
		createPlayer(username, {
			onSuccess: (_data) => {
				if (joinRoomCode) {
					joinRoom({
						roomCode: joinRoomCode,
					});
				}

				if (navigateTo) {
					navigate(navigateTo);
				}
				setIsOpen(false);
			},
			onError: (error_: any) => {
				setError(
					error_.message ||
						"An error occurred while creating the user.",
				);
			},
		});
	};

	return (
		<div>
			<MainComponent open={isOpen} onOpenChange={setIsOpen}>
				<ContentComponent className={`p-4`}>
					<HeaderComponent>
						<TitleComponent>Choose a username</TitleComponent>
					</HeaderComponent>

					<div>
						<Input
							placeholder='John doe'
							className={`mb-2`}
							value={username}
							spellCheck={false}
							autoComplete='off'
							onChange={(e) => setUsername(e.target.value)}
							disabled={isLoading}
						/>
						<FieldDescription>
							Choose a unique username.
						</FieldDescription>
						{error && (
							<p
								className={`text-red-500 mt-2 flex items-center gap-2`}
							>
								<TriangleAlert className={`w-4 h-4`} />
								{error}
							</p>
						)}
					</div>

					<div className={`flex mt-4 gap-2 justify-end`}>
						<Button
							variant='outline'
							onClick={() => setIsOpen(false)}
							className={`flex-1`}
							disabled={isLoading}
						>
							Maybe later
						</Button>
						<Button
							onClick={handleRegisterUser}
							disabled={isLoading}
						>
							{isLoading && <Spinner />}
							Create user
						</Button>
					</div>
				</ContentComponent>
			</MainComponent>
		</div>
	);
}
