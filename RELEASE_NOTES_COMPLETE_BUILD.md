# Release 0.6.16

This release consolidates all previously generated corrections into one complete source tree.

Final corrections beyond the original 0.6.14 package:

1. Deployment Health page, route, navigation entry, and function are included together.
2. ESLint separates browser and Node execution environments, so `process` and `Buffer` are valid in Netlify functions.
3. React compiler-oriented lint rules that incorrectly blocked the established asynchronous loading patterns are non-blocking.
4. `useFinishedInventoryForJobItem` was renamed to `applyFinishedInventoryToJobItem` because it is an ordinary API function, not a React hook.
5. `useRule` was renamed to `applyRule` because it is an ordinary click-handler helper, not a React hook.
6. The latest guarded pull-sheet unique-index SQL is included.
7. Stale deployable files remain excluded.
