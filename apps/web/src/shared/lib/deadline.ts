import {
	differenceInCalendarDays,
	format,
	formatDistanceStrict,
	isToday,
	isTomorrow,
} from "date-fns";

export type DeadlineParts = {
	// "today at 10:00 PM", "tomorrow at 10:00 PM", "Thursday at 9:00 PM", "Nov 14 at 9:00 PM"
	when: string;
	// "Sat, Oct 25"; empty when `when` already names the date
	date: string;
	// "in 23 hours"
	relative: string;
	isPast: boolean;
};

// Describes a deadline the way a person would say it, keeping the exact
// date alongside for anything beyond today.
export function describeDeadline(deadline: Date, now = new Date()): DeadlineParts {
	const time = format(deadline, "h:mm a");
	const daysAway = differenceInCalendarDays(deadline, now);

	let when: string;
	let date = format(deadline, "EEE, MMM d");
	if (isToday(deadline)) {
		when = `today at ${time}`;
		date = "";
	} else if (isTomorrow(deadline)) {
		when = `tomorrow at ${time}`;
	} else if (daysAway > 1 && daysAway < 7) {
		when = `${format(deadline, "EEEE")} at ${time}`;
		date = format(deadline, "MMM d");
	} else {
		when = `${format(deadline, "MMM d")} at ${time}`;
		date = format(deadline, "EEE");
	}

	const isPast = deadline.getTime() <= now.getTime();
	// "in 33 hours" reads better than "in 1 day" for the next two days.
	const hoursAway = Math.abs(deadline.getTime() - now.getTime()) / 3_600_000;
	const distance = formatDistanceStrict(deadline, now, {
		roundingMethod: "floor",
		unit: hoursAway >= 1 && hoursAway < 48 ? "hour" : undefined,
	});

	return {
		when,
		date,
		relative: isPast ? `${distance} ago` : `in ${distance}`,
		isPast,
	};
}
