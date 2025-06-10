import { describe, it, expect, beforeEach } from "vitest";
import { krono, type Krono, KronoError } from "../src/index";

describe("Krono Core", () => {
	let testDate: Krono;

	beforeEach(() => {
		testDate = krono("2025-06-15T14:30:45.123Z", { zone: "UTC" });
	});

	describe("Creation", () => {
		it("should create from string", () => {
			const date = krono("2025-06-15");
			expect(date.year).toBe(2025);
			expect(date.month).toBe(6);
			expect(date.day).toBe(15);
		});

		it("should create from number (timestamp)", () => {
			const timestamp = Date.now();
			const date = krono(timestamp);
			expect(date.valueOf()).toBe(timestamp);
		});

		it("should create from Date object", () => {
			const jsDate = new Date("2025-06-15T14:30:00Z");
			const date = krono(jsDate);
			expect(date.toDate().getTime()).toBe(jsDate.getTime());
		});

		it("should create from another Krono instance", () => {
			const original = krono("2025-06-15");
			const copy = krono(original);
			expect(copy.valueOf()).toBe(original.valueOf());
		});

		it("should create current time when no input provided", () => {
			const now = Date.now();
			const date = krono();
			expect(Math.abs(date.valueOf() - now)).toBeLessThan(100);
		});

		it("should throw error for invalid input", () => {
			expect(() => krono("invalid-date")).toThrow(KronoError);
		});
	});

	describe("Getters", () => {
		it("should return correct year", () => {
			expect(testDate.year).toBe(2025);
		});

		it("should return correct month (1-based)", () => {
			expect(testDate.month).toBe(6);
		});

		it("should return correct day", () => {
			expect(testDate.day).toBe(15);
		});

		it("should return correct hour", () => {
			expect(testDate.hour).toBe(14);
		});

		it("should return correct minute", () => {
			expect(testDate.minute).toBe(30);
		});

		it("should return correct second", () => {
			expect(testDate.second).toBe(45);
		});

		it("should return correct millisecond", () => {
			expect(testDate.millisecond).toBe(123);
		});

		it("should return correct day of week", () => {
			const sunday = krono("2025-06-15"); // June 15, 2025 is a Sunday
			expect(sunday.dayOfWeek).toBe(0);
		});
	});

	describe("get() method", () => {
		it("should get specific time units", () => {
			expect(testDate.get("year")).toBe(2025);
			expect(testDate.get("month")).toBe(6);
			expect(testDate.get("day")).toBe(15);
			expect(testDate.get("hour")).toBe(14);
			expect(testDate.get("minute")).toBe(30);
			expect(testDate.get("second")).toBe(45);
			expect(testDate.get("millisecond")).toBe(123);
		});

		it("should throw error for invalid unit", () => {
			expect(() =>
				testDate.get(
					"invalid" as
						| "year"
						| "month"
						| "day"
						| "hour"
						| "minute"
						| "second"
						| "millisecond"
				)
			).toThrow(KronoError);
		});
	});

	describe("Manipulation", () => {
		it("should add time correctly", () => {
			const result = testDate.add(1, "day");
			expect(result.day).toBe(16);
			expect(result.month).toBe(6);
			expect(result.year).toBe(2025);
		});

		it("should subtract time correctly", () => {
			const result = testDate.subtract(1, "hour");
			expect(result.hour).toBe(13);
			expect(result.day).toBe(15);
		});

		it("should handle month overflow", () => {
			const date = krono("2025-01-31");
			const result = date.add(1, "month");
			expect(result.month).toBe(2);
			expect(result.year).toBe(2025);
		});

		it("should handle year overflow", () => {
			const date = krono("2025-12-31");
			const result = date.add(1, "day");
			expect(result.year).toBe(2026);
			expect(result.month).toBe(1);
			expect(result.day).toBe(1);
		});
	});

	describe("Start/End of units", () => {
		it("should get start of day", () => {
			const result = testDate.startOf("day");
			expect(result.hour).toBe(0);
			expect(result.minute).toBe(0);
			expect(result.second).toBe(0);
			expect(result.millisecond).toBe(0);
		});

		it("should get end of day", () => {
			const result = testDate.endOf("day");
			expect(result.hour).toBe(23);
			expect(result.minute).toBe(59);
			expect(result.second).toBe(59);
			expect(result.millisecond).toBe(999);
		});

		it("should get start of month", () => {
			const result = testDate.startOf("month");
			expect(result.day).toBe(1);
			expect(result.hour).toBe(0);
			expect(result.minute).toBe(0);
		});

		it("should get end of month", () => {
			const result = testDate.endOf("month");
			expect(result.day).toBe(30);
			expect(result.hour).toBe(23);
			expect(result.minute).toBe(59);
		});

		it("should get start of year", () => {
			const result = testDate.startOf("year");
			expect(result.month).toBe(1);
			expect(result.day).toBe(1);
			expect(result.hour).toBe(0);
		});
	});

	describe("Immutability", () => {
		it("should not modify original instance when manipulating", () => {
			const original = krono("2025-06-15");
			const modified = original.add(1, "day");

			expect(original.day).toBe(15);
			expect(modified.day).toBe(16);
			expect(original).not.toBe(modified);
		});
	});
});
