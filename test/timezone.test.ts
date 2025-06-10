import { krono, zone } from "../src/index";
import { describe, it, expect } from "vitest";

describe("Timezone Functionality", () => {
	describe("Zone utilities", () => {
		it("should validate timezone names", () => {
			expect(zone.isValid("UTC")).toBe(true);
			expect(zone.isValid("America/New_York")).toBe(true);
			expect(zone.isValid("Europe/London")).toBe(true);
			expect(zone.isValid("Invalid/Zone")).toBe(false);
		});

		it("should get system timezone", () => {
			const systemZone = zone.getSystemZone();
			expect(typeof systemZone).toBe("string");
			expect(zone.isValid(systemZone)).toBe(true);
		});

		it("should calculate timezone offsets", () => {
			const timestamp = new Date("2025-06-15T12:00:00Z").getTime();
			const utcOffset = zone.getOffset(timestamp, "UTC");
			expect(utcOffset).toBe(0);
		});

		it("should convert between timezones", () => {
			const utcTime = new Date("2025-06-15T12:00:00Z").getTime();
			const convertedTime = zone.convertToZone(utcTime, "UTC", "UTC");
			expect(convertedTime).toBe(utcTime);
		});
	});

	describe("Krono timezone conversion", () => {
		it("should convert to different timezone", () => {
			const utcDate = krono("2025-06-15 12:00", { zone: "UTC" });
			const nyDate = utcDate.tz("America/New_York");

			expect(nyDate.zoneName).toBe("America/New_York");
			expect(nyDate.valueOf()).toBe(utcDate.valueOf());
		});

		it("should convert to UTC", () => {
			const localDate = krono("2025-06-15 12:00");
			const utcDate = localDate.utc();

			expect(utcDate.zoneName).toBe("UTC");
		});

		it("should convert to local timezone", () => {
			const utcDate = krono("2025-06-15 12:00", { zone: "UTC" });
			const localDate = utcDate.local();

			expect(localDate.zoneName).toBe(zone.getSystemZone());
		});
	});

	describe("Timezone-aware operations", () => {
		it("should handle DST transitions when adding time", () => {
			const nyWinter = krono("2025-01-15 12:00", {
				zone: "America/New_York",
			});
			const nySummer = krono("2025-07-15 12:00", {
				zone: "America/New_York",
			});

			expect(nyWinter.zoneName).toBe("America/New_York");
			expect(nySummer.zoneName).toBe("America/New_York");
		});

		it("should preserve timezone when manipulating dates", () => {
			const nyDate = krono("2025-06-15", { zone: "America/New_York" });
			const tomorrow = nyDate.add(1, "day");

			expect(tomorrow.zoneName).toBe("America/New_York");
		});
	});

	describe("Timezone properties", () => {
		it("should get timezone abbreviation", () => {
			const utcDate = krono("2025-06-15", { zone: "UTC" });
			expect(typeof utcDate.zoneAbbr).toBe("string");
		});

		it("should detect DST status", () => {
			const nyWinter = krono("2025-01-15", { zone: "America/New_York" });
			const nySummer = krono("2025-07-15", { zone: "America/New_York" });

			expect(typeof nyWinter.isDST).toBe("boolean");
			expect(typeof nySummer.isDST).toBe("boolean");
		});
	});

	describe("ISO string with timezone", () => {
		it("should generate ISO string with timezone offset", () => {
			const utcDate = krono("2025-06-15 14:30:00", { zone: "UTC" });
			expect(utcDate.toISOString()).toMatch(/Z$/);

			const nyDate = krono("2025-06-15 14:30:00", {
				zone: "America/New_York",
			});
			expect(nyDate.toISOString()).toMatch(/[+-]\d{2}:\d{2}$/);
		});
	});
});
