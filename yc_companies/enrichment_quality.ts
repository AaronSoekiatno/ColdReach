/**
 * Enrichment Quality Assessment
 * 
 * Grades the quality of enriched startup data based on:
 * - Field completeness (critical vs important vs optional)
 * - Confidence scores
 * - Data validation results
 * 
 * Determines if enrichment should be marked as:
 * - 'excellent' (score >= 0.8, all critical fields)
 * - 'good' (score >= 0.6, most critical fields)
 * - 'fair' (score >= 0.4, some critical fields)
 * - 'poor' (score >= 0.2, few fields)
 * - 'failed' (score < 0.2, no critical fields)
 */

export interface EnrichmentQuality {
  overallScore: number; // 0.0 - 1.0
  fieldScores: Record<string, number>;
  criticalFieldsFound: number;
  criticalFieldsTotal: number;
  importantFieldsFound: number;
  importantFieldsTotal: number;
  optionalFieldsFound: number;
  optionalFieldsTotal: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
  missingCriticalFields: string[];
  issues: string[];
}

interface StartupRecord {
  id: string;
  name: string;
  description?: string;
  website?: string;
  founder_names?: string;
  founder_linkedin?: string;
  founder_emails?: string;
  job_openings?: string;
  funding_amount?: string;
  funding_stage?: string;
  location?: string;
  industry?: string;
  tech_stack?: string;
  target_customer?: string;
  market_vertical?: string;
  team_size?: string;
  founder_backgrounds?: string;
  [key: string]: any;
}

/**
 * Calculate enrichment quality score
 */
export function calculateEnrichmentQuality(
  startup: StartupRecord,
  extractedData: Partial<StartupRecord>,
  confidence: Record<string, number> = {}
): EnrichmentQuality {
  // Critical fields (must have for basic enrichment)
  const criticalFields = ['founder_names', 'website', 'description'];
  
  // Important fields (should have for good enrichment)
  const importantFields = [
    'founder_linkedin',
    'founder_emails',
    'job_openings',
    'funding_amount',
    'location',
    'industry',
  ];
  
  // Nice-to-have fields (optional but valuable)
  const optionalFields = [
    'tech_stack',
    'target_customer',
    'market_vertical',
    'team_size',
    'founder_backgrounds',
    'funding_stage',
  ];
  
  let criticalFound = 0;
  let importantFound = 0;
  let optionalFound = 0;
  const fieldScores: Record<string, number> = {};
  const missingCriticalFields: string[] = [];
  const issues: string[] = [];
  
  // Score critical fields (weight: 0.5)
  for (const field of criticalFields) {
    const existingValue = startup[field];
    const extractedValue = extractedData[field];
    const hasData = !!(existingValue || extractedValue);
    const conf = confidence[field] || (hasData ? 0.8 : 0);
    
    fieldScores[field] = conf;
    
    if (hasData && conf >= 0.7) {
      criticalFound++;
    } else {
      missingCriticalFields.push(field);
      if (hasData && conf < 0.7) {
        issues.push(`${field} has low confidence (${conf.toFixed(2)})`);
      }
    }
  }
  
  // Score important fields (weight: 0.3)
  for (const field of importantFields) {
    const existingValue = startup[field];
    const extractedValue = extractedData[field];
    const hasData = !!(existingValue || extractedValue);
    const conf = confidence[field] || (hasData ? 0.7 : 0);
    
    fieldScores[field] = conf;
    
    if (hasData && conf >= 0.6) {
      importantFound++;
    } else if (hasData && conf < 0.6) {
      issues.push(`${field} has low confidence (${conf.toFixed(2)})`);
    }
  }
  
  // Score optional fields (weight: 0.2)
  for (const field of optionalFields) {
    const existingValue = startup[field];
    const extractedValue = extractedData[field];
    const hasData = !!(existingValue || extractedValue);
    const conf = confidence[field] || (hasData ? 0.6 : 0);
    
    fieldScores[field] = conf;
    
    if (hasData && conf >= 0.5) {
      optionalFound++;
    }
  }
  
  // Calculate weighted score
  const criticalScore = (criticalFound / criticalFields.length) * 0.5;
  const importantScore = (importantFound / importantFields.length) * 0.3;
  const optionalScore = (optionalFound / optionalFields.length) * 0.2;
  const overallScore = Math.min(1.0, criticalScore + importantScore + optionalScore);
  
  // Determine status based on score and critical fields
  let status: 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
  
  if (overallScore >= 0.8 && criticalFound === criticalFields.length) {
    status = 'excellent';
  } else if (overallScore >= 0.6 && criticalFound >= Math.ceil(criticalFields.length * 0.7)) {
    status = 'good';
  } else if (overallScore >= 0.4 && criticalFound >= Math.ceil(criticalFields.length * 0.5)) {
    status = 'fair';
  } else if (overallScore >= 0.2 || criticalFound > 0) {
    status = 'poor';
  } else {
    status = 'failed';
    issues.push('No critical fields found');
  }
  
  // Add warnings for missing critical fields
  if (missingCriticalFields.length > 0 && status !== 'failed') {
    issues.push(`Missing critical fields: ${missingCriticalFields.join(', ')}`);
  }
  
  return {
    overallScore,
    fieldScores,
    criticalFieldsFound: criticalFound,
    criticalFieldsTotal: criticalFields.length,
    importantFieldsFound: importantFound,
    importantFieldsTotal: importantFields.length,
    optionalFieldsFound: optionalFound,
    optionalFieldsTotal: optionalFields.length,
    status,
    missingCriticalFields,
    issues,
  };
}

/**
 * Determine enrichment status based on quality
 */
export function getEnrichmentStatus(quality: EnrichmentQuality): 'completed' | 'needs_review' | 'failed' {
  if (quality.status === 'failed') {
    return 'failed';
  } else if (quality.status === 'poor' || quality.overallScore < 0.4) {
    return 'needs_review';
  } else {
    return 'completed';
  }
}

/**
 * Determine if enrichment should be retried
 */
export function shouldRetryEnrichment(quality: EnrichmentQuality, attempts: number, maxAttempts: number): boolean {
  // Don't retry if we've exhausted attempts
  if (attempts >= maxAttempts) {
    return false;
  }
  
  // Always retry if failed
  if (quality.status === 'failed') {
    return true;
  }
  
  // Retry if poor quality and haven't tried enough
  if (quality.status === 'poor' && attempts < 3) {
    return true;
  }
  
  // Retry if fair quality but missing critical fields
  if (quality.status === 'fair' && quality.missingCriticalFields.length > 0 && attempts < 2) {
    return true;
  }
  
  return false;
}

/**
 * Get human-readable quality summary
 */
export function getQualitySummary(quality: EnrichmentQuality): string {
  const parts: string[] = [];
  
  parts.push(`Score: ${(quality.overallScore * 100).toFixed(0)}%`);
  parts.push(`Status: ${quality.status}`);
  parts.push(`Critical: ${quality.criticalFieldsFound}/${quality.criticalFieldsTotal}`);
  parts.push(`Important: ${quality.importantFieldsFound}/${quality.importantFieldsTotal}`);
  parts.push(`Optional: ${quality.optionalFieldsFound}/${quality.optionalFieldsTotal}`);
  
  if (quality.issues.length > 0) {
    parts.push(`Issues: ${quality.issues.length}`);
  }
  
  return parts.join(' | ');
}

