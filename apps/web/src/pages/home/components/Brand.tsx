import { Badge } from "@/components";

function Brand() {
	return (
		<>
			<Badge variant='outline' className={`b-4 border-win text-win`}>
				Beta v0.1
			</Badge>
			<div className={`flex flex-col gap-2 items-center`}>
				<h1 className={`text-4xl font-medium`}>Verdict</h1>
				<p className={`text-muted-foreground`}>
					Your weekly prediction league.
				</p>
			</div>
		</>
	);
}

export default Brand;
