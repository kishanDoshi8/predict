import { DefaultRoomStat } from "@/types";

function DefaultStatCard({ stat }: Readonly<{ stat: DefaultRoomStat }>) {
	return (
		<article
			key={stat.key}
			className='min-w-45 flex-1 rounded-xl border bg-card p-3'
		>
			<p className='text-xs text-muted-foreground flex items-center gap-1'>
				<span>{stat.icon}</span>
				<span>{stat.title}</span>
			</p>
			<p className='text-base font-semibold leading-tight mt-1'>
				{stat.value}
			</p>
			{stat.subtitle ? (
				<p className='text-sm text-muted-foreground mt-1 truncate'>
					{stat.subtitle}
				</p>
			) : null}
		</article>
	);
}

export default DefaultStatCard;
