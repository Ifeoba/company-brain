# Example Brains

This directory contains fully-populated example brains — real-domain brains where every file is complete, not a placeholder.

Example brains serve two purposes:
1. Show new users what "done" actually looks like across all eight files
2. Validate that the spec and templates produce something a real agent can use

## What makes a good example brain

- Every required file is fully populated (no `REPLACE WITH` placeholders remaining)
- The service is a real, narrow unit of work — not a hypothetical
- The unwritten rules came from real interviews, not imagination
- The evals include hard cases with non-obvious correct answers
- At least one proof log entry exists, with a named human sign-off

## Coming

The first example brain will cover a real operational service. Candidates:
- Monthly per-staff KPI compilation (HR → line managers)
- Inbound billing support email drafting
- Freelance invoice reconciliation

See the issue tracker for progress.

## Contributing an example

If you've built a brain using this platform and want to contribute it as an example, open a PR with the brain folder. The brain must pass the company-brain-validator at "Brain ready" before it's accepted.
