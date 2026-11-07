# Scholastic Sky — Web Exam Moodboard

> **Design direction:** Academic & Formal  
> **Product:** Secure web-based examination platform (SEB-inspired)  
> **Keywords:** Academic · Trustworthy · Focused · Clean · Organized · Comfortable for Long Use  
> **Version:** 1.0 · 7 November 2026

![Scholastic Sky — visual moodboard](assets/moodboard.png)

## 1. Creative Direction

**Scholastic Sky** is an exam interface inspired by modern academic institutions. It uses muted sky blue as its visual identity, a warm neutral reading surface, and restrained status colors to create a serious, dependable environment that remains comfortable during long examinations.

The goal is **not** to make the interface look like a playful learning app or a dense enterprise dashboard. The interface should feel like a modern, well-organized examination room: calm, predictable, and distraction-free.

### Visual principles

1. **Clarity over decoration** — reading the question and choosing an answer always take priority.
2. **Institutional, not intimidating** — subtle academic cues without heavy ornamentation.
3. **Muted sky blue, not saturated blue** — identity without visual fatigue.
4. **Status colors are functional** — red and amber are reserved for meaningful feedback.
5. **Consistency under pressure** — timers, navigation, and submissions must behave predictably.

## 2. Color Palette

### The 60 / 30 / 10 rule

| Proportion | Role | Colors | Application |
|---|---|---|---|
| **60%** | Neutral base | Soft Paper `#F7F8F6`, Ivory White `#FFFCF7` | Page backgrounds, question cards, reading surfaces |
| **30%** | Academic sky identity | Scholastic Sky `#7FA9C9`, Academic Blue-Gray `#4F6B80`, Pale Sky `#DCE8F0` | Header, primary CTA, selected states, subtle UI highlights |
| **10% max** | Functional accents | Answer Green `#5B7F68`, Amber Clay `#C28A3D`, Muted Red `#A85A5A` | Answer status, review flags, warnings, critical timer |

> The percentages are a **visual balance guide**, not a strict pixel count. Functional accent colors should be less than 10% on a normal exam screen; they may appear more prominently only when feedback truly requires attention.

### Core colors

| Token | Name | HEX | Usage |
|---|---|---|---|
| `--color-primary` | Scholastic Sky | `#7FA9C9` | Identity, decorative accents, soft highlights |
| `--color-primary-dark` | Academic Blue-Gray | `#4F6B80` | Header, primary buttons, current question |
| `--color-primary-soft` | Pale Sky | `#DCE8F0` | Selected answer background, info badges |
| `--color-bg` | Soft Paper | `#F7F8F6` | Main application background |
| `--color-surface` | Ivory White | `#FFFCF7` | Reading panels, cards, forms |
| `--color-text` | Ink Slate | `#25313B` | Main text, question text, headings |
| `--color-text-muted` | Muted Slate | `#5F6B75` | Secondary labels and meta information |
| `--color-border` | Fog Line | `#D7DEE3` | Outlines, dividers, form borders |

### Functional colors

| Token | Name | HEX | Intent |
|---|---|---|---|
| `--color-success` | Answer Green | `#5B7F68` | Answered / success |
| `--color-warning` | Amber Clay | `#C28A3D` | Flagged / needs review / timer warning |
| `--color-danger` | Muted Red | `#A85A5A` | Error / critical timer / destructive action |

**Accessibility note:** Light `#7FA9C9` is *not* suitable for white body text; use dark Ink Slate on it. Use `#4F6B80` with white text for ordinary primary buttons. Avoid using white text over amber backgrounds. The specified green is borderline for normal white text; use a darker green for small white labels, or use a pale green background with dark text.

## 3. Typography

**Primary:** Inter  
**Alternatives:** Source Sans 3, IBM Plex Sans, Noto Sans  
**Personality:** Modern, structured, highly readable, neutral

| Element | Font size | Weight | Line height |
|---|---:|---:|---:|
| Main page title | 24–28 px | 600 | 1.25 |
| Card / section title | 18–20 px | 600 | 1.35 |
| Question text | 16–18 px | 400–500 | 1.6 |
| Answer choices | 16 px | 400 | 1.5 |
| UI label / button | 14 px | 500–600 | 1.4 |
| Secondary metadata | 13–14 px | 400 | 1.4 |
| Countdown timer | 16–20 px | 600 | 1.2, tabular numerals |

- Use sentence case for ordinary labels.
- Prefer short, clear wording, especially for critical actions.
- Never rely on typography alone to indicate a critical exam status.

## 4. Visual Language

### Shape and surfaces

| Property | Recommendation |
|---|---|
| Card radius | `8px` |
| Button / input radius | `6px` |
| Badge radius | `6px` or pill for compact metadata |
| Border | `1px solid #D7DEE3` |
| Shadow | `0 2px 8px rgba(37, 49, 59, 0.06)`; only when necessary |
| Primary spacing scale | 4, 8, 12, 16, 24, 32 px |
| Question card padding | 24–32 px on desktop, 16–20 px on mobile |

### Imagery and references

- Architectural details of modern campuses and university buildings.
- Libraries, academic books, paper, daylight, and airy interiors.
- Soft sky photography with low saturation.
- Clean and restrained line icons (graduation cap, shield, clock, flag, check, info).
- Use imagery mainly on login/onboarding pages, **not** as decoration in the exam reading area.

### Avoid

Neon blue, bright gradients, cartoon illustrations, overly rounded components, deep shadows, glassmorphism, animated confetti, decorative red/amber, and busy backgrounds.

## 5. Core Exam Screen

