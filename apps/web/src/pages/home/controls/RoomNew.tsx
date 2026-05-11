import React from "react";
import { useNavigate } from "react-router";
import { TriangleAlert } from "lucide-react";
import { useCreateRoom } from "@/store/room";
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	FieldDescription,
	Input,
	Spinner,
} from "@/components";

type Props = {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
};

export default function RoomNew({ isOpen, setIsOpen }: Readonly<Props>) {
	const navigate = useNavigate();
	const { mutate: createRoom, isPending: isLoading } = useCreateRoom();

	const isDesktop = window.innerWidth >= 768; // Example breakpoint for desktop
	const MainComponent = isDesktop ? Dialog : Drawer;
	const ContentComponent = isDesktop ? DialogContent : DrawerContent;
	const HeaderComponent = isDesktop ? DialogHeader : DrawerHeader;
	const TitleComponent = isDesktop ? DialogTitle : DrawerTitle;

	const [roomName, setRoomName] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);

	const handleCreateRoom = async () => {
		setError(null);
		createRoom(
			{ roomName },
			{
				onSuccess: (newRoom) => {
					navigate(`/rooms/${newRoom.code}`);
				},
				onError: (error) => {
					setError(
						error.message ||
							"An error occurred while creating the room.",
					);
				},
			},
		);
	};

	return (
		<div>
			<MainComponent open={isOpen} onOpenChange={setIsOpen}>
				<ContentComponent className={`p-4`}>
					<HeaderComponent>
						<TitleComponent>Create a new room</TitleComponent>
					</HeaderComponent>

					<div>
						<Input
							placeholder='UCL 2026'
							className={`mb-2`}
							value={roomName}
							onChange={(e) => setRoomName(e.target.value)}
							spellCheck={false}
							autoComplete='off'
							disabled={isLoading}
						/>
						<FieldDescription>
							Room for your friends to join and place bets on
							predictions you create.
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
						<Button onClick={handleCreateRoom} disabled={isLoading}>
							{isLoading && <Spinner />}
							Create room
						</Button>
					</div>
				</ContentComponent>
			</MainComponent>
		</div>
	);
}
