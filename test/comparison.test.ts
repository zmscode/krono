import { krono, Krono } from "../src/index";
import { describe, it, expect } from "vitest";

describe("Krono Comparisons", () => {
	const date1 = krono("2025-06-15 14:30:00");
	const date2 = krono("2025-06-16 14:30:00");
	const date3 = krono("2025-06-15 18:45:30");

	describe("Basic comparisons", () => {
		it("should check if before", () => {
			expect(date1.isBefore(date2)).toBe(true);
			expect(date2.isBefore(date1)).toBe(false);
		});

		it("should check if after", () => {
			expect(date2.isAfter(date1)).toBe(true);
			expect(date1.isAfter(date2)).toBe(false);
		});

		it("should check if same", () => {
			const sameDates = [
				krono("2025-06-15 14:30:00"),
				krono("2025-06-15 14:30:00"),
			];
			expect(sameDates[0].isSame(sameDates[1])).toBe(true);
			expect(date1.isSame(date2)).toBe(false);
		});

		it("should check if same with unit precision", () => {
			expect(date1.isSame(date3, "day")).toBe(true);
			expect(date1.isSame(date3, "hour")).toBe(false);
		});
	});

	describe("Specific same checks", () => {
		it("should check same day", () => {
			expect(date1.isSameDay(date3)).toBe(true);
			expect(date1.isSameDay(date2)).toBe(false);
		});

		it("should check same month", () => {
			const sameMonth = krono("2025-06-01");
			expect(date1.isSameMonth(sameMonth)).toBe(true);

			const differentMonth = krono("2025-07-15");
			expect(date1.isSameMonth(differentMonth)).toBe(false);
		});

		it("should check same year", () => {
			const sameYear = krono("2025-12-31");
			expect(date1.isSameYear(sameYear)).toBe(true);

			const differentYear = krono("2024-06-15");
			expect(date1.isSameYear(differentYear)).toBe(false);
		});
	});

	describe("Between checks", () => {
		it("should check if between (inclusive)", () => {
			const start = krono("2025-06-10");
			const end = krono("2025-06-20");
			expect(date1.isBetween(start, end)).toBe(true);
			expect(date1.isBetween(start, end, true)).toBe(true);
		});

		it("should check if between (exclusive)", () => {
			const start = krono("2025-06-15 14:30:00");
			const end = krono("2025-06-20");
			expect(date1.isBetween(start, end, false)).toBe(false);
			expect(date1.isBetween(start, end, true)).toBe(true);
		});
	});

	describe("Date properties", () => {
		it("should check leap year", () => {
			const leapYear = krono("2024-02-29");
			const nonLeapYear = krono("2025-02-28");

			expect(leapYear.isLeapYear()).toBe(true);
			expect(nonLeapYear.isLeapYear()).toBe(false);
		});

		it("should check weekend/weekday", () => {
			const saturday = krono("2025-06-14"); // Saturday
			const sunday = krono("2025-06-15"); // Sunday
			const monday = krono("2025-06-16"); // Monday

			expect(saturday.isWeekend()).toBe(true);
			expect(sunday.isWeekend()).toBe(true);
			expect(monday.isWeekend()).toBe(false);

			expect(saturday.isWeekday()).toBe(false);
			expect(monday.isWeekday()).toBe(true);
		});

		it("should get days in month", () => {
			const jan = krono("2025-01-15");
			const feb = krono("2025-02-15");
			const febLeap = krono("2024-02-15");

			expect(jan.daysInMonth()).toBe(31);
			expect(feb.daysInMonth()).toBe(28);
			expect(febLeap.daysInMonth()).toBe(29);
		});
	});

	describe("Diff calculations", () => {
		it("should calculate difference in various units", () => {
			const date1 = krono("2025-06-15 14:00:00");
			const date2 = krono("2025-06-15 16:30:00");

			expect(date1.diff(date2, "hour")).toBe(2);
			expect(date1.diff(date2, "minute")).toBe(150);
			expect(date1.diff(date2, "second")).toBe(9000);
		});

		it("should calculate difference in days", () => {
			const date1 = krono("2025-06-15");
			const date2 = krono("2025-06-18");

			expect(date1.diff(date2, "day")).toBe(3);
		});

		it("should calculate difference in months", () => {
			const date1 = krono("2025-06-15");
			const date2 = krono("2025-08-15");

			expect(date1.diff(date2, "month")).toBe(2);
		});

		it("should calculate difference in years", () => {
			const date1 = krono("2023-06-15");
			const date2 = krono("2025-06-15");

			expect(date1.diff(date2, "year")).toBe(2);
		});
	});

	describe("Static min/max", () => {
		it("should find minimum date", () => {
			const dates = [date2, date1, date3];
			const min = Krono.min(...dates);
			expect(min).toBe(date1);
		});

		it("should find maximum date", () => {
			const dates = [date1, date3, date2];
			const max = Krono.max(...dates);
			expect(max).toBe(date2);
		});

		it("should throw error for empty array", () => {
			expect(() => Krono.min()).toThrow();
			expect(() => Krono.max()).toThrow();
		});
	});
});
