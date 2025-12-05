import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import puppeteer, { Browser, Page } from 'puppeteer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

/**
 * Extract company logo URL from YC company page
 * The logo is typically in the format: https://bookface-images.s3.amazonaws.com/small_logos/{hash}.png
 */
async function extractLogoFromYCPage(page: Page, ycUrl: string): Promise<string | null> {
  try {
    console.log(`   Navigating to: ${ycUrl}`);
    
    // Navigate to the page
    await page.goto(ycUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // Wait for content to load
    await page.waitForSelector('body', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract logo URL from the page
    const logoUrl = await page.evaluate(() => {
      // Look for logo image - YC pages typically have logos in img tags
      // The logo is usually in a format like: https://bookface-images.s3.amazonaws.com/small_logos/{hash}.png
      
      // Method 1: Look for img tags with bookface-images in src
      const bookfaceImages = Array.from(document.querySelectorAll('img[src*="bookface-images"]'));
      if (bookfaceImages.length > 0) {
        // Find the one with small_logos in the path (that's the company logo)
        const logoImg = bookfaceImages.find(img => {
          const src = (img as HTMLImageElement).src;
          return src.includes('small_logos');
        });
        if (logoImg) {
          return (logoImg as HTMLImageElement).src;
        }
        // If no small_logos found, use the first bookface image
        return (bookfaceImages[0] as HTMLImageElement).src;
      }
      
      // Method 2: Look for any img tag that might be the company logo
      // Usually the logo is near the top of the page, in a header or hero section
      const allImages = Array.from(document.querySelectorAll('img'));
      for (const img of allImages) {
        const src = (img as HTMLImageElement).src;
        // Skip common non-logo images
        if (src.includes('favicon') || src.includes('icon') || src.includes('avatar') || 
            src.includes('placeholder') || src.includes('default') || src.includes('twitter') ||
            src.includes('facebook') || src.includes('linkedin') || src.includes('youtube')) {
          continue;
        }
        // Check if it's a bookface logo
        if (src.includes('bookface-images') || (src.includes('s3.amazonaws.com') && src.includes('logos'))) {
          return src;
        }
        // Check if it's in a likely logo container (header, hero, etc.)
        const parent = img.parentElement;
        if (parent) {
          const parentClass = parent.className || '';
          const parentId = parent.id || '';
          if (parentClass.includes('logo') || parentId.includes('logo') ||
              parentClass.includes('header') || parentClass.includes('hero') ||
              parentClass.includes('company')) {
            // Make sure it's not a social icon
            if (!src.includes('twitter') && !src.includes('facebook') && !src.includes('linkedin')) {
              return src;
            }
          }
        }
      }
      
      // Method 3: Look for meta tags or data attributes
      const metaImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
      if (metaImage && metaImage.content) {
        const content = metaImage.content;
        if (content.includes('bookface-images') || (content.includes('s3.amazonaws.com') && content.includes('logos'))) {
          return content;
        }
      }
      
      return null;
    });
    
    if (logoUrl) {
      console.log(`   ✅ Found logo: ${logoUrl}`);
      return logoUrl;
    } else {
      console.log(`   ⚠️  No logo found on page`);
      return null;
    }
  } catch (error) {
    console.error(`   ❌ Error extracting logo: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get all startups missing company logos
 */
async function getStartupsMissingLogos(): Promise<Array<{ id: string; name: string; yc_link: string | null }>> {
  try {
    const { data, error } = await supabase
      .from('startups')
      .select('id, name, yc_link, company_logo')
      .or('company_logo.is.null,company_logo.eq.')
      .not('yc_link', 'is', null);
    
    if (error) {
      throw error;
    }
    
    // Filter out rows that already have a logo (in case the query didn't work perfectly)
    return (data || []).filter(row => !row.company_logo || row.company_logo.trim() === '');
  } catch (error) {
    console.error('Error fetching startups:', error);
    return [];
  }
}

/**
 * Update startup with logo URL
 */
async function updateStartupLogo(startupId: string, logoUrl: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('startups')
      .update({ company_logo: logoUrl })
      .eq('id', startupId);
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error(`   ❌ Error updating logo: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Main function to scrape missing logos
 */
async function main() {
  console.log('🚀 Starting logo scraping for startups missing logos...\n');
  
  // Get all startups missing logos
  const startups = await getStartupsMissingLogos();
  console.log(`📊 Found ${startups.length} startups missing logos\n`);
  
  if (startups.length === 0) {
    console.log('✅ No startups need logo updates!');
    return;
  }
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Set a reasonable user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  
  // Process each startup
  for (let i = 0; i < startups.length; i++) {
    const startup = startups[i];
    console.log(`\n[${i + 1}/${startups.length}] Processing: ${startup.name}`);
    
    if (!startup.yc_link) {
      console.log('   ⏭️  Skipping: No YC link');
      skippedCount++;
      continue;
    }
    
    // Extract logo from YC page
    const logoUrl = await extractLogoFromYCPage(page, startup.yc_link);
    
    if (logoUrl) {
      // Update database
      const updated = await updateStartupLogo(startup.id, logoUrl);
      if (updated) {
        console.log(`   ✅ Successfully updated logo`);
        successCount++;
      } else {
        failCount++;
      }
    } else {
      console.log(`   ⚠️  Could not extract logo`);
      failCount++;
    }
    
    // Add a small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Close browser
  await browser.close();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   📝 Total: ${startups.length}`);
  console.log('='.repeat(50));
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

