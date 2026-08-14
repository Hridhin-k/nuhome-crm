---
name: Executive Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  headline-md-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  touch-target: 44px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The design system is anchored in **Minimalism** and **Corporate Modernism**, specifically tailored for high-stakes business management. The brand personality is authoritative yet approachable, prioritizing clarity of data over decorative flourish. 

The aesthetic avoids "trendy" glassmorphism or neomorphism in favor of a stable, structured interface that evokes trust and reliability. It utilizes a restrained color palette, generous whitespace, and a rigorous adherence to a grid system to ensure that complex business information remains legible and actionable. The emotional response should be one of calm control and professional confidence.

## Colors

The color strategy uses a "Low-Chroma" approach to minimize cognitive load. 

- **Primary:** A deep Charcoal/Navy (`#0F172A`) used for headers, primary actions, and brand identification.
- **Neutral Base:** The background utilizes an off-white (`#F8FAFC`) to reduce screen glare during extended use, with Slate (`#64748B`) used for secondary text and borders.
- **Semantic Status:** High-saturation tokens are reserved strictly for status communication:
    - **Success (Emerald):** Positive financial flow or completed tasks.
    - **Warning (Amber):** Items requiring attention or pending approval.
    - **Danger (Rose):** Critical errors, overdue payments, or blocked workflows.
    - **Neutral (Slate):** Draft states and inactive versioning.

## Typography

This design system utilizes **Inter** exclusively for its neutral, systematic, and highly legible qualities. 

- **Hierarchy:** We use weight (SemiBold/Bold) rather than color to establish hierarchy in headlines.
- **Mobile Optimization:** Large display sizes are scaled down for mobile to prevent awkward line breaks while maintaining a 16px base for body text to ensure readability without zooming.
- **Labels:** Small labels use an increased letter spacing and uppercase styling to distinguish metadata from body content.

## Layout & Spacing

The system follows a strict **8px grid** (with a 4px half-step for fine-tuning). 

- **Mobile:** Uses a fluid single-column layout with 16px side margins. All interactive elements must adhere to a minimum 44px height/width for touch accessibility.
- **Desktop:** Transitions to a 12-column fixed-width grid (max 1440px) with a persistent 280px left-hand sidebar.
- **Touch-First:** On mobile, critical actions are placed in a sticky bottom container to remain within the "thumb zone."

## Elevation & Depth

We utilize **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows to maintain a clean, professional profile.

- **Surface 0:** Main background (`#F8FAFC`).
- **Surface 1:** Cards and Modals (`#FFFFFF`). These use a subtle 1px border (`#E2E8F0`) and a very soft, diffused shadow (0px 4px 12px rgba(0,0,0,0.03)).
- **Interactive:** Hover or active states use a slight tonal shift (darkening the border) rather than increasing shadow depth.
- **Scrim:** Bottom sheets and modals use a 40% opacity Slate-900 backdrop to focus attention without introducing total black.

## Shapes

The shape language is **Soft (0.25rem / 4px)**. This provides a professional, "architectural" feel that is more approachable than sharp corners but more serious than highly rounded "bubbly" UI. 

- **Small Components:** Checkboxes and small tags use the 4px base radius.
- **Large Components:** Cards and Bottom Sheets use the `rounded-lg` (8px) or `rounded-xl` (12px) tokens to soften the larger surface areas.

## Components

### Buttons
- **Primary:** Solid Primary Accent (`#0F172A`), white text. Height: 48px on mobile for touch.
- **Sticky Bottom:** Fixed to the viewport bottom on mobile, often spanning full-width with 16px padding around it.

### Status Badges
- Consist of a subtle background tint (10% opacity of semantic color) and a solid 6px dot icon next to the label.
- Example: *Approved* badge has an Emerald background at 10% and a solid Emerald dot.

### Vertical Timelines
- Used for audit trails and order history. 
- A 2px wide Slate-200 line connects 8px circular nodes. The current/active node is Primary Accent; completed nodes are Slate-400.

### Inputs & Forms
- Input fields use a 48px minimum height. 
- Labels are persistent (not floating) and placed above the field in `label-md` style for clarity during data entry.

### Bottom Sheets
- Triggered for mobile filters, actions, and sub-forms.
- Features a 4px x 32px "grabber" bar at the top center.
- Always occupies at least 40% of the screen height but can expand to 90%.

### Navigation
- **Mobile Navigation:** 5-slot bottom bar with 24px icons and 10px labels.
- **Desktop Sidebar:** 280px width, using a collapsed state (64px) for smaller desktop viewports. High contrast (Primary Accent background) to separate navigation from content.