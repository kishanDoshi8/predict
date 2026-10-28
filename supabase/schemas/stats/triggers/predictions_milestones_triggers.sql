drop trigger if exists trg_predictions_award_milestones on public.predictions;
create trigger trg_predictions_award_milestones
after update of status on public.predictions
for each row
when (new.status = 'revealed' and old.status is distinct from 'revealed')
execute function private.on_prediction_revealed_milestones();
