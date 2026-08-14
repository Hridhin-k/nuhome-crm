---
name: NuHome Sales Core
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1b1b1b'
  on-surface-variant: '#4c4546'
  inverse-surface: '#303030'
  inverse-on-surface: '#f1f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1b'
  on-tertiary-container: '#848484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1b1b1b'
  on-tertiary-fixed-variant: '#474747'
  background: '#f9f9f9'
  on-background: '#1b1b1b'
  surface-variant: '#e2e2e2'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  subheading:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 16px
  stack-gap: 12px
  inline-gap: 8px
  section-margin: 24px
---

## Brand & Style

The design system is engineered for high-velocity sales environments where clarity and utility are paramount. It adopts a **Modern / Corporate** aesthetic with a strong emphasis on **Mobile-Native** ergonomics. The personality is professional, decisive, and efficient.

The visual language prioritizes a "Phone First" hierarchy, ensuring that critical sales data and primary actions are always within thumb-reach. By utilizing high-density layouts and a stark, high-contrast color palette, the UI minimizes cognitive load for sales representatives operating in the field. The result is a tool that feels less like a website and more like a high-performance instrument.

## Colors

This design system utilizes a high-contrast foundation to drive focus. 
- **Core Tones:** Deep Black (#000000) is reserved for primary buttons, headers, and active states to signal authority and action. 
- **Surface Strategy:** A dual-surface approach is employed. The authentication/login experience uses the "Midnight" background (#0A0A0A) with white text for a premium, focused entry. The authenticated application shifts to a clean, high-utility White/Light Gray surface to maximize legibility during long periods of use.
- **Status Indicators:** Color is used functionally, not decoratively. Statuses use a "muted-vibrant" approach—saturated enough to be recognized at a glance but balanced to avoid visual noise in dense lists.

## Typography

The typography system uses **Inter** to provide a systematic, neutral, and highly legible experience. 

- **Scale:** Headlines are kept within a tight range (22-24px) to ensure they do not consume excessive vertical real estate on mobile screens. 
- **Information Density:** Subheadings and labels are sized at 12-14px with increased weight to maintain hierarchy without needing large font sizes. 
- **Clarity:** For sales figures and ID numbers, use the `data-tabular` style which ensures numbers align vertically for easy comparison.

## Layout & Spacing

This design system uses a **Tight, High-Density** spacing model to maximize the information visible on a single mobile viewport.

- **Grid:** A 4-column fluid grid for mobile, expanding to 12 columns for tablet/desktop. 
- **Safe Zones:** A 16px standard margin (container-padding) is applied to all screens to ensure content does not hit the edge of the device.
- **Density:** Vertical spacing between related items (stack-gap) is kept to 12px. Elements within a card or list item use an 8px gap to feel tightly grouped.
- **Mobile Patterns:** Key navigation is placed in a fixed bottom tab bar for accessibility. Large data sets or filters are handled via bottom sheets to maintain the user's context.

## Elevation & Depth

To maintain a professional and clean look, this design system avoids heavy drop shadows. 

- **Surface Tiers:** Hierarchy is established through tonal layering. The main background is light gray (#F8F9FA), and primary content containers (cards) are pure white.
- **Borders:** Instead of shadows, use 1px solid borders (#E2E8F0) to define element boundaries.
- **Active Elevation:** Only the primary action buttons and floating elements (like bottom sheets) may use a subtle, low-opacity ambient shadow (0px 4px 12px rgba(0,0,0,0.05)) to indicate they sit above the base layout.

## Shapes

The shape language is defined by a consistent 10px (0.625rem) radius for all major containers. 

- **Cards & Inputs:** Both use a 10px radius to create a unified visual rhythm. 
- **Pills:** Status indicators and tags are "full-round" (999px) to distinguish them from interactive containers and provide a distinct "status" look.
- **Buttons:** Primary buttons share the 10px radius to maintain the professional, structured aesthetic.

## Components

- **Buttons:** Primary buttons are 44px tall, solid black with white text. Secondary buttons use a white background with a 1px black border.
- **Input Fields:** 44px height for touch-target optimization. Labels are 12px semi-bold, positioned 4px above the input field. 
- **Status Pills:** Small, high-contrast labels. Approved (Green text on light green bg), On Hold (Amber text on light amber bg), Draft (Dark gray text on light gray bg), and Returned (Red text on light red bg).
- **Cards:** White background, 10px radius, 1px subtle border. Internal padding is 16px.
- **Segmented Controls:** Used for toggling views (e.g., "Active" vs "History"). These should be full-width with a light gray background and a white sliding indicator for the active state.
- **Fixed Bottom Bar:** A 64px tall container at the base of the screen for primary navigation icons.
- **Bottom Sheets:** Used for all selection menus and filtering options to keep actions within the "thumb zone."