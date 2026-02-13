# ATS Automation System - Design Document

## Demo


https://github.com/user-attachments/assets/d2fbab05-d35a-4bb5-b19b-8974e109758b

The video above shows the automation filling all 3 forms (Acme, Globex, Initech) end-to-end.
## Overview

This document describes the implementation and trade-offs made in building this application. The system successfully fills out three mock ATS (Applicant Tracking System) forms—Acme Corp (4-step wizard), Globex Corp (accordion layout), and Initech Corp (tabbed form) using a single candidate profile, with human-like behavior to avoid bot detection.

---

## Architecture & Code Structure

### Design Patterns

I use multiple simple but scalable patterns to make this application easier to debug and extend:

1. **Strategy Pattern**: Each ATS platform (Acme, Globex,Initech) implements a common interface through the `BasePlatform` abstract class, allowing platform-specific form-filling logic while sharing common functionality.

2. **Factory Pattern**: `PlatformRegistry` detects which platform to use based on URL pattern matching and instantiates the appropriate adapter.

3. **Template Method Pattern**: `BasePlatform` defines the high-level workflow (`run()` method) with timing, error handling, and screenshots, while subclasses implement platform-specific details through the abstract `apply()` method.

4. **Composition**: `HumanBehavior` is injected into `BasePlatform` to provide reusable anti-bot detection utilities across all platforms.

### Why This Structure?

**Extensibility**: Adding a another ATS platform requires:

1. Creating a new adapter file (e.g., `LinkedInAdapter.ts`)
2. Registering it in `PlatformRegistry` with one line of code
3. No changes to core logic or other platforms

This is proven by the Initech adapter — it was added as a third platform using only existing `BasePlatform` primitives, with zero changes to the core.

**Maintainability**: Clear separation means:

- Browser concerns isolated in `BrowserManager`
- Human behavior logic centralized in `HumanBehavior`
- Platform-specific code doesn't pollute shared code
- Logging and matching utilities are reusable

**Testability**: Each component can be tested independently:

- Mock `Page` objects for platform adapters
- Test fuzzy matching logic without a browser
- Verify human behavior timing without full automation runs

### Directory Structure

```
src/
├── core/
│   ├── BasePlatform.ts      # Abstract base with shared automation primitives
│   ├── BrowserManager.ts    # Browser lifecycle management
│   └── HumanBehavior.ts     # Anti-bot detection techniques
├── platforms/
│   ├── AcmeAdapter.ts       # Acme Corp — 4-step wizard
│   ├── GlobexAdapter.ts     # Globex Corp — accordion form
│   ├── InitechAdapter.ts    # Initech Corp — tabbed form
│   └── PlatformRegistry.ts  # Platform detection and factory
├── utils/
│   ├── logger.ts            # Structured logging with perf tracking
│   ├── matcher.ts           # Fuzzy matching via Fuse.js
│   └── validation.ts        # Profile validation (fail-fast)
├── types.ts                 # TypeScript type definitions
├── profile.ts               # Sample candidate data
└── automator.ts             # Entry point and orchestration
```

---

## Key Technical Decisions & Trade-offs

### 1. Platform Detection: URL Pattern Matching

**Decision**: Use simple regex matching on URLs in `PlatformRegistry`
**Why**:

- Simple and fast-no need for DOM inspection or API calls
- Reliable for the scope (known URLs)
- Easy to extend with new patterns

**Trade-off**: In production, might need more sophisticated detection (e.g., checking of the domain, meta tags, or domain+path) for dynamic platforms

### 2. Field Matching: Fuse.js Fuzzy Matching

**Decision**: Use Fuse.js with progressive threshold relaxation (0.2 → 0.4 → 0.6)

**Why**:

- Handles mismatches between profile values and form options (e.g., `"bachelors"` → `"Bachelor's Degree"`)
- No hardcoded mapping tables to maintain
- Battle-tested library (widely used, only 12KB)
- Searches both `value` and `text` fields of options

**Implementation**:

- Try strict match first (threshold 0.2)
- Relax to 0.4, then 0.6 if no match
- Log warnings for weak matches (threshold > 0.4)
- Return `null` if all thresholds fail (caller decides how to handle)

**Trade-off**: Fuzzy matching can sometimes produce unexpected matches with very different strings.we can use tiny llm to do that this task

### 3. Human-Like Behavior

**Implemented Techniques** (4 total, exceeds the "at least 2" requirement):

1. **Randomized Delays** (50-300ms default, configurable by field type)
   - Different ranges for different actions
   - Simulates reading/thinking time

2. **Variable-Speed Typing** (40-120ms per character with pauses)
   - Field-type awareness: email/phone typed faster, text fields slower
   - Random pauses mid-typing (10% chance per word)
   - Simulates human typing rhythm

