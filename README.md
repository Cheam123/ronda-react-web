# Ronda web

Laravel 9 back end with a React front end. Controllers return
[Inertia](https://inertiajs.com) responses (`Inertia::render('Tasks/Index', [...])`)
instead of Blade views; the page components live in `resources/js/Pages`.

## Stack

- Laravel 9, `inertiajs/inertia-laravel`, Ziggy (`route()` in TypeScript)
- React 18 + TypeScript (strict), built with Vite
- Bootstrap 5 with the Minible theme SCSS (`resources/scss`)

## Getting started

```bash
composer install
npm install
php artisan migrate   # needs a configured .env (none is committed)

npm run dev          # Vite dev server with hot reload
php artisan serve
```

## Scripts

| Command             | What it does                             |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Vite dev server                          |
| `npm run build`     | Type-check, then build to `public/build` |
| `npm run typecheck` | `tsc --noEmit`                           |
| `npm run lint`      | ESLint over `resources/js`               |
| `npm run format`    | Prettier over `resources/js`             |
| `php artisan test`  | PHPUnit                                  |

## Front-end layout

```
resources/js
├── app.tsx              Inertia bootstrap (resolves Pages/<Name>.tsx)
├── Pages/               One component per Inertia page, grouped by module.
│   └── <Module>/Partials/   Pieces used only by that module's pages
├── Components/          Reusable components, grouped by concern
│   ├── ui/              Buttons, cards, tables, modals, pagination…
│   ├── form/            Generic inputs (TextInput, Select, SearchSelect…)
│   ├── feedback/        Toasts and server flash messages
│   ├── forms/           The Forms module: renderer, field inputs, builder/
│   ├── tasks/           Task summary, activity timeline and composer
│   └── …
├── Layouts/             App shell (AppLayout) and guest layout
├── hooks/               Shared hooks (useAuth, useFilters, useFormFill…)
├── lib/                 Framework-free helpers (http, dialogs, format…)
│   └── forms/           Form schema, conditions and process logic
└── types/               Shared TypeScript types (page props, models)
```

Server data reaches pages as typed props, shaped by API resources in
`app/Http/Resources`. Shared props (auth user, abilities, flash messages) come
from `app/Http/Middleware/HandleInertiaRequests.php`.

### Blade that remains

- `resources/views/app.blade.php` — the Inertia root document.
- `resources/views/legal/*` — public privacy, terms and account-deletion
  pages. Kept server-rendered so crawlers (the Play Console) get the text
  without running JavaScript; styled by `resources/scss/legal.scss`.
- `resources/views/pdf/*` — PDF exports rendered by DomPDF.
- `resources/views/errors/*` — Laravel's fallback error pages, used in debug
  mode and for statuses `Pages/Errors/Status` does not cover (see
  `app/Exceptions/Handler.php`).
- `resources/views/maintenance.blade.php` — for `php artisan down --render`.

### Conventions

- Components are function components with typed props; one component per file.
- Form condition logic in `resources/js/lib/forms/conditions.ts` mirrors
  `app/Services/FormConditionEvaluator.php` — change both together.
- Stored rich text is rendered through `Components/ui/SafeHtml` (DOMPurify).
- Formatting is Prettier (4 spaces, single quotes, 120 columns); run
  `npm run lint` and `npm run typecheck` before committing.
