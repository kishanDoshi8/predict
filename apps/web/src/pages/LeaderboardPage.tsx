import { useRoomContext } from './room/RoomLayout'
import { usePlayer } from '@/store/player'
import { useRoomLeaderboard, usePredictionHistory } from '@/store/leaderboard'
import { LeaderboardList } from './room/leaderboard/LeaderboardList'
import { PredictionHistoryFeed } from './room/leaderboard/PredictionHistoryFeed'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const TABS = ['Leaderboard', 'History'] as const
type Tab = (typeof TABS)[number]

export function LeaderboardPage() {
  const { room } = useRoomContext()
  const { data: player } = usePlayer()
  const { data: leaderboard = [], isPending: isLeaderboardLoading } = useRoomLeaderboard(room.id)
  const { data: history = [], isPending: isHistoryLoading } = usePredictionHistory(room.id)
  const [activeTab, setActiveTab] = useState<Tab>('Leaderboard')

  return (
    <div className='flex flex-col gap-4 py-4 max-w-lg mx-auto w-full'>
      {/* Section heading */}
      <div>
        <h2 className='text-xl font-semibold'>Room Rankings</h2>
        <p className='text-sm text-muted-foreground'>
          {room.members.length} member{room.members.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Tab switcher */}
      <div className='flex gap-1 p-1 rounded-lg bg-muted'>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 text-sm py-1.5 rounded-md font-medium transition-colors',
              activeTab === tab
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'Leaderboard' ? (
        <LeaderboardList
          entries={leaderboard}
          currentPlayerId={player?.id ?? ''}
          isLoading={isLeaderboardLoading}
        />
      ) : (
        <PredictionHistoryFeed
          entries={history}
          isLoading={isHistoryLoading}
        />
      )}
    </div>
  )
}

