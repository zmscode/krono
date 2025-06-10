import { krono } from "../src/index";
import { describe, it, expect } from "vitest";

describe("Krono Formatting", () => {
	const testDate = krono("2025-06-15 14:30:45.123");

	describe("Basic formatting", () => {
		it("should format with default options", () => {
			const formatted = testDate.format();
			expect(typeof formatted).toBe("string");
			expect(formatted).toContain("2025");
		});

		it("should format with custom options", () => {
			const formatted = testDate.format({
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
			});
			expect(formatted).toContain("2025");
			expect(formatted).toContain("June");
		});

		it("should format with time", () => {
			const formatted = testDate.format({
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			});
			expect(formatted).toMatch(/\d{1,2}:\d{2}/);
		});
	});

	describe("Relative time formatting", () => {
		it("should format fromNow for past dates", () => {
			const pastDate = krono().subtract(30, "minute");
			const fromNow = pastDate.fromNow();
			expect(fromNow).toContain("ago");
			expect(fromNow).toContain("30");
			expect(fromNow).toContain("minute");
		});

		it("should format fromNow for future dates", () => {
			const futureDate = krono().add(2, "hour");
			const fromNow = futureDate.fromNow();
			expect(fromNow).toContain("in");
			expect(fromNow).toContain("2");
			expect(fromNow).toContain("hour");
		});

		it("should format very recent times", () => {
			const recentDate = krono().subtract(10, "second");
			const fromNow = recentDate.fromNow();
			expect(fromNow).toContain("few seconds ago");
		});

		it("should alias toNow to fromNow", () => {
			const date = krono().subtract(1, "hour");
			expect(date.toNow()).toBe(date.fromNow());
		});
	});

	describe("Calendar formatting", () => {
		it('should format today as "Today"', () => {
			const today = krono();
			const calendar = today.calendar();
			expect(calendar).toContain("Today");
		});

		it('should format tomorrow as "Tomorrow"', () => {
			const tomorrow = krono().add(1, "day");
			const calendar = tomorrow.calendar();
			expect(calendar).toContain("Tomorrow");
		});

		it('should format yesterday as "Yesterday"', () => {
			const yesterday = krono().subtract(1, "day");
			const calendar = yesterday.calendar();
			expect(calendar).toContain("Yesterday");
		});

		it("should format dates within a week with day names", () => {
			const nextWeek = krono().add(3, "day");
			const calendar = nextWeek.calendar();
			expect(calendar).toMatch(
				/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/
			);
		});

		it("should format distant dates with full date", () => {
			const distantFuture = krono().add(2, "month");
			const calendar = distantFuture.calendar();
			expect(calendar).toMatch(/\d{4}/);
		});
	});

	describe("Distance formatting", () => {
		it("should format distance between dates", () => {
			const date1 = krono("2025-06-15");
			const date2 = krono("2025-08-15");
			const distance = date1.formatDistance(date2);
			expect(distance).toContain("month");
			expect(distance).toContain("about");
		});

		it("should format short distances", () => {
			const date1 = krono("2025-06-15 14:00");
			const date2 = krono("2025-06-15 14:30");
			const distance = date1.formatDistance(date2);
			expect(distance).toContain("minute");
		});
	});

	describe("Conversion methods", () => {
		it("should convert to Date", () => {
			const jsDate = testDate.toDate();
			expect(jsDate instanceof Date).toBe(true);
			expect(jsDate.getTime()).toBe(testDate.valueOf());
		});

		it("should convert to ISO string", () => {
			const iso = testDate.toISOString();
			expect(typeof iso).toBe("string");
			expect(iso).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it("should convert to JSON", () => {
			const json = testDate.toJSON();
			expect(typeof json).toBe("string");
			expect(json).toBe(testDate.toISOString());
		});

		it("should convert to string", () => {
			const str = testDate.toString();
			expect(typeof str).toBe("string");
			expect(str).toBe(testDate.toISOString());
		});

		it("should return timestamp for valueOf", () => {
			const timestamp = testDate.valueOf();
			expect(typeof timestamp).toBe("number");
			expect(timestamp).toBeGreaterThan(0);
		});
	});
});
