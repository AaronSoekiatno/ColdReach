# 🚀 Deployment Checklist

## Pre-Deployment

### Code Changes
- [ ] All changes committed to git
- [ ] Sitemap created (`app/sitemap.ts`)
- [ ] Robots.txt updated with sitemap reference
- [ ] Layout.tsx has Google verification tag (optional backup)
- [ ] No linter errors
- [ ] Build test passes locally (`npm run build`)

### Environment Variables
- [ ] `NEXT_PUBLIC_SITE_URL=https://joinhermes.co` set in production
- [ ] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` set (optional, for HTML tag method)
- [ ] All other required env vars configured (Supabase, Stripe, etc.)

## Git & Push

- [ ] Check current branch: `git branch`
- [ ] Stage all changes: `git add .`
- [ ] Commit changes: `git commit -m "Add sitemap and SEO improvements"`
- [ ] Push to remote: `git push origin main` (or your branch)

## DNS Verification (Google Search Console)

- [ ] Added TXT record at DNS provider:
  - Name: `@` (or `joinhermes.co`)
  - Type: `TXT`
  - Value: `google-site-verification=v8FAp5kZkt3UeHXb6RXHIPsJpQhejkxGx_GLZ!`
- [ ] Waited 5-60 minutes for DNS propagation
- [ ] Verified DNS record exists: https://mxtoolbox.com/TXTLookup.aspx
- [ ] Went to Google Search Console
- [ ] Clicked "VERIFY"
- [ ] Saw "Ownership verified" ✅

## Deployment

### Vercel (if using)
- [ ] Code pushed to GitHub/GitLab
- [ ] Vercel auto-deployed (or manually triggered)
- [ ] Build completed successfully
- [ ] Deployment URL accessible

### Manual Build (if needed)
- [ ] Run: `npm run build`
- [ ] Build succeeds without errors
- [ ] Run: `npm start` (test production build locally)

## Post-Deployment Verification

### Website Checks
- [ ] Homepage loads: `https://joinhermes.co`
- [ ] Sitemap accessible: `https://joinhermes.co/sitemap.xml`
- [ ] Robots.txt accessible: `https://joinhermes.co/robots.txt`
- [ ] All pages load correctly
- [ ] No console errors in browser

### Google Search Console
- [ ] Property shows as "Verified" in Search Console
- [ ] Submitted sitemap: `sitemap.xml`
- [ ] Sitemap status shows "Success"
- [ ] Requested indexing for homepage via URL Inspection
- [ ] Requested indexing for key pages (`/privacy`, `/terms`)

### SEO Verification
- [ ] View page source - Google verification meta tag present (if using HTML method)
- [ ] Sitemap XML is valid and contains all pages
- [ ] Robots.txt allows Googlebot

## Ongoing Monitoring

### First Week
- [ ] Check Search Console daily for:
  - Coverage issues
  - Indexing status
  - Performance data (may take a few days)
- [ ] Monitor for any errors or warnings

### Weekly
- [ ] Review Search Console Performance report
- [ ] Check Core Web Vitals
- [ ] Review search queries bringing traffic
- [ ] Monitor mobile usability

## Quick Commands Reference

```bash
# Check git status
git status

# Stage all changes
git add .

# Commit
git commit -m "Your message here"

# Push to main
git push origin main

# Test build locally
npm run build
npm start

# Check DNS propagation
nslookup -type=TXT joinhermes.co
# Or visit: https://mxtoolbox.com/TXTLookup.aspx
```

## Troubleshooting

### If DNS verification fails:
- [ ] Wait longer (up to 24 hours)
- [ ] Double-check TXT record value (exact match, no extra spaces)
- [ ] Verify record is at root domain (`@`)
- [ ] Try verifying again in Search Console

### If sitemap fails:
- [ ] Check sitemap URL is accessible
- [ ] Verify XML is valid
- [ ] Check robots.txt allows crawling
- [ ] Wait a few minutes and resubmit

### If build fails:
- [ ] Check for TypeScript errors: `npm run type-check`
- [ ] Check for lint errors: `npm run lint`
- [ ] Review build logs for specific errors
- [ ] Ensure all dependencies installed: `npm install`

---

**Last Updated:** $(date)
**Status:** ⏳ Ready to deploy

