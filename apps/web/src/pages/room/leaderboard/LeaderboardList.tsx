import { Skeleton } from '@/components/ui/skeleton'
import { LeaderboardEntry } from '@/types'
import { LeaderboardRow } from './LeaderboardRow'
import { TopThreePodium } from './TopThreePodium'

type Props = {
  entries:         LeaderboardEntry[]
  currentPlayerId: string
  isLoading:       boolean
}

export function LeaderboardList({ entries, currentPlayerId, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className='flex flex-col gap-2'>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className='h-14 w-full rounded-xl' />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className='flex flex-col items-center gap-2 py-12 text-center'>
        <p className='text-4xl'>🏆</p>
        <p className='text-muted-foreground text-sm'>
          No one is on the board yet. Make a prediction!
        </p>
      </div>
    )
  }

  const top3   = entries.filter((e) => e.rank <= 3)

  return (
    <div className='flex flex-col gap-2'>
      {top3.length > 0 && (
        <TopThreePodium top={top3} currentPlayerId={currentPlayerId} />
      )}

      {/* Divider */}
      {entries.length > 3 && (
        <div className='my-1 border-t border-border/50' />
      )}

      <div className='flex flex-col gap-1'>
        {entries.map((entry) => (
          <LeaderboardRow
            key={entry.player_id}
            entry={entry}
            all={entries}
            currentPlayerId={currentPlayerId}
          />
        ))}
      </div>
    </div>
  )
}
