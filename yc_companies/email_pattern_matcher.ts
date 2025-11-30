/**
 * Email Pattern Matching & Verification
 *
 * Generates common email patterns from founder names and company domains,
 * then verifies them using Rapid Email Verifier (free API).
 *
 * This approach is similar to Apollo.io and Hunter.io pattern matching.
 */

export interface EmailPattern {
  pattern: string;
  email: string;
  confidence: number; // 0.0-1.0 based on pattern popularity
}

export interface EmailVerificationResult {
  email: string;
  isValid: boolean;
  isDeliverable: boolean;
  reason?: string;
  confidence: number;
}

/**
 * Parse full name into first and last names
 */
function parseFullName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 0) {
    return { first: '', last: '' };
  }

  if (parts.length === 1) {
    return { first: parts[0].toLowerCase(), last: '' };
  }

  // Handle common patterns: "First Last", "First Middle Last", etc.
  const first = parts[0].toLowerCase();
  const last = parts[parts.length - 1].toLowerCase();

  return { first, last };
}

/**
 * Generate common email patterns for a founder
 * Based on patterns used by Apollo.io, Hunter.io, and common corporate email formats
 *
 * Patterns ranked by popularity (most common first):
 * 1. {first}@{domain} - 40% of companies
 * 2. {first}.{last}@{domain} - 25% of companies
 * 3. {first}{last}@{domain} - 15% of companies
 * 4. {f}{last}@{domain} - 10% of companies
 * 5. {first}_{last}@{domain} - 5% of companies
 * 6. {last}@{domain} - 3% of companies
 * 7. {last}.{first}@{domain} - 2% of companies
 */
export function generateEmailPatterns(
  founderName: string,
  companyDomain: string
): EmailPattern[] {
  const { first, last } = parseFullName(founderName);
  const patterns: EmailPattern[] = [];

  if (!first || !companyDomain) {
    return patterns;
  }

  // Clean domain (remove www, http, etc.)
  const domain = companyDomain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase();

  // Pattern 1: first@domain (40% confidence)
  patterns.push({
    pattern: '{first}@{domain}',
    email: `${first}@${domain}`,
    confidence: 0.40,
  });

  if (last) {
    // Pattern 2: first.last@domain (25% confidence)
    patterns.push({
      pattern: '{first}.{last}@{domain}',
      email: `${first}.${last}@${domain}`,
      confidence: 0.25,
    });

    // Pattern 3: firstlast@domain (15% confidence)
    patterns.push({
      pattern: '{first}{last}@{domain}',
      email: `${first}${last}@${domain}`,
      confidence: 0.15,
    });

    // Pattern 4: flast@domain (10% confidence)
    patterns.push({
      pattern: '{f}{last}@{domain}',
      email: `${first[0]}${last}@${domain}`,
      confidence: 0.10,
    });

    // Pattern 5: first_last@domain (5% confidence)
    patterns.push({
      pattern: '{first}_{last}@{domain}',
      email: `${first}_${last}@${domain}`,
      confidence: 0.05,
    });

    // Pattern 6: last@domain (3% confidence)
    patterns.push({
      pattern: '{last}@{domain}',
      email: `${last}@${domain}`,
      confidence: 0.03,
    });

    // Pattern 7: last.first@domain (2% confidence)
    patterns.push({
      pattern: '{last}.{first}@{domain}',
      email: `${last}.${first}@${domain}`,
      confidence: 0.02,
    });
  }

  return patterns;
}

/**
 * Verify email using Rapid Email Verifier API
 * Free API: https://rapid-email-verifier.fly.dev
 * Limit: 1000 emails/month, 25ms avg response time
 *
 * API Response:
 * {
 *   "email": "test@gmail.com",
 *   "validations": {
 *     "syntax": true,
 *     "domain_exists": true,
 *     "mx_records": true,
 *     "mailbox_exists": true,
 *     "is_disposable": false,
 *     "is_role_based": false
 *   },
 *   "score": 100,
 *   "status": "VALID" | "INVALID" | "RISKY"
 * }
 */
