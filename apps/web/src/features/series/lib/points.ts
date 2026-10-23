// Mirrors the checks in create_series / update_series.
export function getSeriesPointsError(startingStack: string, weeklyTopup: string) {
	const stack = Number(startingStack);
	const topup = Number(weeklyTopup);

	if (!Number.isInteger(stack) || stack < 100) {
		return "Starting points must be a whole number of at least 100.";
	}

	if (!Number.isInteger(topup) || topup < 0) {
		return "Weekly top-up must be a whole number of 0 or more.";
	}

	return "";
}
