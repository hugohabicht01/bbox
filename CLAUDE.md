# CLAUDE.md - Development Guidelines

## Build & Development Commands
- Build: `npm run build`
- Dev server: `npm run dev` (port 3333)
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Tests: `npm run test` (uses Vitest)
- Preview: `npm run preview`
- Update deps: `npm run up`

## Code Style
- **TypeScript**: Strict mode with null checks
- **Components**: Vue 3 Composition API with `<script setup>` syntax
- **State**: Pinia stores in `/src/stores/`
- **Imports**: ES modules with `~/` alias for src directory
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Styling**: UnoCSS for utility-first CSS
- **Error handling**: Zod for validation, defensive programming with null checks
- **Types**: Define explicit types, avoid `any`, use Zod for schema validation

## Project Structure
Vue 3 SPA for bbox annotation with image handling and findings management.
