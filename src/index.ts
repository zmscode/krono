/**
 * Krono - A blazingly fast, lightweight, and timezone-aware date/time library
 * @author zmscode
 * @version 0.1.0
 */

// ==========================================
// TYPES & INTERFACES
// ==========================================

/**
 * Time units supported by Krono for date manipulation and comparison
 * @typedef {"millisecond"|"second"|"minute"|"hour"|"day"|"week"|"month"|"year"} TimeUnit
 */
export type TimeUnit =
	| "millisecond"
	| "second"
	| "minute"
	| "hour"
	| "day"
	| "week"
	| "month"
	| "year";

/**
 * Branded type for Unix timestamp (milliseconds since epoch)
 * @typedef {number} Timestamp
 */
export type Timestamp = number & { readonly __brand: unique symbol };

/**
 * Branded type for durations (milliseconds)
 * @typedef {number} Duration
 */
export type Duration = number & { readonly __brand: unique symbol };

/**
 * Configuration options for creating Krono instances
 * @interface KronoOptions
 * @property {string} [locale] - Locale string for formatting (defaults to 'en-GB')
 * @property {string} [zone] - IANA timezone identifier (defaults to 'UTC')
 * @property {boolean} [debug] - Enable debug logging
 */
export interface KronoOptions {
	/** Locale string for formatting (defaults to 'en-GB') */
	readonly locale?: string;
	/** IANA timezone identifier (defaults to 'UTC') */
	readonly zone?: string;
	/** Enable debug logging */
	readonly debug?: boolean;
}

/**
 * DST ambiguity resolution preference
 * @typedef {"earlier"|"later"} DSTPreference
 */
export type DSTPreference = "earlier" | "later";

// ==========================================
// ERROR CLASSES
// ==========================================

/**
 * Base error class for Krono-specific errors
 * @extends {Error}
 */
export class KronoError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "KronoError";
	}
}

/**
 * Error for parsing failures
 * @extends {KronoError}
 */
export class KronoParseError extends KronoError {
	constructor(input: string, reason: string) {
		super(`Failed to parse "${input}": ${reason}`);
		this.name = "KronoParseError";
	}
}

/**
 * Error for timezone issues
 * @extends {KronoError}
 */
export class KronoTimezoneError extends KronoError {
	constructor(timezone: string) {
		super(`Invalid timezone: ${timezone}`);
		this.name = "KronoTimezoneError";
	}
}

// ==========================================
// UTILITY CLASSES
// ==========================================

/**
 * LRU Cache implementation for memory management
 * @template K, V
 * @private
 */
class LRUCache<K, V> {
	private cache = new Map<K, V>();

	constructor(private maxSize: number) {}

	get(key: K): V | undefined {
		const value = this.cache.get(key);
		if (value !== undefined) {
			// Move to end (most recently used)
			this.cache.delete(key);
			this.cache.set(key, value);
		}
		return value;
	}

	set(key: K, value: V): void {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			// Remove least recently used
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined) {
				this.cache.delete(firstKey);
			}
		}
		this.cache.set(key, value);
	}

	has(key: K): boolean {
		return this.cache.has(key);
	}

	clear(): void {
		this.cache.clear();
	}
}

// ==========================================
// CONSTANTS & PATTERNS
// ==========================================

// Pre-compiled regex patterns for performance
const RELATIVE_REGEX =
	/(?:in\s+)?(\d+)\s+(year|month|week|day|hour|minute|second)s?\s*(?:ago|from\s+now|in)?/i;

const ISO_WITH_ZONE_REGEX =
	/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?)?(?:Z|([+-]\d{2}):?(\d{2})|$)/;

// Natural language patterns
const NATURAL_PATTERNS = [
	{
		pattern:
			/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
		handler: "nextWeekday" as const,
	},
	{
		pattern:
			/^last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
		handler: "lastWeekday" as const,
	},
	{
		pattern: /^(beginning|start)\s+of\s+(month|year|week)$/i,
		handler: "startOf" as const,
	},
	{
		pattern: /^(end)\s+of\s+(month|year|week)$/i,
		handler: "endOf" as const,
	},
] as const;

// Time constants for blazing fast calculations
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;
const MS_PER_WEEK = 604800000;

/**
 * Lookup table for time unit multipliers (in milliseconds)
 * @readonly
 */
const UNIT_MULTIPLIERS = {
	millisecond: 1,
	second: MS_PER_SECOND,
	minute: MS_PER_MINUTE,
	hour: MS_PER_HOUR,
	day: MS_PER_DAY,
	week: MS_PER_WEEK,
} as const;

/**
 * Days in each month (non-leap year)
 * @readonly
 */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * Thresholds for relative time formatting
 */
const RELATIVE_TIME_THRESHOLDS = [
	{ unit: "second", threshold: 60, divisor: 1 },
	{ unit: "minute", threshold: 3600, divisor: 60 },
	{ unit: "hour", threshold: 86400, divisor: 3600 },
	{ unit: "day", threshold: 2592000, divisor: 86400 },
	{ unit: "month", threshold: 31536000, divisor: 2592000 },
	{ unit: "year", threshold: Number.POSITIVE_INFINITY, divisor: 31536000 },
] as const;

/**
 * Weekday name to number mapping
 * @readonly
 */
const WEEKDAY_MAP = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
} as const;

// ==========================================
// CACHES
// ==========================================

// Private caches for performance optimization with size limits
const _offsetCache = new LRUCache<string, Map<number, number>>(100);
const _validZoneCache = new Set<string>();

