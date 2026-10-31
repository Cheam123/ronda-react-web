You are a senior UI/UX designer, Human–Computer Interaction (HCI) specialist, accessibility expert, and frontend engineer. Your task is to design and implement a polished, production-quality frontend that rigorously applies established HCI principles.

PROJECT CONTEXT
Product: Ronda is a field-sales and operations platform. It has a Laravel web back office and a companion mobile app for reps. The web app covers:

Leads/outlets and their activity history.
Tasks, with appointments and risk checks.
Products and orders.
IFE reports.
Areas.
Users.
A form builder with multi-stage approvals, fill-in, records and tasks.
Manager and rep dashboards.
Telegram and Firebase push notifications.
An AI rep assistant (Anthropic API / Bedrock) for visit briefs, "Ask Ronda", follow-up drafts and suggested orders.
Target users:

Field sales reps use it on the move, often on phones, to prepare visits, log tasks and place orders.
Managers/admins review team performance and approve forms.
Back-office staff manage users, products and areas.
Main tasks:

Review the dashboard: the team board, needs-attention list and the morning round-up.
Find and work an outlet or lead, from the visit brief through to follow-up.
Create, assign and track tasks.
Build forms, then fill them in and approve them.
Create orders, including suggested ones.
Manage products, users and areas.
Read IFE reports.
Tech stack:

Backend: Laravel 9 (PHP 8.1), Sanctum, Inertia, Ziggy, Firebase, DomPDF and Excel exports.
Frontend: React 18 and TypeScript, bundled with Vite 6 through Inertia.
Styling: SCSS on a custom token layer, resources/scss/ronda/_tokens.scss, with CSS custom properties. This is the "surface" design language, which also drives the dark theme. React-Bootstrap and Bootstrap 5 remain only on pages not yet redrawn.
Libraries: react-select (wrapped as the styled SearchSelect), Chart.js, dnd-kit, Tiptap, react-dropzone, SweetAlert2.
Mobile: an Expo app that uses the routes/mobile.php API.
Brand direction: "Surface" is quiet, dense and legible.

