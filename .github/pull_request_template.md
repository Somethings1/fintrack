## Change and risk
Explain the behavior changed, tenant boundaries, and rollback strategy.

## Verification
- [ ] Required CI passes at this exact head commit.
- [ ] New behavior has failure-path tests, not just a happy path.
- [ ] No cloud credentials, personal financial data, or raw prompts are logged.
- [ ] Any schema/index or operational migration is documented.
- [ ] AI outputs remain untrusted proposals; financial writes require confirmation.

## Release blockers
List any unverified production dependency or operator action explicitly.
