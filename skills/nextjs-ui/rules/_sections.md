# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Styling | `ui-` | MEDIUM | Classes, semantic colors, status colors, `dark:`, `className` on primitives, `cn()`, spacing, sizes, numbers, z-index |
| 2 | Composition | `ui-` | MEDIUM | Existing primitives first, composites, button hierarchy, pending buttons, notices, parts inside parents, `render` |
| 3 | Icons | `ui-` | LOW | Icon library, `data-icon` in buttons, sizing, names, color, status |
| 4 | Overlays | `ui-` | MEDIUM | Dialogs, sheets, confirmations, popovers, tooltips, toasts |
| 5 | States | `ui-` | MEDIUM | Loading, empty, error and read-only states |
| 6 | Tables | `ui-` | MEDIUM | Headers, numbers, row actions, truncation, overflow, selection, dates |
| 7 | Layout | `ui-` | LOW | Page title, spacing steps, mobile first, widths, cards, headings |
| 8 | Accessibility | `ui-` | MEDIUM | Keyboard, focus, names, announcements, motion, contrast, links vs buttons, role-based tests |

Impact is the default severity of a finding; raise it when the code is on an authentication, payment or data-deletion path.
