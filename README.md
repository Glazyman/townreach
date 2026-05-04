# TownReach Municipal Outreach SaaS

This workspace turns the original static municipal dashboard mockup into a Next.js MVP for finding verified municipal contacts, composing email through a user inbox, and tracking replies.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## What Is Implemented

- Next.js App Router dashboard using the visual language from `DESIGN.md`.
- Cascading `State > County > Municipality > Department` filters.
- Verified contact results with source URL, confidence, and last-checked metadata.
- Right-side email composer with reusable templates and Gmail/Outlook provider selection.
- Simulated send endpoint at `/api/email/send` that returns a provider thread/message ID.
- Simulated reply sync endpoint at `/api/email/sync`.
- Supabase schema with organizations, members, geography, departments, contacts, email accounts, outreach threads, messages, reply events, and RLS policies.

## Production Wiring

The app runs with local seed data by default. To connect real services:

1. Create a Supabase project.
2. Run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Add Gmail OAuth credentials as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Add Microsoft OAuth credentials as `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`.
6. Replace the simulated body of `lib/email-providers.ts` with provider API calls using stored per-user refresh tokens.

## Geography And Contacts

Use Census/Gazetteer data for authoritative state, county, place, and county subdivision geography. Use public municipal staff-directory/contact pages as source URLs for contacts, then mark records verified only after review.
