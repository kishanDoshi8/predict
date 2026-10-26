# Launch checklist

Steps for shipping roles, weekly standings, navigation and the Monday recap
to production, then checking them on real phones before inviting friends.

## 1. Deploy

Apply the migrations in order (`supabase db push`, or paste each in the SQL
editor):

1. `20261030090000_room_roles.sql`
2. `20261031090000_weekly_standings.sql`
3. `20261101090000_notification_links.sql`
4. `20261102090000_weekly_recap_push.sql`

Then:

- **Redeploy the push function:** `supabase functions deploy send-push-notifications`.
  It must be redeployed after the migrations: without it, "result needed"
  pushes are rejected and room notification settings are ignored.
- **Check the scheduled jobs:**

  ```sql
  select jobname, schedule, command from cron.job order by jobname;
  ```

  Expect `auto-lock-predictions`, `push-result-needed` (every 10 minutes) and
  `series-weekly-topup` (Mondays 00:05 UTC) running
  `snapshot_series_standings(); pay_series_topups(); notify_weekly_recap()`.
  `run-weekly-processing` should be gone.
- **Check the notification config** has the real site, so push links open the app:

  ```sql
  select key, value from private.notification_config where key = 'app_url';
  ```

- **Deploy the web app.** Open it once and accept the update prompt, so the new
  service worker takes over.

## 2. Real-phone test

Use one Android and one iPhone, with the app installed to the home screen (on
iPhone push only works for the installed app).

- [ ] Install the app, open a room, allow notifications.
- [ ] Organizer creates a prediction → the "new prediction" push arrives, and
      tapping it opens that prediction.
- [ ] Notifications → This room → turn "Prediction goes live" off → create
      another prediction → no push on that phone.
- [ ] Back gesture: Home → Standings → back lands on Home → back leaves the app.
- [ ] Open the room menu, then use the back gesture → the menu closes and the
      page stays.
- [ ] Open a prediction from a notification with the app closed → back goes to
      the room's Home.
- [ ] Share a weekly or result card → the image shares, and the link opens the room.
- [ ] Make the second phone a resolver (Members & roles) → it shows the
      "Needs you" card once a prediction is waiting for its result, and gets
      the "Result needed" push after the reminder hours.

## 3. First weeks

- Make one or two friends resolvers so results don't wait on one person.
- Set Room settings → Result reminder to suit the matches (e.g. 3 hours).
- **First Monday:** the standings snapshot runs, and rank arrows appear as
  results come in. Only the "+N points" push goes out, if anyone played.
- **Second Monday and after:** one "Week N standings are in" push per room, with
  the top-up line folded in. Share the weekly card from Standings.
- Everyone can turn any notification off, for all rooms or just one, under
  Notifications.