3. **Hover Before Click** (100-300ms hover, then click)
   - Mimics mouse movement to element before clicking
   - All clicks use this by default

4. **Click Position Variation** (30-70% of element bounds)
   - Clicks at random positions within elements, not always center
   - Avoids robotic precision

### 4. Browser Mode: Configurable Headless

**Decision**: Default to headless=false for development visibility

**Why**:

- Easier to debug during development (see what's happening)
- Can switch to headless=true for production/CI pipelines

### 5. Validation: Fail-Fast Before Browser Launch

**Decision**: Validate profile completeness before opening browser

**Why**:

- Don't waste 10+ seconds opening a browser if required data is missing
- Clear error messages upfront (lists all missing/empty fields)
- Saves debugging time

### 6. Error Handling: Retries with Exponential Backoff

**Decision**: Retry flaky operations 3 times with exponential backoff (1s, 2s, 4s)

**Why**:

- Handles transient failures (slow network, animations, async loading)
- Exponential backoff avoids hammering the page
- Logs each retry attempt for debugging

**Applied to**: clicks, typeahead searches, file uploads, element visibility waits

**Not applied to**: screenshots (fail silently), logging, browser lifecycle

---

## What Was Hardest

### 1. **Globex Typeahead with Async Network Delay**

**Challenge**: The school typeahead in Globex has a 300-800ms simulated network delay and a loading spinner. Clicking too early results in selecting the wrong option.

**Solution**:

- Type partial school name (first 3 characters)
- Wait for dropdown to become visible
- Wait for spinner to disappear (with timeout and try-catch, since spinner might not appear for fast searches)
- Add additional random delay (simulates reading results)
- Use Fuse.js to match the target school from available options

**Insight**: Can't just wait for dropdown—need to wait for spinner _and_ add human delay, or risk clicking while results are still loading.

### 2. **Fuzzy Matching Without Over-Matching**

**Challenge**: Fuse.js can match unrelated strings if threshold is too high. For example, with threshold 0.6, `"phd"` might match `"High School"` if there are no better options.

**Solution**:

- Progressive thresholds (0.2 → 0.4 → 0.6) with logging for weak matches
- Return `null` instead of blindly picking the first option
- Let caller decide: throw error for required fields, skip for optional fields

---

## Testing & Verification

- All 3 forms filled and submitted successfully with confirmation IDs extracted:
  - Acme: `ACM-XXXXX` format from `#confirmation-id`
  - Globex: `GX-XXXXX` format from `#globex-ref`
  - Initech: `INT-XXXXX` format from `#initech-ref`
- Human behavior visually confirmed (delays, typing speed, hover movements)
- Profile validation tested with missing/empty fields
- Typeahead with async delay tested on both Globex and Initech
- Conditional fields tested (visa sponsorship appears only when work authorized)

---

## What I'd Do Differently With More Time

1. **Unit tests** — test fuzzy matcher edge cases, human behavior timing ranges, adapter logic with mocked Page objects
2. **Reuse browser across forms** — currently launches a new browser per form; reusing one saves 2-3s per additional form
3. **Environment variable config** — `HEADLESS=true`, `LOG_LEVEL=debug`, `HUMAN_SPEED=fast|normal|paranoid`
4. **Per-step screenshots** — currently only before-submit + success; per-section screenshots would aid debugging
5. **Fast mode for long text** — cover letter typed character-by-character takes ~60s; could `fill()` the bulk and type the last 20 chars
6. **Parallel execution** — run forms concurrently with separate browser contexts

---

## AI Tools Used

### OpenCode

- **Usage**: Code completion for boilerplate (imports, method signatures, common patterns)
- **Helpful**: Generated consistent method structure, especially for repetitive adapter methods
- **Less Helpful**: Suggested overly complex solutions for simple problems (e.g., unnecessary abstractions)

### ChatGPT (Brain Stroming)

- **Usage**: Initially generated a comprehensive 995-line PLAN.md with detailed architecture
- **Helpful**: Provided good high-level structure and comprehensive coverage of edge cases
- **Less Helpful**: The plan was overly detailed and diverged from actual implementation needs by end of the chat

### Neovim

- **Usage**: Primary editor for writing and debugging — split panes and fuzzy file search (`Telescope`) made navigating between adapters, base class, and HTML forms fast

### Antigravity (Gemini IDE)

- **Usage**: Used for reviewing diffs before commits and getting a second perspective on code structure

### Workflow

1. Brainstormed architecture options with ChatGPT, then narrowed down to patterns that fit the scope
2. Built the core abstractions (`BasePlatform`, `PlatformRegistry`) first in Neovim
3. Used OpenCode for adapter scaffolding and repetitive field-filling code
4. Manually tested each form end-to-end, debugging selector issues and timing

---

_Total implementation time: ~4 hours (including planning, debugging, and documentation)_
