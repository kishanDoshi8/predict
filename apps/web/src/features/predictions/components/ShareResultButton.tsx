import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toBlob } from "html-to-image";
import { Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button, Spinner } from "@/shared/ui";
import { ResultShareCard, type ResultShareData } from "./ResultShareCard";

type Props = {
	data: ResultShareData;
	fileName: string;
};

// Renders the card off-screen, turns it into a PNG and opens the share sheet.
// Where sharing files isn't supported, it downloads the image instead.
export function ShareResultButton({ data, fileName }: Readonly<Props>) {
	const cardRef = useRef<HTMLDivElement>(null);
	const [isRendering, setIsRendering] = useState(false);

	const handleShare = async () => {
		const node = cardRef.current;
		if (!node) return;
		setIsRendering(true);
		try {
			await document.fonts.ready;
			const blob = await toBlob(node, { pixelRatio: 1, cacheBust: true });
			if (!blob) throw new Error("Couldn't make the image.");
			const file = new File([blob], `${fileName}.png`, { type: "image/png" });

			if (navigator.canShare?.({ files: [file] })) {
				try {
					await navigator.share({ files: [file], title: data.question });
				} catch (error) {
					if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
				}
				return;
			}

			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = file.name;
			link.click();
			globalThis.setTimeout(() => URL.revokeObjectURL(url), 10_000);
			toast.success("Image saved. Share it from your downloads.", { position: "top-center" });
		} catch (error) {
			toast.error("Couldn't share the result.", {
				description: error instanceof Error ? error.message : undefined,
				position: "top-center",
			});
		} finally {
			setIsRendering(false);
		}
	};

	return (
		<>
			<Button variant='outline' onClick={() => void handleShare()} disabled={isRendering}>
				{isRendering ? <Spinner /> : <Share2Icon />}
				Share result
			</Button>
			{createPortal(
				<div aria-hidden='true' style={{ position: "fixed", left: -10_000, top: 0, pointerEvents: "none" }}>
					<ResultShareCard ref={cardRef} data={data} />
				</div>,
				document.body,
			)}
		</>
	);
}
