import { describe, it, expect } from "vitest";
import { Krono, krono, KronoError } from "../src/index";

describe("Error Handling", () => {
	describe("KronoError", () => {
		it("should be instance of Error", () => {
			const error = new KronoError("Test error");
			expect(error instanceof Error).toBe(true);
			expect(error instanceof KronoError).toBe(true);
			expect(error.name).toBe("KronoError");
			expect(error.message).toBe("Test error");
		});
	});

	describe("Invalid inputs", () => {
		it("should throw for invalid date strings", () => {
			expect(() => krono("not-a-date")).toThrow(KronoError);
			expect(() => krono("2025-13-01")).toThrow(KronoError);
			expect(() => krono("2025-02-30")).toThrow(KronoError);
		});

		it("should throw for invalid timezone", () => {
			expect(() => krono("2025-06-15", { zone: "Invalid/Zone" })).toThrow(
				KronoError
			);
		});

		it("should handle edge case inputs gracefully", () => {
			expect(() => krono(Number.NaN)).toThrow(KronoError);
			expect(() => krono(Number.POSITIVE_INFINITY)).toThrow(KronoError);
		});
	});

	describe("Relative parsing errors", () => {
		it("should throw for malformed relative expressions", () => {
			expect(() => krono("in abc days")).toThrow(KronoError);
			expect(() => krono("tomorrow yesterday")).toThrow(KronoError);
		});
	});

	describe("Method validation", () => {
		const date = krono("2025-06-15");

		it("should validate get() unit parameter", () => {
			expect(() =>
				date.get("invalid" as "year" | "month" | "day")
			).toThrow(KronoError);
		});

		it("should handle empty arrays in min/max", () => {
			expect(() => Krono.min()).toThrow(KronoError);
			expect(() => Krono.max()).toThrow(KronoError);
		});
	});

	describe("Timezone validation", () => {
		it("should handle timezone conversion errors gracefully", () => {
			const date = krono("2025-06-15");
			expect(() => date.tz("Invalid/Zone")).toThrow(KronoError);
		});
	});

	describe("Edge cases", () => {
		it("should handle leap year edge cases", () => {
			expect(() => krono("2025-02-29")).toThrow(KronoError);
			expect(() => krono("2024-02-29")).not.toThrow();
		});

		it("should handle large timestamps", () => {
			const largeTimestamp = 8640000000000000;
			expect(() => krono(largeTimestamp + 1)).toThrow(KronoError);
		});

		it("should handle negative timestamps", () => {
			const negativeTimestamp = -1;
			expect(() => krono(negativeTimestamp)).not.toThrow();
		});
	});
});
