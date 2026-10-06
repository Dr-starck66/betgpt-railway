# ASTRA AUTHORITY CITATION ENGINE Ω

Status model: PASS / PARTIAL / FAIL / UNVERIFIED.

Goal: turn BetGPT's public prediction register into evidence that legitimate third parties can inspect and cite.

## Always-on zero-cost layer

1. Pull `https://betgpt.live/evidence.json` and `evidence.csv`.
2. Hash both exports with SHA-256.
3. Build a citation kit with canonical proof URLs.
4. Search recent public coverage through GDELT DOC 2.0 for editorial opportunities.
5. Create a review queue. Nothing is emailed automatically unless a real author/contact is verified.
6. Reject paid placements, fake reviews, bulk spam and fabricated endorsements.
7. Persist snapshots in `data/authority/`.

## Optional third-party publishers

### Zenodo
The workflow can publish a dataset snapshot when BOTH are configured:
- repository secret `ZENODO_TOKEN`
- repository variable `ZENODO_AUTOPUBLISH=true`

No token = fail-closed skip. The site keeps working.

### Hugging Face
`data/authority/HUGGINGFACE_README.md` is generated for a public Dataset repository.
Publishing requires a Hugging Face credential with write-repository permission. Read-only OAuth is not enough.

### Kaggle
The authority pack is intentionally provider-neutral. Kaggle publication can be added when an authenticated write-capable API credential is available.

## Outreach gate

An opportunity may progress from `REVIEW` to outreach only if:
- the page is editorially relevant;
- an identifiable author/editor or official editorial contact exists;
- the pitch offers auditable data, not payment;
- the recipient has not already been contacted for the same angle;
- claims are supported by BetGPT public evidence.

Forbidden: fake testimonials, fake accounts, paid-link requests disguised as editorial outreach, mass unsolicited email and invented press mentions.
