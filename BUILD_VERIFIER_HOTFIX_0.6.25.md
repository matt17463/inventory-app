# Build Verifier Hotfix — 0.6.25

The production bundle verifier previously searched for the source-code comment:

```text
Viewing a pull sheet must be read-only.
```

Vite removes comments from production bundles, causing a false failure after a
successful build. The verifier now checks for a real runtime string that remains
in the finished bundle:

```text
This pull sheet exists, but it currently has no saved job-item lines.
```

No application behavior changed.
