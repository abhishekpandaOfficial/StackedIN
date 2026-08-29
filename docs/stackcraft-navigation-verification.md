# StackCraft navigation verification

Production acceptance checklist:

- StackedIN root landing shows the normal `Craft` navigation item once the marketing header renders.
- StackedIN root landing shows a dedicated `Open StackCraft` CTA with the StackCraft mark.
- The marketing header remains fixed and readable while scrolling.
- `Craft` opens `/Craft`.
- `Open StackCraft` opens `/Craft/app`.
- A user already authenticated in StackedIN reaches `/Craft/app` through the same persisted Supabase session without a second sign-in.
- `/Craft` and `/Craft/app` use the StackCraft favicon and product browser title.
- StackCraft dashboard retains access to Overview, Career profile, Countries & roles, Applications, Workflows, and AEON.
