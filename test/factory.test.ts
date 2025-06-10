import { describe, it, expect } from "vitest";
import {
	tz,
	now,
	utc,
	krono,
	today,
	local,
	isKrono,
	tomorrow,
	duration,
	yesterday,
	isValidTimeZone,
	getSystemTimeZone,
} from "../src/index";

describe("Factory Functions", () => {
	describe("Main krono factory", () => {
		it("should create instances with different inputs", () => {
			expect(isKrono(krono())).toBe(true);
			expect(isKrono(krono("2025-06-15"))).toBe(true);
			expect(isKrono(krono(Date.now()))).toBe(true);
		});

		it("should accept options", () => {
			const date = krono("2025-06-15", {
				zone: "America/New_York",
				locale: "en-US",
			});
			expect(date.zoneName).toBe("America/New_York");
		});
	});

	describe("now() factory", () => {
		it("should create current time", () => {
			const currentTime = Date.now();
			const kronoNow = now();
			expect(Math.abs(kronoNow.valueOf() - currentTime)).toBeLessThan(
				100
			);
		});

		it("should accept timezone", () => {
			const utcNow = now("UTC");
			const nyNow = now("America/New_York");

			expect(utcNow.zoneName).toBe("UTC");
			expect(nyNow.zoneName).toBe("America/New_York");
		});
	});

	describe("Relative date factories", () => {
		it("should create today", () => {
			const todayDate = today();
			const nowDate = now();

			expect(todayDate.isSameDay(nowDate)).toBe(true);
			expect(todayDate.hour).toBe(0);
			expect(todayDate.minute).toBe(0);
			expect(todayDate.second).toBe(0);
		});

		it("should create tomorrow", () => {
			const tomorrowDate = tomorrow();
			const todayDate = today();

			expect(tomorrowDate.diff(todayDate, "day")).toBe(1);
			expect(tomorrowDate.hour).toBe(0);
		});

		it("should create yesterday", () => {
			const yesterdayDate = yesterday();
			const todayDate = today();

			expect(todayDate.diff(yesterdayDate, "day")).toBe(1);
			expect(yesterdayDate.hour).toBe(0);
		});

		it("should accept timezone for relative dates", () => {
			const utcToday = today("UTC");
			const nyToday = today("America/New_York");

			expect(utcToday.zoneName).toBe("UTC");
			expect(nyToday.zoneName).toBe("America/New_York");
		});
	});

	describe("UTC factory", () => {
		it("should create UTC instances", () => {
			expect(utc.now().zoneName).toBe("UTC");
			expect(utc.today().zoneName).toBe("UTC");
			expect(utc.tomorrow().zoneName).toBe("UTC");
			expect(utc.yesterday().zoneName).toBe("UTC");
		});
	});

	describe("Local factory", () => {
		it("should create local timezone instances", () => {
			const systemZone = getSystemTimeZone();

			expect(local.now().zoneName).toBe(systemZone);
			expect(local.today().zoneName).toBe(systemZone);
			expect(local.tomorrow().zoneName).toBe(systemZone);
			expect(local.yesterday().zoneName).toBe(systemZone);
		});
	});

	describe("Timezone-specific factory", () => {
		it("should create timezone-specific factory", () => {
			const tokyo = tz("Asia/Tokyo");

			expect(tokyo.now().zoneName).toBe("Asia/Tokyo");
			expect(tokyo.today().zoneName).toBe("Asia/Tokyo");
			expect(tokyo.tomorrow().zoneName).toBe("Asia/Tokyo");
			expect(tokyo.yesterday().zoneName).toBe("Asia/Tokyo");
		});
	});

	describe("Duration utility", () => {
		it("should calculate durations in milliseconds", () => {
			expect(duration(1, "second")).toBe(1000);
			expect(duration(1, "minute")).toBe(60000);
			expect(duration(1, "hour")).toBe(3600000);
			expect(duration(1, "day")).toBe(86400000);
		});

		it("should throw error for unsupported units", () => {
			expect(() => duration(1, "year")).toThrow();
			expect(() => duration(1, "month")).toThrow();
		});
	});

	describe("Utility functions", () => {
		it("should check if value is Krono instance", () => {
			expect(isKrono(krono())).toBe(true);
			expect(isKrono(new Date())).toBe(false);
			expect(isKrono("2025-06-15")).toBe(false);
			expect(isKrono(null)).toBe(false);
		});

		it("should validate timezone names", () => {
			expect(isValidTimeZone("UTC")).toBe(true);
			expect(isValidTimeZone("America/New_York")).toBe(true);
			expect(isValidTimeZone("Invalid/Zone")).toBe(false);
		});

		it("should get system timezone", () => {
			const systemZone = getSystemTimeZone();
			expect(typeof systemZone).toBe("string");
			expect(isValidTimeZone(systemZone)).toBe(true);
		});
	});
});