// ==========================================
// VALIDATION UTILITIES
// ==========================================

/**
 * Validates a timestamp
 * @param {number} timestamp
 * @throws {KronoError}
 */
function validateTimestamp(timestamp: number): void {
	if (!Number.isFinite(timestamp)) {
		throw new KronoError(`Invalid timestamp: ${timestamp}`);
	}
	if (Math.abs(timestamp) > 8.64e15) {
		throw new KronoError(`Timestamp out of range: ${timestamp}`);
	}
}

/**
 * Validates date components
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @throws {KronoParseError}
 */
function validateDateComponents(
	year: number,
	month: number,
	day: number
): void {
	if (month < 1 || month > 12 || day < 1 || day > 31) {
		throw new KronoParseError(
			`${year}-${month}-${day}`,
			"Invalid date components"
		);
	}

	const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	const daysInMonthForInput =
		month === 2 && isLeap ? 29 : DAYS_IN_MONTH[month - 1];

	if (day > daysInMonthForInput) {
		throw new KronoParseError(
			`${year}-${month}-${day}`,
			`Invalid day ${day} for month ${month} in year ${year}`
		);
	}
}

// ==========================================
// TIMEZONE UTILITIES
// ==========================================

/**
 * Timezone utilities for handling IANA timezone operations
 * @namespace zone
 */
export const zone = {
	/**
	 * Validates if a timezone name is valid
	 * @param {string} zoneName
	 * @returns {boolean}
	 */
	isValid(zoneName: string): boolean {
		if (_validZoneCache.has(zoneName)) return true;

		try {
			new Intl.DateTimeFormat("en", { timeZone: zoneName }).format(
				new Date()
			);
			_validZoneCache.add(zoneName);
			return true;
		} catch {
			return false;
		}
	},

	/**
	 * Gets the timezone offset in milliseconds for a given timestamp
	 * @param {number} timestamp
	 * @param {string} zoneName
	 * @returns {number}
	 */
	getOffset(timestamp: number, zoneName: string): number {
		if (zoneName === "UTC") return 0;

		let zoneCache = _offsetCache.get(zoneName);
		if (zoneCache?.has(timestamp)) {
			return zoneCache.get(timestamp) ?? 0;
		}

		try {
			const utcDate = new Date(timestamp);
			const formatter = new Intl.DateTimeFormat("en-US", {
				timeZone: zoneName,
				year: "numeric",
				month: "numeric",
				day: "numeric",
				hour: "numeric",
				minute: "numeric",
				second: "numeric",
				hourCycle: "h23",
			});

			const parts = formatter.formatToParts(utcDate);
			const partValue = (type: Intl.DateTimeFormatPartTypes) =>
				Number.parseInt(
					parts.find((p) => p.type === type)?.value ?? "0",
					10
				);

			const localEquivalentInUtc = Date.UTC(
				partValue("year"),
				partValue("month") - 1,
				partValue("day"),
				partValue("hour"),
				partValue("minute"),
				partValue("second"),
				utcDate.getUTCMilliseconds()
			);

			const offset = timestamp - localEquivalentInUtc;

			if (!zoneCache) {
				zoneCache = new Map();
				_offsetCache.set(zoneName, zoneCache);
			}
			zoneCache.set(timestamp, offset);

			return offset;
		} catch (error) {
			console.warn(`Failed to calculate offset for ${zoneName}:`, error);
			return 0;
		}
	},

	/**
	 * Gets the timezone offset in minutes for a given timestamp
	 * @param {number} timestamp
	 * @param {string} zoneName
	 * @returns {number}
	 */
	getOffsetInMinutes(timestamp: number, zoneName: string): number {
		return this.getOffset(timestamp, zoneName) / MS_PER_MINUTE;
	},

	/**
	 * Converts a timestamp from one timezone to another
	 * @param {number} timestamp
	 * @param {string} fromZone
	 * @param {string} toZone
	 * @returns {number}
	 */
	convertToZone(timestamp: number, fromZone: string, toZone: string): number {
		if (fromZone === toZone) return timestamp;

		const fromOffset = this.getOffset(timestamp, fromZone);
		const toOffset = this.getOffset(timestamp, toZone);

		return timestamp + (fromOffset - toOffset);
	},

	/**
	 * Gets the system's default timezone
	 * @returns {string}
	 */
	getSystemZone(): string {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	},

	/**
	 * Handles ambiguous times during DST transitions
	 * @param {number} timestamp
	 * @param {string} zoneName
	 * @param {DSTPreference} [preference="later"]
	 * @returns {number}
	 */
	handleDSTAmbiguity(
		timestamp: number,
		zoneName: string,
		preference: DSTPreference = "later"
	): number {
		if (zoneName === "UTC") return timestamp;

		// Check if this time falls in a DST transition
		const before = timestamp - MS_PER_HOUR;
		const after = timestamp + MS_PER_HOUR;

		const offsetBefore = this.getOffset(before, zoneName);
		const offsetAfter = this.getOffset(after, zoneName);

		// If offsets are different, we're in a transition period
		if (offsetBefore !== offsetAfter) {
			return preference === "later" ? timestamp : timestamp - MS_PER_HOUR;
		}

		return timestamp;
	},

	/**
	 * Adds time to a timestamp while respecting DST transitions
	 * @param {number} timestamp
	 * @param {number} amount
	 * @param {TimeUnit} unit
	 * @param {string} zoneName
	 * @returns {number}
	 */
	addTimeWithDST(
		timestamp: number,
		amount: number,
		unit: TimeUnit,
		zoneName: string
	): number {
		// Fast path for units with fixed multipliers
		if (unit in UNIT_MULTIPLIERS && unit !== "day" && unit !== "week") {
			const delta =
				amount *
				UNIT_MULTIPLIERS[unit as keyof typeof UNIT_MULTIPLIERS];
			return timestamp + delta;
		}

		// Timezone-aware calculation for larger units
		const zonedTime = timestamp - this.getOffset(timestamp, zoneName);
		const zonedDate = new Date(zonedTime);

		switch (unit) {
			case "year":
				zonedDate.setUTCFullYear(zonedDate.getUTCFullYear() + amount);
				break;
			case "month": {
				const targetMonth = zonedDate.getUTCMonth() + amount;
				const targetYear =
					zonedDate.getUTCFullYear() + Math.floor(targetMonth / 12);
				const finalMonth = ((targetMonth % 12) + 12) % 12;
				const originalDay = zonedDate.getUTCDate();
				zonedDate.setUTCFullYear(targetYear, finalMonth, 1);
				const lastDayOfTargetMonth = new Date(
					targetYear,
					finalMonth + 1,
					0
				).getUTCDate();
				const finalDay = Math.min(originalDay, lastDayOfTargetMonth);
				zonedDate.setUTCDate(finalDay);
				break;
			}
			case "week":
				zonedDate.setUTCDate(zonedDate.getUTCDate() + amount * 7);
				break;
			case "day":
				zonedDate.setUTCDate(zonedDate.getUTCDate() + amount);
				break;
			case "hour":
				zonedDate.setUTCHours(zonedDate.getUTCHours() + amount);
				break;
			case "minute":
				zonedDate.setUTCMinutes(zonedDate.getUTCMinutes() + amount);
				break;
			case "second":
				zonedDate.setUTCSeconds(zonedDate.getUTCSeconds() + amount);
				break;
			case "millisecond":
				zonedDate.setUTCMilliseconds(
					zonedDate.getUTCMilliseconds() + amount
				);
				break;
		}

		const result =
			zonedDate.getTime() + this.getOffset(zonedDate.getTime(), zoneName);
		return this.handleDSTAmbiguity(result, zoneName);
	},
} as const;