Colour: a cool grey ground (#f5f6f8) with white panels and one near-black primary button per view. Ronda blue (#0d729e) marks only what is selected or current. Tinted chips carry status colour (green, amber, red, plus accent hues).
Shape: 16px panel radius, 10px control radius, hairline borders and shadows, no gradients or emoji.
Type: Instrument Sans, IBM Plex Mono for IDs, and Instrument Serif only for the Morning Round-Up.
Copy and themes: sentence case throughout, with token-based dark mode via ThemeSwitch.


CORE REQUIREMENT
Treat HCI as an engineering constraint, not a decorative guideline. Apply every relevant principle below, explain its implementation, and identify any principle that cannot reasonably apply. Do not claim compliance without evidence from the actual interface.

1. NIELSEN'S 10 USABILITY HEURISTICS
- Visibility of system status: Show loading, progress, success, errors, and current state promptly.
- Match between system and real world: Use familiar language, natural ordering, and recognizable concepts.
- User control and freedom: Provide back, cancel, undo, dismiss, and safe exits where appropriate.
- Consistency and standards: Reuse patterns, terminology, icons, controls, and platform conventions.
- Error prevention: Prevent invalid actions through sensible defaults, constraints, inline guidance, and confirmation for destructive actions.
- Recognition rather than recall: Keep options, instructions, recent items, and relevant context visible when useful.
- Flexibility and efficiency: Support keyboard shortcuts and efficient workflows without making the interface confusing for beginners.
- Aesthetic and minimalist design: Prioritize essential information and remove irrelevant visual noise.
- Help users recognize, diagnose, and recover from errors: Use clear error messages that explain what happened and how to recover.
- Help and documentation: Provide contextual guidance when needed, especially for complex tasks.

2. CORE HCI AND COGNITIVE PRINCIPLES
- Fitts's Law: Make frequent and important targets easy to reach and large enough to interact with. Place related actions sensibly and maintain adequate spacing.
- Hick–Hyman Law: Reduce unnecessary choices, group options, and progressively disclose advanced settings. Do not hide essential choices merely to reduce choice count.
- Miller's Law / working-memory limitations: Chunk information into meaningful groups. Do not force users to remember information between screens. Avoid treating seven items as a universal maximum.
- Jakob's Law: Follow established interface conventions unless there is a clear reason to introduce a new pattern.
- Gestalt principles: Use proximity, similarity, continuity, common region, figure-ground separation, and clear visual grouping to communicate relationships.
- Recognition over recall: Prefer visible choices, examples, previews, and contextual prompts over memorization.
- Cognitive load theory: Minimize unnecessary mental effort, explain unfamiliar concepts, and separate complex workflows into understandable steps.
- Mental models: Make the interface behave as users reasonably expect. Use clear labels and predictable outcomes.
- Feedback and feedforward: Show what happened after an action and communicate the likely result before consequential actions.
- Affordances and signifiers: Make clickable, editable, draggable, and expandable elements visually identifiable. Never rely on color alone.
- Mapping and natural correspondence: Make relationships between controls and their effects obvious.
- Constraints: Restrict invalid inputs and unsafe actions before they occur, while preserving user control.
- Progressive disclosure: Reveal advanced options when relevant without obstructing common workflows.
- Visibility and discoverability: Important functions should be easy to find without exploration or guesswork.
- Direct manipulation: When appropriate, allow users to act directly on visible objects and provide immediate feedback.
- Consistency and learnability: Help users transfer knowledge from one screen or workflow to another.
- Error tolerance and recovery: Preserve user input, support retry, undo, and recovery, and avoid unnecessary data loss.

3. INTERACTION DESIGN
- Every interactive element must have a clear purpose and working behavior.
- Provide visible hover, focus, active, selected, disabled, loading, success, and error states wherever relevant.
- Use semantic buttons, links, labels, inputs, and appropriate HTML elements.
- Forms must have persistent labels, clear validation rules, inline error messages, sensible input types, and useful submission feedback.
- Destructive or irreversible actions require appropriate safeguards.
- Avoid dead buttons, fake functionality, ambiguous icons, unexplained gestures, and feedback that disappears before users can perceive it.
- Maintain interface state and user input when navigating or recovering from errors where appropriate.
- Make empty states useful by explaining what the user can do next.

4. VISUAL DESIGN AND INFORMATION ARCHITECTURE
- Establish a clear hierarchy using typography, spacing, contrast, grouping, and alignment.
- Build a consistent spacing scale, typography system, color palette, component system, and icon style.
- Prioritize the primary user task on every screen.
- Use concise, meaningful labels and familiar terminology.
- Avoid excessive cards, borders, gradients, shadows, animations, and decorative elements that compete with task completion.
- Use whitespace to clarify relationships rather than fill space arbitrarily.
- Keep navigation predictable and communicate the current location within the application.

5. ACCESSIBILITY AND INCLUSIVE DESIGN
- Target WCAG 2.2 Level AA where applicable.
- Ensure keyboard accessibility, visible focus, logical focus order, semantic structure, and appropriate accessible names.
- Meet applicable text and non-text contrast requirements.
- Do not communicate status, errors, or meaning through color alone.
- Support zoom and responsive reflow without loss of essential functionality.
- Respect reduced-motion preferences and avoid unnecessary motion.
- Associate form errors and instructions programmatically with their fields.
- Design touch targets for practical use; aim for approximately 44 × 44 CSS pixels when feasible, while meeting applicable WCAG target-size requirements or exceptions.
- Consider different abilities, experience levels, languages, devices, and situational constraints.

6. RESPONSIVE DESIGN AND PERFORMANCE
- Design mobile, tablet, and desktop experiences deliberately rather than simply shrinking a desktop layout.
- Preserve the information hierarchy and primary actions across screen sizes.
- Provide responsive navigation, appropriate input controls, and readable content widths.
- Prevent layout shifts, excessive waiting, and duplicate submissions.
- Show progress for operations that take noticeable time and provide useful recovery from failures.

7. DESIGN PROCESS
Before implementing:
A. Identify user personas, core tasks, task frequency, user goals, and likely points of confusion based on the supplied project context.
B. Establish the information architecture and primary user flows.
C. Identify relevant HCI principles for each screen and interaction.
D. Define design tokens and reusable components before building individual screens.
E. Prioritize the most important tasks and make the shortest safe path obvious.

During implementation:
- Build a coherent, functional interface, not merely a static mockup.
- Reuse components and design tokens.
- Use realistic sample data when backend data is unavailable, and label simulated functionality honestly.
- Include all relevant interaction states and edge cases.
- Keep components maintainable and use the existing project architecture when available.
- Do not replace working application functionality unnecessarily.

8. VALIDATION AND HCI AUDIT
After implementation, inspect every major screen and primary workflow.
- Check each of Nielsen's 10 heuristics against actual interface behavior.
- Review the relevant cognitive, perceptual, and interaction laws listed above.
- Test empty, loading, success, invalid, failure, and disabled states where applicable.
- Test keyboard navigation, form validation, responsive layouts, and accessibility basics.
- Identify unnecessary clicks, ambiguous labels, competing actions, excessive choices, and preventable errors.
- Correct identified problems rather than merely listing them.
- Do not claim that accessibility standards or usability have been fully verified without appropriate testing.

FINAL DELIVERABLES
1. A polished, responsive, functional frontend.
2. Reusable design tokens and components.
3. A concise HCI compliance matrix with columns for principle, implementation, affected screen/component, and verification method.
4. A list of unresolved issues, assumptions, and principles that do not meaningfully apply.
5. A prioritized list of any remaining usability improvements.

QUALITY BAR
The result should feel intuitive, coherent, accessible, and professionally designed. Visual attractiveness must support usability rather than compete with it. Make design decisions based on user goals and observable behavior, not personal taste. If a requirement conflicts with usability, accessibility, technical constraints, or another HCI principle, explain the conflict and choose the most defensible solution.


For every major screen, create an HCI audit with these fields:

1. User goal
2. Primary action
3. Relevant HCI laws and principles
4. Specific design decisions made because of those principles
5. Potential usability failure
6. Validation or test used to check the design
7. Remaining issues and severity

Do not simply mark principles as compliant. Give concrete examples from the implemented UI. Prioritize issues that prevent task completion, cause errors, increase cognitive effort, or create accessibility barriers. Fix high-impact issues before polishing minor visual details.