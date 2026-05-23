import { Skeleton } from '@/components'
import { useRoomStatCards } from '@/store/room'
import { useRoomContext } from '../RoomLayout'

export default function RoomStatsCards() {
  const { room } = useRoomContext()
  const { data: stats = [], isPending } = useRoomStatCards(room.id)

  if (!isPending && stats.length === 0) {
    return null
  }

  return (
    <section className='mt-2 mb-4'>
      {isPending ? (
        <div className='flex gap-3 overflow-x-auto pb-2'>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className='min-w-[180px] flex-1 rounded-xl border bg-card p-3 space-y-2'
            >
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-6 w-28' />
              <Skeleton className='h-4 w-20' />
            </div>
          ))}
        </div>
      ) : (
        <div className='flex gap-3 overflow-x-auto pb-2'>
          {stats.map((stat) => (
            <article
              key={stat.key}
              className='min-w-[180px] flex-1 rounded-xl border bg-card p-3'
            >
              <p className='text-xs text-muted-foreground flex items-center gap-1'>
                <span>{stat.icon}</span>
                <span>{stat.title}</span>
              </p>
              <p className='text-base font-semibold leading-tight mt-1'>{stat.value}</p>
              {stat.subtitle ? (
                <p className='text-sm text-muted-foreground mt-1 truncate'>{stat.subtitle}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
