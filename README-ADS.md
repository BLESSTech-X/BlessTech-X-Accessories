# PhoneYa2 Ads — Subsystem Documentation

The advertising marketplace bolted onto PhoneYa2. Businesses sign up, submit
ads, admins approve them, and approved ads appear across the site.

**Completely independent of the shop's order flow and the agent network.**
Two separate systems, two separate failure domains.

---

## Table of Contents

1. [What this is](#what-this-is)
2. [Architecture](#architecture)
3. [File map](#file-map)
4. [Supabase project](#supabase-project)
5. [First-time setup](#first-time-setup)
6. [Admin user](#admin-user)
7. [Edge Functions](#edge-functions)
8. [Deploying](#deploying)
9. [Local development](#local-development)
10. [Testing checklist](#testing-checklist)
11. [Security model](#security-model)
12. [Ad lifecycle](#ad-lifecycle)
13. [Analytics](#analytics)
14. [Common problems](#common-problems)
15. [What's NOT in V1](#whats-not-in-v1)

---

## What this is

A self-serve advertising marketplace where Zambian businesses:

1. Create an advertiser account (business name, phone, email, password)
2. Build an ad (title, description, image, destination link)
3. Submit it for admin review
4. Get approved (or rejected with a reason)
5. Appear in sponsored carousels across the PhoneYa2 site
6. Share their ad link with their customers

**Growth thesis:** every advertiser becomes a traffic source for the whole
network. Their customers land on PhoneYa2 to see the ad, and discover other
Zambian businesses while they're there.

---

## Architecture
