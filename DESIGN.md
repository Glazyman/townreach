---
name: Aetheric Minimalist
colors:
  surface: '#faf9fe'
  surface-dim: '#dad9df'
  surface-bright: '#faf9fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f8'
  surface-container: '#eeedf3'
  surface-container-high: '#e9e7ed'
  surface-container-highest: '#e3e2e7'
  on-surface: '#1a1b1f'
  on-surface-variant: '#414755'
  inverse-surface: '#2f3034'
  inverse-on-surface: '#f1f0f5'
  outline: '#717786'
  outline-variant: '#c1c6d7'
  surface-tint: '#005bc1'
  primary: '#0058bc'
  on-primary: '#ffffff'
  primary-container: '#0070eb'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#4c4aca'
  on-secondary: '#ffffff'
  secondary-container: '#6664e4'
  on-secondary-container: '#fffbff'
  tertiary: '#9e3d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c64f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c2c1ff'
  on-secondary-fixed: '#0c006a'
  on-secondary-fixed-variant: '#3631b4'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb595'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7c2e00'
  background: '#faf9fe'
  on-background: '#1a1b1f'
  surface-variant: '#e3e2e7'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0'
  body-rg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  container-max: 1200px
  gutter: 20px
---

## Brand & Style

The design system is engineered to evoke a sense of effortless premium quality, mirroring the precision and clarity of high-end hardware. The personality is quiet, confident, and sophisticated, targeting users who value focus and aesthetic harmony over visual noise.

The style is a disciplined fusion of **Minimalism** and **Glassmorphism**. It relies on high-index backdrop blurs to create a sense of verticality and material depth. Whitespace is treated as a functional element rather than a void, used to group information and allow the typography to breathe. The emotional response is one of "digital serenity"—a professional yet inviting environment that feels both cutting-edge and timeless.

## Colors

The palette is rooted in a neutral "Off-White" and "Cool Grey" foundation to ensure the interface remains secondary to the user's content.

- **Primary:** A vibrant, high-saturation Blue (#007AFF) used for calls to action and active states.
- **Secondary:** A deep Indigo (#5856D6) for accent elements and subtle variety in data visualization.
- **Neutrals:** A range of greys derived from Apple's palette—#F5F5F7 for backgrounds and #1D1D1F for primary text.
- **Translucency:** Surfaces utilize a semi-transparent white with a 70-80% opacity to allow background colors to bleed through subtly, creating the signature "glass" effect.

## Typography

This design system uses a dual-font strategy to balance character with utility. **Manrope** is used for headlines to provide a modern, slightly geometric warmth. **Inter** is utilized for body text and functional labels due to its exceptional legibility and systematic appearance at small sizes.

Tight tracking is applied to large headlines to mimic the "SF Pro Display" aesthetic, while body copy maintains standard tracking for optimal readability. Contrast is achieved through weight variance rather than excessive color shifts.

## Layout & Spacing

The layout philosophy follows a **Fixed-Fluid Hybrid** model. Content is housed within a 12-column grid with a maximum width of 1200px for desktop, while margins remain fluid on smaller viewports. 

A strict 8px spatial system governs all padding and margins. Generous "air" (xl spacing) is preferred between major sections to prevent visual clutter. Internal component spacing uses 16px (md) as the default to maintain a comfortable touch target and visual rhythm.

## Elevation & Depth

Depth in the design system is communicated through "Material Layers" rather than traditional heavy shadows.

- **Level 1 (Base):** Solid neutral background (#F5F5F7).
- **Level 2 (Glass):** Backdrop filter: blur(20px); background: rgba(255, 255, 255, 0.7); border: 1px solid rgba(255, 255, 255, 0.3).
- **Level 3 (Floating):** Used for modals and popovers. Adds a multi-layered shadow: `0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.1)`.

Shadows must be ultra-diffused and use a hint of the primary color in the shadow mix to avoid a "dirty" grey look on translucent surfaces.

## Shapes

The design system employs a **Rounded** aesthetic (Level 2). This mimics the hardware corners of modern premium devices.

- **Standard Components:** Buttons, inputs, and small cards use a 12px (0.75rem) radius.
- **Large Containers:** Content cards and main surface areas use a 24px (1.5rem) radius.
- **Interactive Elements:** Checkboxes and radio buttons use a 4px and 100% (pill) radius respectively to maintain standard affordances.

## Components

- **Buttons:** Primary buttons feature a solid primary color with white text. Secondary buttons use the "Glass" effect with a subtle 1px border and primary-colored text. 
- **Cards:** Cards should have no visible box-shadow by default; instead, they use a subtle white border and a soft backdrop blur to separate themselves from the background.
- **Inputs:** Input fields are defined by a light grey background (#E5E5EA) that turns white with a 2px primary border on focus.
- **Chips:** Highly rounded (pill-shaped) with a light grey background and medium-weight Inter labels.
- **Glass Sheets:** For sidebars or navigation blurs, use a `saturate(180%)` filter along with the `blur(20px)` to make background colors pop through the frosted surface.
- **Lists:** Use "Inset Grouped" styling for lists, with rounded corners on the top and bottom items and thin dividers that don't reach the edge of the container.