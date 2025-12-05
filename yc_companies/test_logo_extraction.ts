import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import puppeteer, { Browser, Page } from 'puppeteer';

/**
 * Extract company logo URL from YC company page
 * The logo is typically in the format: https://bookface-images.s3.amazonaws.com/small_logos/{hash}.png
 */
async function extractLogoFromYCPage(page: Page, ycUrl: string): Promise<string | null> {
  try {
    console.log(`\n🌐 Navigating to: ${ycUrl}`);
    
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
      
      // Method 4: Look for any element with a background image containing bookface
      const elementsWithBg = Array.from(document.querySelectorAll('*'));
      for (const el of elementsWithBg) {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage.includes('bookface-images')) {
          // Extract URL from background-image: url(...)
          const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (match && match[1]) {
            return match[1];
          }
        }
      }
      
      return null;
    });
    
    if (logoUrl) {
      console.log(`✅ Found logo: ${logoUrl}`);
      return logoUrl;
    } else {
      console.log(`⚠️  No logo found on page`);
      
      // Debug: Print all image sources found
      const allImageSrcs = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.map(img => (img as HTMLImageElement).src).filter(src => src.length > 0);
      });
      console.log(`\n📸 Found ${allImageSrcs.length} images on page:`);
      allImageSrcs.slice(0, 10).forEach((src, i) => {
        console.log(`   ${i + 1}. ${src}`);
      });
      if (allImageSrcs.length > 10) {
        console.log(`   ... and ${allImageSrcs.length - 10} more`);
      }
      
      return null;
    }
  } catch (error) {
    console.error(`❌ Error extracting logo: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Test logo extraction for a single startup
 */
async function testLogoExtraction(ycUrl: string) {
  console.log('🚀 Testing logo extraction...\n');
  console.log(`📋 Testing URL: ${ycUrl}\n`);
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless mode
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Set a reasonable user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    // Extract logo
    const logoUrl = await extractLogoFromYCPage(page, ycUrl);
    
    if (logoUrl) {
      console.log(`\n✅ SUCCESS! Logo URL extracted:`);
      console.log(`   ${logoUrl}\n`);
      
      // Verify it matches the expected format
      if (logoUrl.includes('bookface-images.s3.amazonaws.com/small_logos/')) {
        console.log('✅ Logo URL matches expected format!');
      } else {
        console.log('⚠️  Logo URL does not match expected format (bookface-images.s3.amazonaws.com/small_logos/)');
      }
    } else {
      console.log(`\n❌ FAILED: Could not extract logo URL\n`);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    // Keep browser open for a few seconds to inspect if needed
    console.log('\n⏳ Keeping browser open for 5 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close();
  }
}

// Get URL from command line argument or use default
const testUrl = process.argv[2] || 'https://www.ycombinator.com/companies/coinbase';

// Run the test
testLogoExtraction(testUrl).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

