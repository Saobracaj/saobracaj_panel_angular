# saobracaj_panel_angular/ — Angular admin panel

Angular (standalone components, SSR-enabled) admin UI, talking to the GraphQL API via Apollo Client. Provides a markdown editor and law ("zakon") viewer for maintaining question comments. See `MARKDOWN_EDITOR_README.md` and `ZAKON_VIEWER_README.md`.

## Conventions

- **The API endpoint is centralized** in `src/app/constants/api.constants.ts` (`API_CONSTANTS.SERVER_URL` + `/graphql`); Apollo reads it in `src/app/app.config.ts` via `getGraphQLUrl()`. Change the URL **there**, never per-component.
- **Because of SSR, guard against direct `localStorage`/`window` access** outside the browser platform — auth tokens live in `localStorage`, so anything touching them must be platform-checked.
