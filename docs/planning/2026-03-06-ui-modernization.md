# Implementation Plan: Vision-Jarvis UI Modernization

## Overview

This plan transforms the existing dark monochromatic interface into a polished, cohesive desktop application with a formalized design token system, consistent component patterns, refined micro-interactions, and better visual hierarchy. The current codebase uses Tailwind CSS v4, Astro, and React with a purely dark theme. The plan preserves all existing functionality and the dark aesthetic, but introduces subtle accent colors, consistent radii/spacing, motion design, and elevated component quality.

## Requirements

- Formalize a design token system (CSS custom properties) for colors, spacing, radii, shadows, and timing
- Unify all inconsistent border-radius values (currently 9+ different values) to a structured scale
- Introduce a restrained accent color palette for semantic states (success, warning, info) while respecting the dark monochromatic character
- Add skeleton loading states to replace bare text placeholders
- Elevate card components with hover depth, refined borders, and subtle gradient overlays
- Polish the floating ball with improved ambient animation
- Modernize notification cards with richer animation (enter/exit/stack)
- Refine the Settings page visual hierarchy (section icons, better card grouping)
- Add page-level transition animations for tab/panel switches
- Create reusable motion primitives (fade-in, slide-up, scale-in)
- Maintain 100% functional parity

## Architecture Changes

- `/vision-jarvis/src/styles/design-tokens.css` -- NEW: CSS custom property definitions for the entire design system
- `/vision-jarvis/src/styles/global.css` -- MODIFY: Migrate hardcoded values to token references, add animation utilities
- `/vision-jarvis/src/styles/animations.css` -- NEW: Reusable keyframe library and motion utilities
- `/vision-jarvis/src/components/ui/Skeleton.tsx` -- NEW: Skeleton loading component
- `/vision-jarvis/src/components/ui/Card.tsx` -- NEW: Reusable card wrapper with hover elevation
- `/vision-jarvis/src/components/ui/Badge.tsx` -- NEW: Status badge component (replaces ad-hoc spans)
- `/vision-jarvis/src/components/ui/EmptyState.tsx` -- NEW: Styled empty state component
- `/vision-jarvis/src/components/ui/FilterChips.tsx` -- NEW: Reusable filter chip group (replaces duplicated filter buttons in HabitsPanel/ProjectsPanel)
- All existing components -- MODIFY: Migrate to tokens and shared primitives

## Implementation Steps

### Phase 1: Design Token Foundation

**1.1 Create design-tokens.css**
- Define complete CSS custom property system on `:root`
- Color scale, text scale, border scale, accent colors
- Radius scale: `--radius-sm: 6px` through `--radius-2xl: 28px`
- Shadow scale, spacing scale, timing values
- **Risk**: Low

**1.2 Create animations.css**
- Define reusable keyframe animations: fade-in, slide-up, scale-in, skeleton-shimmer, pulse-soft
- Utility classes for each animation
- Respect `prefers-reduced-motion`
- **Risk**: Low

**1.3 Migrate global.css to tokens**
- Import design-tokens.css and animations.css
- Replace hardcoded values with token references
- Consolidate 9+ border-radius variants to 6-value scale
- Add utility classes: `.card-hover-lift`, `.glass-bg`, `.focus-ring`
- **Risk**: Medium (wide blast radius)

### Phase 2: Shared UI Primitives

**2.1 Create Skeleton component**
- Props: width, height, variant, count
- Uses shimmer animation
- **Risk**: Low

**2.2 Create Card component**
- Props: interactive, padding, className
- Hover lift effect for interactive cards
- **Risk**: Low

**2.3 Create Badge component**
- Props: variant (default, active, success, warning, info), size
- Replaces inconsistent badge patterns
- **Risk**: Low

**2.4 Create EmptyState component**
- Props: icon, title, description, action
- Consistent empty states across app
- **Risk**: Low

**2.5 Create FilterChips component**
- Props: items, selected, onChange
- DRY for HabitsPanel and ProjectsPanel
- **Risk**: Low

### Phase 3: Component-Level Polish (Memory System)

**3.1 Upgrade MemoryTabs**
- Add icons before tab labels
- Animated sliding indicator
- Accessibility attributes
- **Risk**: Low

**3.2 Upgrade MemoryPage sidebar**
- Replace loading text with Skeleton
- Replace empty states with EmptyState
- Improve date input styling
- Staggered fade-in animations
- **Risk**: Medium

**3.3 Upgrade HabitCard**
- Wrap in Card component
- Styled progress bar with gradient
- Badge for pattern_type
- Entrance animations
- **Risk**: Low

**3.4 Upgrade HabitsPanel**
- Use FilterChips, Skeleton, EmptyState
- Section count badges
- Staggered entrance animations
- **Risk**: Low

**3.5 Upgrade ProjectCard**
- Wrap in Card component
- Badge for status
- Colored left accent stripe
- Relative date formatting
- **Risk**: Low

**3.6 Upgrade ProjectsPanel**
- Same pattern as HabitsPanel
- **Risk**: Low

**3.7 Upgrade ProjectDetailModal**
- Entrance/exit animations
- Glass-morphism backdrop
- Improved close button
- Styled timeline visualization
- **Risk**: Low

**3.8 Upgrade DailySummaryCard**
- Styled stat cards
- Number counting animation
- Improved chart styling
- **Risk**: Low

**3.9 Upgrade TimeDistributionChart**
- Animated bar growth
- Hover tooltips
- Rounded bars, rank indicators
- **Risk**: Low

