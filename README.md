# ScholarCheck

A student OSINT project that investigates scholarship websites using public evidence. It never declares a scholarship authentic or fraudulent.

[Open the hosted app](https://scholarcheck-osint.piyushgoilkar3.chatgpt.site/) (the hosted deployment is private to its owner).

## Run locally

Install Node.js 22 or newer. No npm dependencies or API keys are required.

```sh
npm run dev
```

Open http://127.0.0.1:5180. Enter a public website URL. Optionally enter an exact scholarship name and a trusted organiser page. Click **Check website**. A labelled sample report also works without network access.

```sh
npm test
npm run build
npm run validate
```

## How it works

- Server-side requests retrieve one public HTML page, following at most four redirects. Every destination is validated and checked through public DNS. Local names, IP literals, credentials, ports, query strings and restricted network addresses are rejected.
- RDAP supplies domain registration dates when available. Common compound suffixes are supported; this is not a complete public-suffix parser. The queried registration domain is shown in the evidence.
- HTTPS is an observed transport property, not proof of identity. Certificate expiry details are not included.
- Matching contact email domains, eligibility wording and contact references are extracted from the page. Application, processing and upfront-fee phrases trigger contextual warning signs. Simple negative phrases such as “no application fee” are excluded; more complex wording can still yield false positives or misses.
- An optional organiser reference is retrieved and checked for the exact scholarship name plus an HTML link to the submitted domain. This does not authenticate the organiser or search the web automatically.
- Reports display observed clues, warning signs and unknown checks, with source links and quotations. There is no legitimacy score and no ML model.
- Download the PDF evidence report and retain it for your project demonstration. No accounts or report database are used.

## Architecture

`worker/page.html` is the responsive frontend. `worker/analyzer.js` implements public-data collection and transparent rules. `worker/handler.js` serves the production API on Cloudflare Workers. `scripts/build.mjs` bundles these into a standalone Worker; `scripts/dev.mjs` runs a local Node HTTP server.

Production includes origin checks, a five-analysis per-isolate concurrency limit, and a one-minute per-IP per-isolate cooldown. These in-memory controls are not a global distributed rate limiter. The local server binds to loopback and is for development, not public deployment. Public DNS validation cannot guarantee prevention of every DNS rebinding scenario; the host platform must also enforce outbound network isolation before deploying in other environments.

## Privacy and limits

Submitted domains are disclosed to Cloudflare DNS and RDAP services; the target website receives a page request. No login or private document access occurs. Reports are held only in browser memory, though hosting/network providers may retain operational logs. No automatic persistent history is created.

Blocked pages, JavaScript-rendered content, login walls, PDFs, large pages, timeouts and unavailable registration records produce unknown findings. An old domain, HTTPS or a matching email cannot prove legitimacy. This tool is a research aid; contact the organiser through an independently trusted channel before submitting personal information or payment.

## Data source references

- RDAP bootstrap: https://about.rdap.org/
- Public DNS JSON API: https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/

## Suggested demonstration

Show the labelled sample report, run a live check on a public page, inspect each evidence link, demonstrate an invalid local URL being rejected, and download the report. Explain why an unknown check is not evidence of fraud.
