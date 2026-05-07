---
name: Warden
description: Secure identity control plane for applications, API keys, service accounts, and audit history.
colors:
  fortress-void: "#030712"
  command-surface: "#111827"
  raised-surface: "#1f2937"
  field-surface: "#374151"
  divider-line: "#1f2937"
  control-line: "#374151"
  muted-copy: "#6b7280"
  secondary-copy: "#9ca3af"
  primary-copy: "#f5f7fa"
  authority-blue: "#2563eb"
  authority-blue-hover: "#3b82f6"
  warning-amber: "#facc15"
  warning-field: "#422006"
  danger-red: "#f87171"
  danger-field: "#450a0a"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.authority-blue}"
    textColor: "{colors.primary-copy}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.authority-blue-hover}"
    textColor: "{colors.primary-copy}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  input-default:
    backgroundColor: "{colors.command-surface}"
    textColor: "{colors.primary-copy}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card-operational:
    backgroundColor: "{colors.command-surface}"
    textColor: "{colors.primary-copy}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip-muted:
    backgroundColor: "{colors.raised-surface}"
    textColor: "{colors.secondary-copy}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
---

# Design System: Warden

## 1. Overview

**Creative North Star: "The Quiet Control Plane"**

Warden should feel like infrastructure with a steady hand: calm, precise, and authoritative. The visual system uses a dark operational interior because the current interface is an admin control plane for sensitive access work, not a public marketing page. The public edge can carry more brand expression later, but the interior must stay disciplined.

The system is restrained rather than theatrical. It uses tonal layers, clear borders, exact labels, and direct hierarchy to make access operations readable. It should feel serious without being scary, technical without being cryptic, secure without becoming cyberpunk.

It explicitly rejects cyberpunk hacker-terminal aesthetics, neon security-dashboard visuals, fake threat maps, glowing borders, enterprise clutter, ambiguous icon-only destructive actions, and empty states that look like errors.

**Key Characteristics:**
- Dark, quiet operational surfaces with near-white text and muted metadata.
- One primary blue for committed actions and focus, used sparingly.
- Flat tonal layering instead of decorative shadows.
- Compact controls that remain explicit, labeled, and keyboard reachable.
- Severity colors paired with labels, consequence copy, or icons.

## 2. Colors

The palette is restrained: tinted dark neutrals carry the system, while blue marks authority and red or amber mark consequence.

### Primary
- **Authority Blue**: The only standard action accent. Use for primary creation, add, submit, and focused form controls. It must stay rare enough that it still reads as an intentional action signal.
- **Authority Blue Hover**: The active hover state for primary actions. It is brighter, not louder.

### Secondary
- **Warning Amber**: Credential reveal, rotation, one-time secret, and caution states. Always pair with explanatory text.
- **Danger Red**: Revoke, delete, failed authentication, and irreversible operation states. Always pair with consequence copy.

### Neutral
- **Fortress Void**: Login background and deepest page canvas.
- **Command Surface**: Sidebar, cards, forms, list containers, and table row hover beds.
- **Raised Surface**: Expanded rows, inline editors, secondary button beds, and nested operational details.
- **Field Surface**: Inputs, selects, avatars, and low-emphasis chips.
- **Divider Line**: Structural separation between sidebar, panels, table headers, and expanded rows.
- **Muted Copy**: Timestamps, counts, placeholders, and secondary IDs.
- **Secondary Copy**: Labels, inactive navigation, and supporting body text.
- **Primary Copy**: Main readable text. Use a tinted near-white, not pure white.

### Named Rules

**The One Authority Rule.** Blue is for action and focus only. Do not use it as decoration, illustration, or section garnish.

**The No Color Alone Rule.** Red, amber, and blue never carry meaning by themselves. Pair them with text, labels, or icons.

## 3. Typography

**Display Font:** Not used in the admin UI.
**Body Font:** System sans stack with platform-native rendering.
**Label/Mono Font:** System mono for secrets, API key prefixes, client IDs, and machine identifiers.

**Character:** The typography is compact and operational. It avoids brand theatrics inside the admin UI and relies on weight, size, and spacing to reveal importance.

### Hierarchy
- **Headline** (700, 1.25rem, 1.25): Page titles such as Users, Applications, API Keys, Audit Log, and Service Accounts.
- **Title** (500, 1rem, 1.5): Entity names, application names, and row-leading text.
- **Body** (400, 0.875rem, 1.5): Table cells, form text, navigation labels, and explanatory copy. Keep long prose to 65 to 75 characters per line.
- **Label** (400, 0.75rem, 1.4): Counts, timestamps, status chips, metadata, and low-emphasis actions.
- **Code** (400, 0.75rem, 1.45): Secrets, key prefixes, IDs, and integration credentials.