**Desktop layout:** persistent header + main question panel + narrower navigation sidebar.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ExamSpace     Ujian Akhir Semester                          01:28:42    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────┐ ┌────────────────────────┐ │
│  │ Soal 12 dari 40            Pilihan Ganda  │ │ Navigasi Soal          │ │
│  │                                          │ │ [1] [2] [3] [4] [5]   │ │
│  │ Jika f(x) = 2x + 3, f(5) = ... ?        │ │ [6] [7] [8] [9] [10]  │ │
│  │                                          │ │ ...                    │ │
│  │  ( ) A. 10                              │ │ ■ Sudah dijawab        │ │
│  │  (●) B. 13   ← pale sky selected        │ │ ⚑ Ditandai ragu-ragu  │ │
│  │  ( ) C. 15                              │ │ □ Belum dijawab       │ │
│  │  ( ) D. 18                              │ └────────────────────────┘ │
│  │                                          │                            │
│  │  [Sebelumnya]           [Selanjutnya]   │                            │
│  └──────────────────────────────────────────┘                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Header

- Background `#4F6B80`; foreground white.
- Include exam name, participant identity, connection/security information if applicable, and countdown.
- Keep the countdown continuously visible without dramatic animation.
- Reserve destructive/final submission actions for clearly labeled confirmation flows.

### Question panel

- Main reading area uses `#FFFCF7` with `#25313B` text.
- Questions appear one at a time by default; avoid overcrowding.
- Answer options have large click/tap targets (at least 44 × 44 px for interaction regions).
- A selected option uses `#DCE8F0` plus a distinct radio/check mark and outline.
- Separate **Save/Next**, **Mark for Review**, and **Submit Exam** actions clearly.

### Question navigation

| State | Background | Label / icon | Visual treatment |
|---|---|---|---|
| Unanswered | `#FFFCF7` | `#25313B` | Neutral border |
| Currently active | `#4F6B80` | White | Strong active outline and current marker |
| Answered | `#5B7F68` | Check icon | Provide status label in legend |
| Flagged for review | `#C28A3D` | Flag icon | Use dark text where needed |
| Critical / attention | `#A85A5A` | Warning icon | Only on genuine warnings |

A question may be **both answered and flagged**. Show these as independent states (e.g. answered fill plus flag icon), rather than assuming they are mutually exclusive.

## 6. Important Components

### Primary button

- Background: `#4F6B80`
- Text: `#FFFFFF`
- Hover: `#425C6F`
- Keyboard focus: visible high-contrast focus ring
- Labels: **Selanjutnya**, **Simpan Jawaban**, **Mulai Ujian**

### Secondary button

- Background: `#DCE8F0`
- Text: `#25313B`
- Border: `#D7DEE3`
- Labels: **Sebelumnya**, **Kembali ke Ujian**

### Answer option

| State | Background | Border | Text |
|---|---|---|---|
| Default | `#FFFCF7` | `#D7DEE3` | `#25313B` |
| Hover | `#F3F7FA` | `#7FA9C9` | `#25313B` |
| Selected | `#DCE8F0` | `#4F6B80` | `#25313B` |
| Disabled | `#F2F3F2` | `#D7DEE3` | `#5F6B75` |

### Timer

- Normal: text Ink Slate on neutral surface.
- Warning: amber icon + explicit remaining time.
- Critical: muted red + clear text; no aggressive flashing.
- The warning/critical thresholds must be set by exam policy, not assumed from the design.

## 7. Pages to Design

### A. Login

Institutional branding, simple credentials form, reassuring security messaging, optional low-contrast campus photography. Use a calm and uncluttered visual field.

### B. Pre-exam instructions

Exam title, duration, number of questions, rules, permitted navigation, accessibility guidance, acknowledgment checkbox, and prominent **Mulai Ujian** CTA.

### C. Active exam

Priority: question, choices, navigation, time remaining. Avoid unnecessary announcements or imagery; show auto-save or connection state if supported by the application.

### D. Review & submit

Show counts for answered, flagged, and unanswered questions. Allow returning to specific questions when exam rules permit. Request explicit confirmation for final submission.

### E. Completion

Clear submission status and timestamp if available; do not show scores unless authorized by exam settings.

## 8. Responsive & Accessibility Guidelines

- **Desktop:** Two-column exam workspace with a 70–75% reading area and 25–30% navigation panel, adjusted to available width.
- **Tablet:** Reduce margins; allow navigation sidebar to collapse.
- **Mobile:** Stack content and turn question navigation into an accessible drawer or separate panel (subject to exam policy and browser restrictions).
- Maintain at least WCAG AA contrast: 4.5:1 for ordinary text, 3:1 for large text and appropriate UI component boundaries.
- Always combine color with shape, icon, text, or another identifiable cue.
- Make radio options keyboard-accessible with clearly visible focus states.
- Support zoom/text enlargement without clipping primary controls.
- Avoid transitions/animations that create distraction or perceived timer urgency.

## 9. Visual Acceptance Checklist

- [ ] The first impression is institutional and modern, not playful.
- [ ] Sky blue is muted and used to communicate identity rather than flood the screen.
- [ ] Most of the reading area is Soft Paper / Ivory White.
- [ ] The question and possible answers remain the most prominent content.
- [ ] Red and amber appear only when they carry functional meaning.
- [ ] Current, answered, unanswered, and flagged states are unmistakable without color alone.
- [ ] The countdown is easy to find but not alarming under normal conditions.
- [ ] Components, spacing, icons, and language are consistent across all screens.

---

**One-line creative brief:** *A quiet academic examination environment built around warm paper surfaces, muted sky-blue identity, precise typography, and purposeful status feedback.*
