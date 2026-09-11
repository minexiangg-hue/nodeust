# Reproducible match study

The 2026-09-11 report lives in `reports/match-study-2026-09-11/report.md`.
This is a seeded, scenario-based synthetic assessment, not human relevance labels.
The baseline imports the exact function used by the application. Intent labels
are used only for scoring, never supplied to any matcher.

## Existing results: no database or server needed

Extract `logs.zip` into the report directory if its local `artifacts/` is absent.
With project dependencies installed and Node 24:

```bash
node scripts/match-study/analyze.mjs
python3 scripts/match-study/report.py
```

This verifies the semantic seed, exactly replays all 500 logged feed views,
recomputes relevance, and tests 30 alternative arrival orders. The archived
UUIDs and timestamps make offline replay exact; a new HTTP run has newly assigned
IDs and concurrent arrival times and is not expected to be byte-identical.

`review.html` embeds only synthetic data and works offline. `roles-summary.csv`
is a compact per-student export. Raw artifacts, the generated HTML and ZIP are
kept locally and ignored by Git to avoid committing megabytes of generated data.
The report, compact statistics and reproduction scripts are normal source files.

## Fresh API/browser run (isolated MySQL only)

1. Create a new output directory; set `MATCH_STUDY_OUTPUT` to it. A completed
   `summary.json` cannot be overwritten by the runner.
2. `node scripts/match-study/setup.mjs` uses local `sudo mysql` to create a new
   `nodeust_matchstudy_<random>` schema and restricted database user. It copies
   and applies the checked-in migrations. It writes a mode-600 environment at
   `/tmp/nodeust-matchstudy-test.env`; never commit or print that file.
3. Build the application in a **fresh isolated copy**, excluding `.env*`, `.next*`,
   `.git` and `node_modules`; install or link project dependencies there. Do not
   replace the running production build to run this study.
4. From that build directory, start its standalone server:
   `node --env-file=/tmp/nodeust-matchstudy-test.env .next/standalone/server.js`.
   This binds only `127.0.0.1:3102`, with maintenance off and the test-only identity
   secret. The runner refuses other URLs/schema names or a DB account that can
   see unrelated schemas. It may clear only an empty DB or known transport QA
   fixtures. All 500 study identities are ordinary members during evaluation.
5. From the source root:
   `node --env-file=/tmp/nodeust-matchstudy-test.env scripts/match-study/run.mjs`.
   It publishes 3,746 posts by the real API, verifies stored records, then reads
   and scores every member's feed. Logs never contain authentication headers.
6. Run `browser.mjs` with the same `--env-file`. Set `PLAYWRIGHT_MODULE` and
   `CHROMIUM_PATH` if the server's cached browser paths do not exist. It opens
   all 500 real pages, 250 at 390px and 250 at 1440px, without mocked APIs.
7. Run `analyze.mjs`. `report.py` renders the original archived report directory;
   it deliberately does not overwrite its report with another run's claims.
8. Stop the dedicated preview, then run `node scripts/match-study/cleanup.mjs`.
   It only drops the random schema/user recorded by setup, removes the private
   environment and temporary migration copy, and retains study logs.

The report also includes transport feature checks on the real isolated API and
12 language/viewport combinations. Those preceded corpus creation; the runner
removed their known disposable fixtures before provisioning the 500 students.

## Interpretation

Gold labels describe potential compatibility, not successful exchanges. Exact
housing equality can accidentally return a useful miscategorized post; such a
contact is counted as relevant but does not imply semantic understanding.
Full-corpus and normalized variants are offline ablations, not deployed code.
The corpus covers a bounded set of themes, six UG halls and six transport places.
A future semantic model needs independent free-form and adversarial annotation,
not training and testing solely on this generator.
