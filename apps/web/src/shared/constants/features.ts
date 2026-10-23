// Features switched off in the UI while they're reworked.
// The server pauses them too (see supabase/migrations/*_series_wallets.sql),
// so flipping a flag here alone won't bring a feature back.
export const FEATURES: Readonly<{ duels: boolean }> = {
	duels: false,
};
