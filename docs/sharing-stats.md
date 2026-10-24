# Which shareables bring people in

Every shared link carries `?ref=<kind>`. Its value is stored on the
membership when someone joins (`room_members.joined_via`), and each completed
share is logged in `share_events`. Neither is visible to players. Read them in
the Supabase SQL editor.

| `ref` / kind | Where it comes from |
| --- | --- |
| `brag-card` | The receipt shared from a settled prediction |
| `champion-card` | The series championship poster |
| `invite-link`, `invite-card` | The room invite |

## Joins by shareable

```sql
select coalesce(joined_via, 'direct') as came_from,
       count(*) as joins,
       max(joined_at) as latest
from public.room_members
where not is_organizer
group by 1
order by joins desc;
```

## Shares, and joins they led to, per kind (last 30 days)

```sql
with shares as (
  select kind, count(*) as shares
  from public.share_events
  where created_at > now() - interval '30 days'
  group by kind
), joins as (
  select joined_via as kind, count(*) as joins
  from public.room_members
  where joined_via is not null and joined_at > now() - interval '30 days'
  group by joined_via
)
select coalesce(s.kind, j.kind) as kind,
       coalesce(s.shares, 0) as shares,
       coalesce(j.joins, 0) as joins
from shares s
full join joins j on j.kind = s.kind
order by shares desc;
```

## Who shares most

```sql
select p.username, e.kind, count(*) as shares
from public.share_events e
join public.players p on p.id = e.player_id
group by 1, 2
order by shares desc;
```

A join only counts as a referral when it happens within 30 days of tapping the
link, on the same phone. People who joined before this tracking existed show
as `direct`.
