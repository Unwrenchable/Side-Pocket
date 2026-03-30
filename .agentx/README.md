# .agentx — Side Pocket Apparel

Agent configuration for the Side Pocket Apparel e-commerce site.

Uses [agent-tools](https://github.com/Unwrenchable/agent-tools) for capability management.

## Agents
- `side-pocket-orchestrator` — overall workflow coordinator
- `side-pocket-frontend` — HTML/CSS/JS, responsive design
- `side-pocket-backend` — Node.js/Express, auth, Stripe
- `side-pocket-deployment` — Vercel deploy, CI/CD

## Usage
```bash
python -m agent_tools.cli list
python -m agent_tools.cli check side-pocket-backend --profile balanced
```
