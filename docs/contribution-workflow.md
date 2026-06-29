# CocoHusky Profile Contribution Workflow

This workflow keeps profile work useful, visible, and easy to track. The goal is to improve real repositories while making it clear what each asset is doing and what step it is currently in.

## Daily contribution loop

| Step | Action | Counts toward profile? | Done when |
| --- | --- | --- | --- |
| 1. Pick asset | Choose one repo, profile card, doc, workflow, or release asset that needs real work. | No | The target repo and outcome are named. |
| 2. Define work | Open or update a clear issue with context and acceptance criteria. | Yes, for issues | The issue explains why the work matters. |
| 3. Implement | Create a branch and make focused commits. | Yes, for commits if merged/default branch rules are met | The change is small and reviewable. |
| 4. Review | Open a PR or review an existing PR. | Yes, for PRs/reviews | The PR explains the change and testing. |
| 5. Verify | Run the smallest relevant checks or document manual verification. | No by itself | The result is recorded in the PR or issue. |
| 6. Merge/close | Merge the PR or close the issue with the outcome. | Commit/PR activity remains visible | The repo is better than before. |
| 7. Refresh profile | Bump image cache only when a visible profile asset changed. | Usually no | The profile README shows the current state. |

## Contribution quality rules

- Prefer useful issues, PRs, reviews, and commits over filler activity.
- Keep each issue tied to a real repo gap, bug, doc need, validation need, or release task.
- Keep commits focused so the history is easy to understand.
- Do not commit private credentials, local IP addresses, local hostnames, tokens, or personal notes.
- Avoid creating many empty branches, tiny whitespace commits, or duplicate issues just to change the contribution graph.

## Profile asset tracker

| Asset | Source | Current state | Next useful step |
| --- | --- | --- | --- |
| Hero banner | `assets/hero-banner.svg` | Live | Review copy whenever the personal site or positioning changes. |
| Section divider | `assets/section-divider.svg` | Live | Keep version query aligned when the SVG changes. |
| mmWave project card | `assets/project-mmwave-vislog.svg` | Live | Keep linked to `CocoHusky/mmWaveVizLog` and update after major firmware milestones. |
| Local Device Portal card | `assets/project-local-device-portal.svg` | Live | Verify the linked repo remains the best selected project. |
| Homelab/OpenClaw card | `assets/project-microserver-deployment.svg` | Live | Keep link/text aligned with the current strongest infrastructure repo. |
| GitHub stats card | `pszostak-stats.vercel.app/api` | Live, cache-bumped for B- | Refresh only when stats or styling visibly changes. |
| Top languages card | `pszostak-stats.vercel.app/api/top-langs` | Live | Refresh after meaningful repo/language changes. |
| Link badges | Shields.io links | Live | Verify LinkedIn, website, and Scholar URLs quarterly. |
| Profile views badge | `komarev.com/ghpvc` | Live | Leave unchanged unless badge styling changes. |
| Workflow tracker | `docs/contribution-workflow.md` | Live | Update this table when profile assets or daily workflow steps change. |

## Active repo backlog

| Repo | Current useful work | Tracking issue |
| --- | --- | --- |
| `mmWaveVizLog` | Add hardware/runtime validation matrix. | https://github.com/CocoHusky/mmWaveVizLog/issues/14 |
| `rapid-reader` | Add automated text cleanup/tokenization checks. | https://github.com/CocoHusky/rapid-reader/issues/10 |
| `url-pull-python` | Align README naming and release links. | https://github.com/CocoHusky/url-pull-python/issues/1 |
| `proxmox-homelab-guide` | Add rebuild preflight checklist. | https://github.com/CocoHusky/proxmox-homelab-guide/issues/3 |
| `openclaw-setup` | Expand README into a usable setup guide. | https://github.com/CocoHusky/openclaw-setup/issues/1 |

## Daily status template

Use this when updating an issue or PR:

```md
## Status

- Asset/repo:
- Step: Pick asset / Define work / Implement / Review / Verify / Merge-close / Refresh profile
- Progress:
- Check run:
- Next action:
```

## GitHub profile notes

GitHub profile contribution visibility depends on GitHub's own counting rules. Commits should use an email connected to the GitHub account and usually need to land on a default branch or `gh-pages` branch in a standalone repository. Issues, pull requests, and reviews should be genuine project work, not duplicate tracking noise.