// ==========================================
// MAIN KRONO CLASS
// ==========================================

/**
 * Main Krono class for immutable date/time operations
 * @class
 */
export class Krono {
	private readonly _time: number;
	private readonly _locale: string;
	private readonly _zone: string;
	private readonly _debug: boolean;
	private readonly _memoizedValues = new Map<string, unknown>();

	/**
	 * Private constructor - use static create method or factory functions
	 */
	private constructor(
		time: number,
		locale = "en-GB",
		zoneName = "UTC",
		debug = false
	) {
		validateTimestamp(time);

		if (zoneName !== "UTC" && !zone.isValid(zoneName)) {
			throw new KronoTimezoneError(zoneName);
		}

		this._time = time;
		this._locale = locale;
		this._zone = zoneName;
		this._debug = debug;
	}

	/**
	 * Debug logging helper
	 */
	private debug(message: string, ...args: unknown[]): void {
		if (this._debug) {
			console.log(`[Krono Debug] ${message}`, ...args);
		}
	}

	/**
	 * Memoization helper for expensive operations
	 */
	private memoize<T>(key: string, fn: () => T): T {
		if (this._memoizedValues.has(key)) {
			return this._memoizedValues.get(key) as T;
		}
		const result = fn();
		this._memoizedValues.set(key, result);
		return result;
	}

	/**
	 * Creates a new Krono instance
	 * @param {string|number|Date|Krono} [input]
	 * @param {KronoOptions} [options]
	 * @returns {Krono}
	 */
	static create(
		input?: string | number | Date | Krono,
		options?: KronoOptions
	): Krono {
		const locale = options?.locale ?? "en-GB";
		const zoneName = options?.zone ?? "UTC";
		const debug = options?.debug ?? false;
		const time = Krono._parseToTime(input, zoneName);
		return new Krono(time, locale, zoneName, debug);
	}

	/**
	 * Parses natural language patterns
	 */
	private static _parseNaturalLanguage(
		str: string,
		defaultZone: string
	): number | null {
		const now = Date.now();
		const currentKrono = new Krono(now, "en-GB", defaultZone);

		for (const { pattern, handler } of NATURAL_PATTERNS) {
			const match = str.match(pattern);
			if (match) {
				switch (handler) {
					case "nextWeekday": {
						const weekdayName =
							match[1].toLowerCase() as keyof typeof WEEKDAY_MAP;
						const targetDay = WEEKDAY_MAP[weekdayName];
						const currentDay = currentKrono.dayOfWeek;
						const daysToAdd =
							targetDay > currentDay
								? targetDay - currentDay
								: 7 - currentDay + targetDay;
						return currentKrono.add(daysToAdd, "day").startOf("day")
							._time;
					}
					case "lastWeekday": {
						const weekdayName =
							match[1].toLowerCase() as keyof typeof WEEKDAY_MAP;
						const targetDay = WEEKDAY_MAP[weekdayName];
						const currentDay = currentKrono.dayOfWeek;
						const daysToSubtract =
							currentDay > targetDay
								? currentDay - targetDay
								: currentDay + 7 - targetDay;
						return currentKrono
							.subtract(daysToSubtract, "day")
							.startOf("day")._time;
					}
					case "startOf": {
						const unit = match[2].toLowerCase() as TimeUnit;
						return currentKrono.startOf(unit)._time;
					}
					case "endOf": {
						const unit = match[2].toLowerCase() as TimeUnit;
						return currentKrono.endOf(unit)._time;
					}
				}
			}
		}

		return null;
	}