export async function verifyEmailWithRapid(
  email: string
): Promise<EmailVerificationResult> {
  try {
    const url = `https://rapid-email-verifier.fly.dev/api/validate?email=${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        email,
        isValid: false,
        isDeliverable: false,
        reason: `API error: ${response.status}`,
        confidence: 0,
      };
    }

    const data = await response.json();

    // Check validation results
    const validations = data.validations || {};
    const status = data.status || 'INVALID';
    const score = data.score || 0;

    const isValid = status === 'VALID';
    const hasSyntax = validations.syntax === true;
    const hasDomain = validations.domain_exists === true;
    const hasMX = validations.mx_records === true;
    const mailboxExists = validations.mailbox_exists === true;
    const isDisposable = validations.is_disposable === true;
    const isRoleBased = validations.is_role_based === true;

    // Email is deliverable if:
    // 1. Valid status
    // 2. Mailbox exists
    // 3. Not disposable
    // 4. Has MX records
    const isDeliverable = isValid && mailboxExists && !isDisposable && hasMX;

    // Calculate confidence score (0-1) based on the API score (0-100)
    const confidence = score / 100;

    // Determine reason if not deliverable
    let reason = 'Email verified successfully';
    if (!isDeliverable) {
      if (!hasSyntax) reason = 'Invalid email syntax';
      else if (!hasDomain) reason = 'Domain does not exist';
      else if (!hasMX) reason = 'No MX record';
      else if (!mailboxExists) reason = 'Mailbox does not exist';
      else if (isDisposable) reason = 'Disposable email';
      else if (isRoleBased) reason = 'Role-based email';
      else reason = 'Email validation failed';
    }

    return {
      email,
      isValid,
      isDeliverable,
      reason,
      confidence,
    };
  } catch (error) {
    console.warn(`Email verification failed for ${email}:`, error);
    return {
      email,
      isValid: false,
      isDeliverable: false,
      reason: error instanceof Error ? error.message : 'Verification failed',
      confidence: 0,
    };
  }
}

/**
 * Find founder email by generating and verifying patterns
 * Returns the first valid email found
 */
export async function findFounderEmailByPattern(
  founderName: string,
  companyDomain: string
): Promise<EmailVerificationResult | null> {
  console.log(`  🔍 Trying pattern matching for: ${founderName} @ ${companyDomain}`);

  // Generate patterns (sorted by confidence, most common first)
  const patterns = generateEmailPatterns(founderName, companyDomain);

  if (patterns.length === 0) {
    console.log(`     ⚠️  No patterns generated (missing name or domain)`);
    return null;
  }

  console.log(`     Generated ${patterns.length} email patterns`);

  // Try each pattern, starting with most common
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];

    console.log(`     ${i + 1}/${patterns.length} Testing: ${pattern.email} (${pattern.pattern}, ${(pattern.confidence * 100).toFixed(0)}% common)`);

    // Verify the email
    const result = await verifyEmailWithRapid(pattern.email);

    if (result.isDeliverable) {
      console.log(`     ✅ Found valid email: ${result.email} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
      return result;
    } else {
      console.log(`     ❌ Invalid: ${result.reason || 'Not deliverable'}`);
    }

    // Small delay to avoid rate limiting (1000/month = ~33/day = ~1.4/hour)
    // With 7 patterns per founder, we can test ~5 founders per hour safely
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`     ⚠️  No valid email found from ${patterns.length} patterns`);
  return null;
}

/**
 * Batch find emails for multiple founders
 * Tries patterns for each founder sequentially
 */
export async function findFounderEmailsBatch(
  founders: Array<{ name: string; companyDomain: string }>
): Promise<Map<string, EmailVerificationResult>> {
  const results = new Map<string, EmailVerificationResult>();

  for (const founder of founders) {
    const result = await findFounderEmailByPattern(founder.name, founder.companyDomain);

    if (result && result.isDeliverable) {
      results.set(founder.name, result);
    }
  }

  return results;
}

/**
 * Extract first and last name for pattern generation
 * (Exported for testing)
 */
export function extractFirstLastName(fullName: string): { first: string; last: string } {
  return parseFullName(fullName);
}