### Phase 4: Component-Level Polish (Other Systems)

**4.1 Upgrade floating ball**
- Refined pulse-soft animation
- Ambient particle effect
- Gradient stroke on icon
- Improved hover effect
- **Risk**: Low

**4.2 Upgrade Header expansion**
- Glass-morphism backdrop
- Improved button hover states
- Styled memory toggle
- **Risk**: Low

**4.3 Upgrade Asker expansion**
- Glass-morphism container
- Styled placeholder
- Send button animation
- **Risk**: Low

**4.4 Upgrade notification cards**
- Spring easing for entrance
- Auto-dismiss progress bar
- Improved glass-morphism
- Hover elevation
- Stacking animation
- **Risk**: Medium

**4.5 Upgrade SettingsPage**
- Section icons
- Sliding pill indicator for tabs
- Use Card component
- Staggered entrance animations
- Improved AI provider selection
- Pulsing status indicator
- **Risk**: Medium (557 lines)

**4.6 Upgrade FileBrowser**
- Skeleton, EmptyState, Card components
- File type icons
- Improved storage bar
- Animated cleanup modal
- **Risk**: Low

**4.7 Upgrade showNotification toast**
- CSS classes instead of inline styles
- Type-based icons and colors
- Spring easing
- Stacking support
- **Risk**: Low

**4.8 Upgrade Toggle component**
- Bounce animation with spring easing
- Glow ring when enabled
- Consistent sizing
- **Risk**: Low

### Phase 5: Global Refinements

**5.1 Improve custom scrollbar**
- Wider thumb on hover
- Auto-hide behavior
- **Risk**: Low

**5.2 Improve focus management**
- Global `.focus-ring` utility
- Apply to all interactive elements
- **Risk**: Low

**5.3 Improve native form element styling**
- Custom date/time input styling
- Custom select dropdown
- Dark theme color-scheme
- **Risk**: Medium (browser-specific)

**5.4 Add page-level transitions**
- Fade transitions for tab/content switches
- Spring easing for floating ball
- **Risk**: Low

**5.5 Add prefers-reduced-motion support**
- Disable animations when requested
- **Risk**: Low

### Phase 6: Quality Assurance

**6.1 Visual regression audit**
- Manual verification of all pages
- **Risk**: Low

**6.2 Performance audit**
- GPU-composited animations only
- Bounded backdrop-filter usage
- **Risk**: Low

**6.3 Remove console.log statements**
- Clean up debug logs
- **Risk**: Low

## File Inventory

**New Files (7):**
- `/vision-jarvis/src/styles/design-tokens.css`
- `/vision-jarvis/src/styles/animations.css`
- `/vision-jarvis/src/components/ui/Skeleton.tsx`
- `/vision-jarvis/src/components/ui/Card.tsx`
- `/vision-jarvis/src/components/ui/Badge.tsx`
- `/vision-jarvis/src/components/ui/EmptyState.tsx`
- `/vision-jarvis/src/components/ui/FilterChips.tsx`

**Modified Files (17):**
- `/vision-jarvis/src/styles/global.css`
- `/vision-jarvis/src/components/memory/MemoryTabs.tsx`
- `/vision-jarvis/src/components/memory/MemoryPage.tsx`
- `/vision-jarvis/src/components/memory/HabitCard.tsx`
- `/vision-jarvis/src/components/memory/HabitsPanel.tsx`
- `/vision-jarvis/src/components/memory/ProjectCard.tsx`
- `/vision-jarvis/src/components/memory/ProjectsPanel.tsx`
- `/vision-jarvis/src/components/memory/ProjectDetailModal.tsx`
- `/vision-jarvis/src/components/memory/DailySummaryCard.tsx`
- `/vision-jarvis/src/components/memory/TimeDistributionChart.tsx`
- `/vision-jarvis/src/components/FloatingBall/Ball.astro`
- `/vision-jarvis/src/components/FloatingBall/Header.astro`
- `/vision-jarvis/src/components/FloatingBall/Asker.astro`
- `/vision-jarvis/src/pages/notification.astro`
- `/vision-jarvis/src/components/settings/SettingsPage.tsx`
- `/vision-jarvis/src/components/files/FileBrowser.tsx`
- `/vision-jarvis/src/lib/utils.ts`
- `/vision-jarvis/src/components/ui/Toggle.tsx`

## Success Criteria

- [ ] All colors, radii, shadows, and timing values reference CSS custom properties
- [ ] Border-radius consolidated from 9+ variants to 6-value scale
- [ ] All loading states use Skeleton component
- [ ] All empty states use EmptyState component
- [ ] All cards have hover elevation effect
- [ ] Notification cards have progress bar and spring entrance animation
- [ ] Floating ball has refined ambient animation
- [ ] Tab switching has smooth content fade transition
- [ ] Modal open/close is animated with backdrop blur
- [ ] Focus rings visible on all interactive elements
- [ ] `prefers-reduced-motion` support
- [ ] No console.log statements
- [ ] No visual regressions
- [ ] GPU-composited animations only

## Risks and Mitigations

- **Wide blast radius of global.css migration**: Migrate incrementally, verify after each group
- **backdrop-filter performance**: Use only on small-area elements
- **Native date/time input styling**: Test in Tauri WebView, add color-scheme: dark
- **SettingsPage complexity**: Only change styling, not business logic
- **Floating ball animation**: Keep animation on inner element only

---

**Agent ID for resuming**: a6f5d59ab873493d2
