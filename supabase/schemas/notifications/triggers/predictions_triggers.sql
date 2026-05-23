drop trigger if exists trg_predictions_push_notification on public.predictions;
create trigger trg_predictions_push_notification
after insert or update of status on public.predictions
for each row execute function private.on_prediction_status_change();