### Named Rules

**The Plain Technical Rule.** Labels must be exact before they are clever. Use Application, API Key, Membership, Grant, Secret, and Revoke without euphemism.

**The Mono Evidence Rule.** Use monospace only for machine-readable values. Do not use mono as a lazy developer aesthetic.

## 4. Elevation

The system is flat and layered. Depth comes from tonal surfaces, borders, hover fills, and expansion states rather than shadows. Shadows are absent in the current UI and should remain absent for normal panels, cards, and rows.

### Named Rules

**The Flat Control Plane Rule.** Surfaces are flat at rest. Use borders and tonal contrast for structure. Reserve shadows for future overlays only if a surface must detach from the page.

**The Border As Structure Rule.** Borders separate responsibility areas. They are not decorative accents and must never become colored side stripes.

## 5. Components

### Buttons

Buttons are restrained and explicit.

- **Shape:** Slightly rounded controls (6px radius).
- **Primary:** Authority Blue background, Primary Copy text, compact padding (6px 12px). Use for create, add, submit, and confirm actions.
- **Hover / Focus:** Hover brightens to Authority Blue Hover. Focus must use a visible outline or ring with sufficient contrast, not the browser-default afterthought.
- **Danger:** Use a dark red field with red text and a full border. Pair with verbs such as Delete, Revoke, or Remove.
- **Warning:** Use amber text and a dark amber field for rotation and secret handling.
- **Ghost:** Use muted text that brightens on hover. Ghost actions must have clear labels.

### Chips

Chips are metadata, not decoration.

- **Style:** Raised Surface background, Secondary Copy text, compact horizontal padding (2px 8px), slight rounding (6px).
- **State:** Use for roles, scopes, slugs, and short status labels. Role names should remain visible text, not only color.

### Cards / Containers

Containers are operational records.

- **Corner Style:** Gently rounded (8px radius) for cards and list records.
- **Background:** Command Surface for primary records, Raised Surface for expanded inline details.
- **Shadow Strategy:** No shadows at rest. Depth is tonal.
- **Border:** Divider Line around records and between expanded sections.
- **Internal Padding:** 16px for normal cards, 20px for dashboard summaries, 24px for page-level content.

### Inputs / Fields

Fields must feel safe to operate.

- **Style:** Command Surface or Raised Surface background, Control Line border, Primary Copy text, Secondary Copy placeholder, 6px radius, 8px 12px padding.
- **Focus:** Shift to Authority Blue border or ring. The focus state must be visible in keyboard navigation.
- **Error / Disabled:** Errors use Danger Red with direct inline explanation. Disabled controls reduce opacity but keep labels readable.

### Navigation

Navigation is a fixed left rail in the admin UI.

- **Style:** Command Surface sidebar with Divider Line separation from main content.
- **Typography:** 0.875rem labels, medium enough for scanning, never all caps.
- **Default State:** Secondary Copy text on transparent background.
- **Hover State:** Primary Copy text on a Raised Surface tint.
- **Active State:** Raised Surface background and Primary Copy text.
- **Mobile Treatment:** If the admin UI becomes responsive, preserve labels before compressing to icons. Icon-only navigation is not acceptable for destructive or security-critical surfaces.

### Tables

Tables are audit and key ledgers.

- **Style:** Full-width rows, 0.875rem text, muted table headers, Divider Line row separation.
- **Row Actions:** Text actions must remain labeled. Avoid ambiguous icon-only revoke or delete controls.
- **Empty State:** Empty states are calm and explanatory, not alarming.

## 6. Do's and Don'ts

### Do:

- **Do** preserve the feeling of "The Quiet Control Plane": calm, precise, authoritative.
- **Do** use tonal layering and borders to separate applications, memberships, service grants, and audit records.
- **Do** pair destructive actions with explicit consequence copy before execution.
- **Do** keep all controls keyboard accessible with visible focus states.
- **Do** pair status color with labels, icons, or text so color is never the only signal.
- **Do** use monospace for secrets, API keys, client IDs, and other machine-readable evidence.

### Don't:

- **Don't** use cyberpunk hacker-terminal aesthetics.
- **Don't** use overly dark, neon security-dashboard visuals.
- **Don't** use red/green-only status systems.
- **Don't** use excessive animations, glowing borders, or fake threat-map visuals.
- **Don't** create enterprise clutter with dense controls everywhere and unclear hierarchy.
- **Don't** use playful auth/security UI that undercuts trust.
- **Don't** hide dangerous actions behind ambiguous icon-only buttons.
- **Don't** make empty states look like errors.
- **Don't** use colored side-stripe borders on cards, list items, callouts, or alerts.
- **Don't** use gradient text, decorative glassmorphism, or hero-metric templates.
