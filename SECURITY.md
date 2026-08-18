# Cafe POS Security Checklist

## Authentication
- [x] NextAuth v5 with credentials provider
- [x] Password hashing with bcryptjs (salt rounds: 12)
- [x] Session-based authentication
- [x] Password minimum 8 characters
- [x] Role-based access control (ADMIN > MANAGER > CASHIER > KITCHEN)

## Data Protection
- [x] All server actions validate authentication
- [x] Role checks on all mutation operations
- [x] Input validation with Zod schemas
- [x] SQL injection prevented via Prisma ORM
- [x] No raw SQL queries with string interpolation
- [x] Passwords never returned in API responses
- [x] Audit logging on all financial operations
- [x] Financial records never deleted (reversal entries only)

## HTTP Security
- [x] X-Frame-Options: DENY (prevents clickjacking)
- [x] X-Content-Type-Options: nosniff
- [x] Content-Security-Policy configured
- [x] HSTS enabled (63072000 seconds)
- [x] Referrer-Policy: strict-origin-when-cross-origin
- [x] Permissions-Policy: camera, microphone, geolocation disabled

## Financial Integrity
- [x] Double-entry bookkeeping (debit = credit enforced)
- [x] Journal entry balance validation before saving
- [x] Duplicate journal entry prevention (reference type + ID)
- [x] Duplicate payment protection (2-minute window)
- [x] Overpayment protection on orders
- [x] Refund amount validation against total paid
- [x] Order-level discount bounds validation
- [x] Tax rate bounds validation (0-100%)

## Operational Security
- [ ] Rate limiting on login (implement in production)
- [ ] Account lockout after failed attempts (implement in production)
- [ ] Database backups (automated, see scripts/backup-db.sh)
- [ ] HTTPS enforced in production
- [ ] Secrets never committed to repository
- [ ] .env in .gitignore

## Monitoring
- [x] Health check endpoint (/api/health)
- [x] Error boundary for React errors
- [x] console.error for server-side error logging
- [ ] Error tracking service (Sentry, etc.) — configure in production