	/**
	 * Parses various input types to Unix timestamp
	 */
	private static _parseToTime(
		input?: string | number | Date | Krono,
		defaultZone = "UTC"
	): number {
		if (input == null) return Date.now();
		if (input instanceof Krono) return input._time;
		if (input instanceof Date) return input.getTime();
		if (typeof input === "number") {
			validateTimestamp(input);
			return input;
		}

		const str = input.trim();
		const now = Date.now();

		if (str.toLowerCase() === "now") return now;

		// Try natural language parsing first
		const naturalResult = Krono._parseNaturalLanguage(str, defaultZone);
		if (naturalResult !== null) return naturalResult;

		// Parse relative time expressions
		const match = str.toLowerCase().match(RELATIVE_REGEX);
		if (match) {
			const amount = Number.parseInt(match[1], 10);
			const unit = match[2] as TimeUnit;
			const isAgo = str.includes("ago");
			const finalAmount = isAgo ? -amount : amount;
			return zone.addTimeWithDST(now, finalAmount, unit, defaultZone);
		}

		// Stricter ISO parsing with validation
		const isoMatch = str.match(ISO_WITH_ZONE_REGEX);
		if (isoMatch) {
			const year = Number.parseInt(isoMatch[1], 10);
			const month = Number.parseInt(isoMatch[2], 10);
			const day = Number.parseInt(isoMatch[3], 10);

			validateDateComponents(year, month, day);
		}

		// If zone is UTC, be explicit about ambiguous date-time strings
		if (
			defaultZone === "UTC" &&
			/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(str)
		) {
			const d = new Date(`${str.replace(" ", "T")}Z`);
			if (!Number.isNaN(d.getTime())) return d.getTime();
		}

		// Fallback for everything else
		const parsed = new Date(str);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed.getTime();
		}

