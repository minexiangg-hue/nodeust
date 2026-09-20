# Build directory incident and recovery

During isolated-build preparation, the source-copy step completed but the subsequent `npm run build` inherited `/home/ubuntu/nodeust` as its working directory. This was an execution error. The build loaded the local environment and cleared the existing `.next/standalone` directory. No application request intended to mutate data, migration, or configuration change was performed.

The root build process tree was terminated immediately after detection. The existing service remained active and `/login` returned 200, but its process working directory was marked deleted, so that check alone was insufficient evidence of health.

Recovered `.next` from `/home/ubuntu/nodeust-backups/20260916T183515Z-before-email-auth/candidate-next`, after checking its BUILD_ID was the original `s_N0AgjqzUmDaEED5XFpr`. Preserved the interrupted build in `/tmp/nodeust-interrupted-root-build-20260919`. Restarted `nodeust.service` on the restored same version. Did not restore or overwrite the database or change environment/proxy configuration.

Post-recovery checks: service active; local `/login` HTTP 200; all 10 script/style/static resources referenced by the returned login page HTTP 200. Evidence: `build-recovery-assets.json`. This does not establish every logged-in workflow; no claim is made that the incident had zero user impact.

The isolated build was then started with tool workdir `/tmp/nodeust-match-build-20260919-current` and shell guards asserting exact `$PWD` and absence of `.env.local`. Its output log is `/tmp/nodeust-isolated-correct-build.log`. The source copy has 265 hashed files in `source-manifest.json` and excludes environment files.
