# Scholastic Sky — Design Tokens

Companion to [MOODBOARD.md](MOODBOARD.md). Copy the CSS below into a shared stylesheet or map its values into your design system.

```css
:root {
  /* Academic identity */
  --color-primary: #7FA9C9;
  --color-primary-dark: #4F6B80;
  --color-primary-hover: #425C6F;
  --color-primary-soft: #DCE8F0;

  /* Neutral reading surfaces */
  --color-bg: #F7F8F6;
  --color-surface: #FFFCF7;
  --color-surface-hover: #F3F7FA;
  --color-text: #25313B;
  --color-text-muted: #5F6B75;
  --color-border: #D7DEE3;

  /* Functional feedback */
  --color-success: #5B7F68;
  --color-warning: #C28A3D;
  --color-danger: #A85A5A;

  /* Typography */
  --font-ui: 'Inter', 'Source Sans 3', 'Noto Sans', sans-serif;
  --font-size-meta: 0.875rem;
  --font-size-body: 1rem;
  --font-size-question: 1.125rem;
  --line-height-reading: 1.6;

  /* Geometry */
  --radius-input: 6px;
  --radius-button: 6px;
  --radius-card: 8px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  --shadow-soft: 0 2px 8px rgba(37, 49, 59, 0.06);
}

/* Reference component styles */
.exam-app {
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-ui);
}
.exam-header {
  background: var(--color-primary-dark);
  color: #fff;
}
.question-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-6);
}
.question-text {
  font-size: var(--font-size-question);
  line-height: var(--line-height-reading);
}
.answer-option {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-input);
  background: var(--color-surface);
  color: var(--color-text);
}
.answer-option:hover { background: var(--color-surface-hover); }
.answer-option[aria-checked="true"],
.answer-option.is-selected {
  background: var(--color-primary-soft);
  border-color: var(--color-primary-dark);
}
.btn-primary {
  background: var(--color-primary-dark);
  border: 1px solid var(--color-primary-dark);
  color: #fff;
  border-radius: var(--radius-button);
  min-height: 44px;
  padding: 10px 16px;
}
.btn-primary:hover { background: var(--color-primary-hover); }
:where(button, input, [role="radio"]):focus-visible {
  outline: 3px solid var(--color-primary-dark);
  outline-offset: 3px;
}
```

## Implementation Notes

- **60/30/10:** Neutral base / muted-sky identity / maximum functional accents.
- **Contrast:** Don't put white body text on `#7FA9C9`. `#4F6B80` with white works better for primary CTAs; use dark text on pale sky.
- **Statuses:** Use icons and explicit labels in addition to colors. An item can be answered and flagged simultaneously.
- **Timer:** Normal, warning, and critical thresholds should come from exam rules.
- **Visual system:** Prefer minimal motion, flat surfaces, clear borders, and small radii.