		throw new KronoParseError(str, "Unrecognized format");
	}

	/**
	 * Gets cached zone time to avoid repeated calculations
	 */
	private _getZoneTime(): Date {
		return this.memoize(`zoneTime_${this._time}_${this._zone}`, () => {
			if (this._zone === "UTC") {
				return new Date(this._time);
			}

			const offset = zone.getOffset(this._time, this._zone);
			const zoneTime = this._time - offset;
			return new Date(zoneTime);
		});
	}

	// ==========================================
	// MANIPULATION METHODS
	// ==========================================

	/**
	 * Adds time to this instance
	 * @param {number} amount
	 * @param {TimeUnit} unit
	 * @returns {Krono}
	 */
	add(amount: number, unit: TimeUnit): Krono {
		this.debug(`Adding ${amount} ${unit}(s) to ${this.toISOString()}`);
		const newTime = zone.addTimeWithDST(
			this._time,
			amount,
			unit,
			this._zone
		);
		return new Krono(newTime, this._locale, this._zone, this._debug);
	}

	/**
	 * Subtracts time from this instance
	 * @param {number} amount
	 * @param {TimeUnit} unit
	 * @returns {Krono}
	 */
	subtract(amount: number, unit: TimeUnit): Krono {
		return this.add(-amount, unit);
	}

	/**
	 * Sets a specific time unit value
	 * @param {TimeUnit} unit
	 * @param {number} value
	 * @returns {Krono}
	 */
	set(unit: TimeUnit, value: number): Krono {
		this.debug(`Setting ${unit} to ${value}`);
		const date = this._getZoneTime();
		const newDate = new Date(date);

		switch (unit) {
			case "year":
				newDate.setUTCFullYear(value);
				break;
			case "month":
				newDate.setUTCMonth(value - 1);
				break;
			case "day":
				newDate.setUTCDate(value);
				break;
			case "hour":
				newDate.setUTCHours(value);
				break;
			case "minute":
				newDate.setUTCMinutes(value);
				break;
			case "second":
				newDate.setUTCSeconds(value);
				break;
			case "millisecond":
				newDate.setUTCMilliseconds(value);
				break;
			case "week":
				throw new KronoError("Cannot set week directly");
			default:
				throw new KronoError(`Cannot set unit: ${unit}`);
		}

		return Krono.create(newDate, {
			zone: this._zone,
			locale: this._locale,
			debug: this._debug,
		});
	}

	/**
	 * Applies multiple operations in sequence
	 * @param {...Array<(k: Krono) => Krono>} operations
	 * @returns {Krono}
	 */
	pipe(...operations: Array<(k: Krono) => Krono>): Krono {
		this.debug(`Applying ${operations.length} operations in sequence`);
		return operations.reduce<Krono>((acc, op) => op(acc), this);
	}

	/**
	 * Returns a new instance set to the start of the specified time unit
	 * @param {TimeUnit} unit
	 * @returns {Krono}
	 */
	startOf(unit: TimeUnit): Krono {
		if (this._zone === "UTC") {
			const date = new Date(this._time);
			switch (unit) {
				case "year":
					date.setUTCMonth(0, 1);
					date.setUTCHours(0, 0, 0, 0);
					break;
				case "month":
					date.setUTCDate(1);
					date.setUTCHours(0, 0, 0, 0);
					break;
				case "week": {
					const dayOfWeek = date.getUTCDay();
					const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
					date.setUTCDate(date.getUTCDate() - daysToSubtract);
					date.setUTCHours(0, 0, 0, 0);
					break;
				}
				case "day":
					date.setUTCHours(0, 0, 0, 0);
					break;
				case "hour":
					date.setUTCMinutes(0, 0, 0);
					break;
				case "minute":
					date.setUTCSeconds(0, 0);
					break;
				case "second":
					date.setUTCMilliseconds(0);
					break;
				case "millisecond":
					break;
			}
			return new Krono(
				date.getTime(),
				this._locale,
				this._zone,
				this._debug
			);
		}

		const zonedDate = this._getZoneTime();
		const modifiedDate = new Date(
			Date.UTC(
				zonedDate.getUTCFullYear(),
				zonedDate.getUTCMonth(),
				zonedDate.getUTCDate(),
				zonedDate.getUTCHours(),
				zonedDate.getUTCMinutes(),
				zonedDate.getUTCSeconds(),
				zonedDate.getUTCMilliseconds()
			)
		);

		switch (unit) {
			case "year":
				modifiedDate.setUTCMonth(0, 1);
				modifiedDate.setUTCHours(0, 0, 0, 0);
				break;
			case "month":
				modifiedDate.setUTCDate(1);
				modifiedDate.setUTCHours(0, 0, 0, 0);
				break;
			case "week": {
				const dayOfWeek = modifiedDate.getUTCDay();
				const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
				modifiedDate.setUTCDate(
					modifiedDate.getUTCDate() - daysToSubtract
				);
				modifiedDate.setUTCHours(0, 0, 0, 0);
				break;
			}
			case "day":
				modifiedDate.setUTCHours(0, 0, 0, 0);
				break;
			case "hour":
				modifiedDate.setUTCMinutes(0, 0, 0);
				break;
			case "minute":
				modifiedDate.setUTCSeconds(0, 0);
				break;
			case "second":
				modifiedDate.setUTCMilliseconds(0);
				break;
			case "millisecond":
				break;
		}

		const year = modifiedDate.getUTCFullYear();
		const month = modifiedDate.getUTCMonth() + 1;
		const day = modifiedDate.getUTCDate();
		const hour = modifiedDate.getUTCHours();
		const minute = modifiedDate.getUTCMinutes();
		const second = modifiedDate.getUTCSeconds();
		const millisecond = modifiedDate.getUTCMilliseconds();

		const dateString = `${year}-${String(month).padStart(2, "0")}-${String(
			day
		).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(
			minute
		).padStart(2, "0")}:${String(second).padStart(2, "0")}.${String(
			millisecond
		).padStart(3, "0")}`;

		return Krono.create(dateString, {
			zone: this._zone,
			locale: this._locale,
			debug: this._debug,
		});
	}

	/**
	 * Returns a new instance set to the end of the specified time unit
	 * @param {TimeUnit} unit
	 * @returns {Krono}
	 */
	endOf(unit: TimeUnit): Krono {
		return this.add(1, unit).startOf(unit).subtract(1, "millisecond");
	}

	// ==========================================
	// TIMEZONE CONVERSION METHODS
	// ==========================================

	/**
	 * Converts this instance to a different timezone
	 * @param {string} zoneName
	 * @returns {Krono}
	 */
	tz(zoneName: string): Krono {
		return new Krono(this._time, this._locale, zoneName, this._debug);
	}

	/**
	 * Converts this instance to UTC timezone
	 * @returns {Krono}
	 */
	utc(): Krono {
		return new Krono(this._time, this._locale, "UTC", this._debug);
	}

	/**
	 * Converts this instance to the system's local timezone
	 * @returns {Krono}
	 */
	local(): Krono {
		return new Krono(
			this._time,
			this._locale,
			zone.getSystemZone(),
			this._debug
		);
	}

	/**
	 * Returns the year in the current timezone
	 * @returns {number}
	 */
	get year(): number {
		return this.memoize("year", () => {
			if (this._zone === "UTC")
				return new Date(this._time).getUTCFullYear();
			return this._getZoneTime().getUTCFullYear();
		});
	}

	/**
	 * Returns the month (1-12) in the current timezone
	 * @returns {number}
	 */
	get month(): number {
		return this.memoize("month", () => {
			if (this._zone === "UTC")
				return new Date(this._time).getUTCMonth() + 1;
			return this._getZoneTime().getUTCMonth() + 1;
		});
	}

	/**
	 * Returns the day of the month in the current timezone
	 * @returns {number}
	 */
	get day(): number {
		return this.memoize("day", () => {
			if (this._zone === "UTC") return new Date(this._time).getUTCDate();
			return this._getZoneTime().getUTCDate();
		});
	}

	/**
	 * Returns the hour in the current timezone
	 * @returns {number}
	 */
	get hour(): number {
		return this.memoize("hour", () => {
			if (this._zone === "UTC") return new Date(this._time).getUTCHours();
			return this._getZoneTime().getUTCHours();
		});
	}

	/**
	 * Returns the minute in the current timezone
	 * @returns {number}
	 */
	get minute(): number {
		return this.memoize("minute", () => {
			if (this._zone === "UTC")
				return new Date(this._time).getUTCMinutes();
			return this._getZoneTime().getUTCMinutes();
		});
	}

	/**
	 * Returns the second in the current timezone
	 * @returns {number}
	 */
	get second(): number {
		return this.memoize("second", () => {
			if (this._zone === "UTC")
				return new Date(this._time).getUTCSeconds();
			return this._getZoneTime().getUTCSeconds();
		});
	}

	/**
	 * Returns the millisecond in the current timezone
	 * @returns {number}
	 */
	get millisecond(): number {
		return this.memoize("millisecond", () => {
			if (this._zone === "UTC")
				return new Date(this._time).getUTCMilliseconds();
			return this._getZoneTime().getUTCMilliseconds();
		});
	}

	/**
	 * Returns the day of the week (0=Sunday, 6=Saturday)
	 * @returns {number}
	 */
	get dayOfWeek(): number {
		return this.memoize("dayOfWeek", () => {
			if (this._zone === "UTC") return new Date(this._time).getUTCDay();
			return this._getZoneTime().getUTCDay();
		});
	}

	/**
	 * Returns the day of the year (1-366)
	 * @returns {number}
	 */
	get dayOfYear(): number {
		return this.memoize("dayOfYear", () => {
			const start = this.startOf("year");
			return Math.ceil((this._time - start._time) / MS_PER_DAY) + 1;
		});
	}

	/**
	 * Returns the ISO week of the year
	 * @returns {number}
	 */
	get weekOfYear(): number {
		return this.memoize("weekOfYear", () => {
			const start = this.startOf("year");
			const startOfWeek = start.startOf("week");
			return Math.ceil((this._time - startOfWeek._time) / MS_PER_WEEK);
		});
	}

	/**
	 * Returns the IANA timezone name
	 * @returns {string}
	 */
	get zoneName(): string {
		return this._zone;
	}

	/**
	 * Returns the timezone abbreviation
	 * @returns {string}
	 */
	get zoneAbbr(): string {
		return this.memoize("zoneAbbr", () => {
			try {
				const formatter = new Intl.DateTimeFormat("en", {
					timeZone: this._zone,
					timeZoneName: "short",
				});
				const parts = formatter.formatToParts(this._time);
				return (
					parts.find((part) => part.type === "timeZoneName")?.value ||
					this._zone
				);
			} catch {
				return this._zone;
			}
		});
	}

	/**
	 * Returns true if this date is in daylight saving time
	 * @returns {boolean}
	 */
	get isDST(): boolean {
		return this.memoize("isDST", () => {
			const jan = new Date(this.year, 0, 1);
			const jul = new Date(this.year, 6, 1);

			const janOffset = zone.getOffsetInMinutes(
				jan.getTime(),
				this._zone
			);
			const julOffset = zone.getOffsetInMinutes(
				jul.getTime(),
				this._zone
			);
			const currentOffset = zone.getOffsetInMinutes(
				this._time,
				this._zone
			);

			return currentOffset === Math.min(janOffset, julOffset);
		});
	}

	// ==========================================
	// COMPARISON METHODS
	// ==========================================

	/**
	 * Returns true if this date is before another
	 * @param {Krono} other
	 * @returns {boolean}
	 */
	isBefore(other: Krono): boolean {
		return this._time < other._time;
	}

	/**
	 * Returns true if this date is after another
	 * @param {Krono} other
	 * @returns {boolean}
	 */
	isAfter(other: Krono): boolean {
		return this._time > other._time;
	}

	/**
	 * Returns true if this date is the same as another, optionally by unit
	 * @param {Krono} other
	 * @param {TimeUnit} [unit]
	 * @returns {boolean}
	 */
	isSame(other: Krono, unit?: TimeUnit): boolean {
		if (!unit) return this._time === other._time;
		return this.startOf(unit)._time === other.startOf(unit)._time;
	}

	/**
	 * Returns true if this date is the same day as another
	 * @param {Krono} other
	 * @returns {boolean}
	 */
	isSameDay(other: Krono): boolean {
		return this.isSame(other, "day");
	}

	/**
	 * Returns true if this date is the same month as another
	 * @param {Krono} other
	 * @returns {boolean}
	 */
	isSameMonth(other: Krono): boolean {
		return this.isSame(other, "month");
	}

	/**
	 * Returns true if this date is the same year as another
	 * @param {Krono} other
	 * @returns {boolean}
	 */
	isSameYear(other: Krono): boolean {
		return this.isSame(other, "year");
	}

	/**
	 * Returns true if this date is between two others
	 * @param {Krono} start
	 * @param {Krono} end
	 * @param {boolean} [inclusive=true]
	 * @returns {boolean}
	 */
	isBetween(start: Krono, end: Krono, inclusive = true): boolean {
		if (inclusive) {
			return this._time >= start._time && this._time <= end._time;
		}
		return this._time > start._time && this._time < end._time;
	}

	/**
	 * Returns true if this year is a leap year
	 * @returns {boolean}
	 */
	isLeapYear(): boolean {
		return this.memoize("isLeapYear", () => {
			const year = this.year;
			return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
		});
	}

	/**
	 * Returns true if this date is a weekend
	 * @returns {boolean}
	 */
	isWeekend(): boolean {
		const day = this.dayOfWeek;
		return day === 0 || day === 6;
	}

	/**
	 * Returns true if this date is a weekday
	 * @returns {boolean}
	 */
	isWeekday(): boolean {
		return !this.isWeekend();
	}

	/**
	 * Returns the number of days in the current month
	 * @returns {number}
	 */
	daysInMonth(): number {
		return this.memoize("daysInMonth", () => {
			const month = this.month;
			if (month === 2 && this.isLeapYear()) {
				return 29;
			}
			return DAYS_IN_MONTH[month - 1];
		});
	}

	/**
	 * Returns the difference between this and another date in the given unit
	 * @param {Krono} other
	 * @param {TimeUnit} [unit="millisecond"]
	 * @returns {number}
	 */
	diff(other: Krono, unit: TimeUnit = "millisecond"): number {
		const delta = Math.abs(this._time - other._time);

		if (unit in UNIT_MULTIPLIERS) {
			return Math.floor(
				delta / UNIT_MULTIPLIERS[unit as keyof typeof UNIT_MULTIPLIERS]
			);
		}

		const [earlier, later] =
			this._time < other._time ? [this, other] : [other, this];

		if (unit === "year") {
			return later.year - earlier.year;
		}
		if (unit === "month") {
			return (
				(later.year - earlier.year) * 12 + (later.month - earlier.month)
			);
		}

		return 0;
	}

	// ==========================================
	// HUMAN-FRIENDLY FORMATTING
	// ==========================================

	/**
	 * Returns a human-friendly relative time string from now
	 * @returns {string}
	 */
	fromNow(): string {
		const now = Date.now();
		const diffInSeconds = Math.abs(now - this._time) / 1000;
		const isPast = this._time < now;

		if (diffInSeconds < 45) {
			return "a few seconds ago";
		}

		for (const { unit, threshold, divisor } of RELATIVE_TIME_THRESHOLDS) {
			if (diffInSeconds < threshold) {
				const value = Math.round(diffInSeconds / divisor);
				const unitName = value === 1 ? unit : `${unit}s`;
				return isPast
					? `${value} ${unitName} ago`
					: `in ${value} ${unitName}`;
			}
		}

		return isPast ? "a long time ago" : "in a long time";
	}

	/**
	 * Alias for fromNow()
	 * @returns {string}
	 */
	toNow(): string {
		return this.fromNow();
	}

	/**
	 * Returns a calendar-style string relative to a reference time
	 * @param {Krono} [referenceTime]
	 * @returns {string}
	 */
	calendar(referenceTime?: Krono): string {
		const reference = (referenceTime ?? krono()).tz(this._zone);

		const thisStart = this.startOf("day").valueOf();
		const refStart = reference.startOf("day").valueOf();
		const dayDifference = Math.round((thisStart - refStart) / MS_PER_DAY);

		const timeFormat: Intl.DateTimeFormatOptions = {
			hour: "numeric",
			minute: "2-digit",
		};

		if (dayDifference === 0) {
			return `Today at ${this.format(timeFormat)}`;
		}
		if (dayDifference === 1) {
			return `Tomorrow at ${this.format(timeFormat)}`;
		}
		if (dayDifference === -1) {
			return `Yesterday at ${this.format(timeFormat)}`;
		}
		if (dayDifference > 1 && dayDifference < 7) {
			const dayName = this.format({ weekday: "long" });
			return `${dayName} at ${this.format(timeFormat)}`;
		}
		if (dayDifference < -1 && dayDifference > -7) {
			const dayName = this.format({ weekday: "long" });
			return `Last ${dayName} at ${this.format(timeFormat)}`;
		}

		return this.format({
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	}

	/**
	 * Returns a human-friendly distance string to another date
	 * @param {Krono} other
	 * @returns {string}
	 */
	formatDistance(other: Krono): string {
		const diffInSeconds = Math.abs(this._time - other._time) / 1000;

		for (const { unit, threshold, divisor } of RELATIVE_TIME_THRESHOLDS) {
			if (diffInSeconds < threshold) {
				const value = Math.round(diffInSeconds / divisor);
				const unitName = value === 1 ? unit : `${unit}s`;
				return value === 1
					? `about 1 ${unit}`
					: `about ${value} ${unitName}`;
			}
		}

		return "a very long time";
	}

	/**
	 * Gets a value for a specific time unit
	 * @param {TimeUnit} unit
	 * @returns {number}
	 */
	get(unit: TimeUnit): number {
		switch (unit) {
			case "year":
				return this.year;
			case "month":
				return this.month;
			case "day":
				return this.day;
			case "hour":
				return this.hour;
			case "minute":
				return this.minute;
			case "second":
				return this.second;
			case "millisecond":
				return this.millisecond;
			case "week":
				return this.weekOfYear;
			default:
				throw new KronoError(`Invalid unit: ${unit}`);
		}
	}

	/**
	 * Formats the date using Intl.DateTimeFormat
	 * @param {Intl.DateTimeFormatOptions} [options]
	 * @param {string} [locale]
	 * @returns {string}
	 */
	format(options?: Intl.DateTimeFormatOptions, locale?: string): string {
		return new Intl.DateTimeFormat(locale ?? this._locale, {
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: this._zone,
			...options,
		}).format(this._time);
	}

	/**
	 * Returns a native Date object
	 * @returns {Date}
	 */
	toDate(): Date {
		return new Date(this._time);
	}

	/**
	 * Returns an ISO8601 string (with timezone offset if not UTC)
	 * @returns {string}
	 */
	toISOString(): string {
		if (this._zone === "UTC") {
			return new Date(this._time).toISOString();
		}

		const zoneTime = this._time - zone.getOffset(this._time, this._zone);
		const date = new Date(zoneTime);
		const isoString = date.toISOString();

		const rawOffsetMinutes = zone.getOffsetInMinutes(
			this._time,
			this._zone
		);
		const isoOffsetMinutes = rawOffsetMinutes * -1;
		const sign = isoOffsetMinutes >= 0 ? "+" : "-";
		const absOffsetMinutes = Math.abs(isoOffsetMinutes);
		const offsetHours = Math.floor(absOffsetMinutes / 60);
		const offsetMins = absOffsetMinutes % 60;
		const offset = `${sign}${offsetHours
			.toString()
			.padStart(2, "0")}:${offsetMins.toString().padStart(2, "0")}`;

		return isoString.replace("Z", offset);
	}

	/**
	 * Returns the primitive value (timestamp)
	 * @returns {number}
	 */
	valueOf(): number {
		return this._time;
	}

	/**
	 * Returns a string representation (ISO8601)
	 * @returns {string}
	 */
	toString(): string {
		return this.toISOString();
	}

	/**
	 * Returns a JSON representation (ISO8601)
	 * @returns {string}
	 */
	toJSON(): string {
		return this.toISOString();
	}

	/**
	 * Returns the minimum Krono from a list
	 * @param {...Krono[]} dates
	 * @returns {Krono}
	 * @throws {KronoError}
	 */
	static min(...dates: Krono[]): Krono {
		if (dates.length === 0) throw new KronoError("No dates provided");
		return dates.reduce((min, current) =>
			current.isBefore(min) ? current : min
		);
	}

	/**
	 * Returns the maximum Krono from a list
	 * @param {...Krono[]} dates
	 * @returns {Krono}
	 * @throws {KronoError}
	 */
	static max(...dates: Krono[]): Krono {
		if (dates.length === 0) throw new KronoError("No dates provided");
		return dates.reduce((max, current) =>
			current.isAfter(max) ? current : max
		);
	}

	/**
	 * Returns true if value is a Krono instance
	 * @param {unknown} value
	 * @returns {boolean}
	 */
	static isKrono(value: unknown): value is Krono {
		return value instanceof Krono;
	}

	/**
	 * Returns the system's default timezone
	 * @returns {string}
	 */
	static getSystemTimeZone(): string {
		return zone.getSystemZone();
	}

	/**
	 * Returns true if the timezone is valid
	 * @param {string} zoneName
	 * @returns {boolean}
	 */
	static isValidTimeZone(zoneName: string): boolean {
		return zone.isValid(zoneName);
	}
}

// ==========================================
// FACTORY FUNCTIONS & CONVENIENCE EXPORTS
// ==========================================

/**
 * Factory function to create a Krono instance
 * @param {string|number|Date|Krono} [input]
 * @param {KronoOptions} [options]
 * @returns {Krono}
 */
export const krono = (
	input?: string | number | Date | Krono,
	options?: KronoOptions
): Krono => Krono.create(input, options);

/**
 * Returns the current date/time in the specified timezone (or system zone)
 * @param {string} [zoneName]
 * @returns {Krono}
 */
export const now = (zoneName?: string): Krono =>
	krono(undefined, { zone: zoneName ?? zone.getSystemZone() });

/**
 * Returns the start of today in the specified timezone (or system zone)
 * @param {string} [zoneName]
 * @returns {Krono}
 */
export const today = (zoneName?: string): Krono => {
	const z = zoneName ?? zone.getSystemZone();
	return krono(undefined, { zone: z }).startOf("day");
};

/**
 * Returns the start of tomorrow in the specified timezone (or system zone)
 * @param {string} [zoneName]
 * @returns {Krono}
 */
export const tomorrow = (zoneName?: string): Krono => {
	const z = zoneName ?? zone.getSystemZone();
	return krono(undefined, { zone: z }).startOf("day").add(1, "day");
};

/**
 * Returns the start of yesterday in the specified timezone (or system zone)
 * @param {string} [zoneName]
 * @returns {Krono}
 */
export const yesterday = (zoneName?: string): Krono => {
	const z = zoneName ?? zone.getSystemZone();
	return krono(undefined, { zone: z }).startOf("day").subtract(1, "day");
};

/**
 * Returns a set of convenience functions for a specific timezone
 * @param {string} zoneName
 * @returns {{now: () => Krono, today: () => Krono, tomorrow: () => Krono, yesterday: () => Krono}}
 */
export const tz = (zoneName: string) => ({
	now: () => now(zoneName),
	today: () => today(zoneName),
	tomorrow: () => tomorrow(zoneName),
	yesterday: () => yesterday(zoneName),
});

/**
 * UTC convenience functions
 * @readonly
 */
export const utc = {
	now: () => now("UTC"),
	today: () => today("UTC"),
	tomorrow: () => tomorrow("UTC"),
	yesterday: () => yesterday("UTC"),
} as const;

/**
 * Local (system timezone) convenience functions
 * @readonly
 */
export const local = {
	now: () => now(),
	today: () => today(),
	tomorrow: () => tomorrow(),
	yesterday: () => yesterday(),
} as const;

/**
 * Returns a Duration in milliseconds for the given amount and unit
 * @param {number} amount
 * @param {TimeUnit} unit
 * @returns {Duration}
 * @throws {KronoError}
 */
export const duration = (amount: number, unit: TimeUnit): Duration => {
	if (unit in UNIT_MULTIPLIERS) {
		return (amount *
			UNIT_MULTIPLIERS[
				unit as keyof typeof UNIT_MULTIPLIERS
			]) as Duration;
	}
	throw new KronoError(`Duration not supported for unit: ${unit}`);
};

/**
 * Returns true if value is a Krono instance
 * @param {unknown} value
 * @returns {boolean}
 */
export const isKrono = (value: unknown): value is Krono => Krono.isKrono(value);

/**
 * Returns true if the timezone is valid
 * @param {string} zoneName
 * @returns {boolean}
 */
export const isValidTimeZone = (zoneName: string): boolean =>
	zone.isValid(zoneName);

/**
 * Returns the system's default timezone
 * @returns {string}
 */
export const getSystemTimeZone = (): string => zone.getSystemZone();

/**
 * Library version
 * @type {string}
 */
export const VERSION = "0.1.0";

/**
 * Default export: krono factory function
 */
export default krono;
