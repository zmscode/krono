# krono 🔥 ⏳

A blazingly fast, lightweight, and timezone-aware date/time library for JavaScript and TypeScript.

## Features

- Immutable, chainable API
- Timezone-aware (IANA timezones)
- Natural language parsing (`"next monday"`, `"2 days ago"`, etc.)
- Human-friendly formatting (`fromNow`, `calendar`, etc.)
- Fast, memory-efficient, and dependency-free
- TypeScript-first with strong types

## Installation

```bash
npm install kronolib
```

## Usage

```typescript
import krono, { now, today, tomorrow, yesterday, tz, utc, local } from "kronolib";

// Create a Krono instance for now
const k = krono();

// Parse natural language
const nextMonday = krono("next monday");

// Timezone-aware
const inNY = krono("2024-06-01T12:00", { zone: "America/New_York" });

// Add/subtract time
const nextWeek = k.add(1, "week");
const lastMonth = k.subtract(1, "month");

// Formatting
console.log(k.format()); // e.g. "1 June 2024"
console.log(k.fromNow()); // e.g. "a few seconds ago"
console.log(k.calendar()); // e.g. "Today at 14:00"

// Timezone conversion
const utcTime = k.utc();
const localTime = k.local();
const tokyoTime = k.tz("Asia/Tokyo");
```

## API

### Factory Functions

- `krono(input?, options?)`: Create a Krono instance.
- `now(zoneName?)`: Current time in a timezone.
- `today(zoneName?)`: Start of today in a timezone.
- `tomorrow(zoneName?)`: Start of tomorrow in a timezone.
- `yesterday(zoneName?)`: Start of yesterday in a timezone.
- `tz(zoneName)`: Convenience functions for a timezone.
- `utc`, `local`: Convenience objects for UTC and system timezone.

### Krono Instance Methods

- `.add(amount, unit)`: Add time.
- `.subtract(amount, unit)`: Subtract time.
- `.set(unit, value)`: Set a time unit.
- `.startOf(unit)`: Start of a unit.
- `.endOf(unit)`: End of a unit.
- `.tz(zoneName)`: Convert to timezone.
- `.utc()`: Convert to UTC.
- `.local()`: Convert to system timezone.
- `.format(options?, locale?)`: Format date.
- `.fromNow()`, `.toNow()`: Relative time string.
- `.calendar(reference?)`: Calendar-style string.
- `.diff(other, unit?)`: Difference in units.
- `.isBefore(other)`, `.isAfter(other)`, `.isSame(other, unit?)`, etc.

### Static Methods

- `Krono.min(...dates)`, `Krono.max(...dates)`
- `Krono.isKrono(value)`
- `Krono.getSystemTimeZone()`
- `Krono.isValidTimeZone(zoneName)`

### Utilities

- `duration(amount, unit)`: Get a duration in ms.
- `isKrono(value)`: Type guard.
- `isValidTimeZone(zoneName)`: Validate timezone.
- `getSystemTimeZone()`: Get system timezone.

## Time Units

- `"millisecond"`, `"second"`, `"minute"`, `"hour"`, `"day"`, `"week"`, `"month"`, `"year"`

## Timezone Support

Krono uses the IANA timezone database via `Intl.DateTimeFormat`. All timezone names supported by your JS runtime are supported.

## Natural Language Parsing

Supports phrases like:

- `"now"`
- `"2 days ago"`
- `"in 3 weeks"`
- `"next monday"`
- `"last friday"`
- `"start of month"`
- `"end of year"`
