/**
 * Debug Founder Extraction
 * 
 * This script helps debug why founder names aren't being extracted from YC pages.
 * It shows what the scraper "sees" on the page.
 * 
 * Usage:
 *   npx tsx yc_companies/debug_founder_extraction.ts --url="https://www.ycombinator.com/companies/mlop"
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import puppeteer from 'puppeteer';

async function debugFounderExtraction(url: string) {
  console.log(`🔍 Debugging founder extraction for: ${url}\n`);

  const browser = await puppeteer.launch({
    headless: false, // Show browser so we can see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('📄 Loading page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const debugInfo = await page.evaluate(() => {
      const info: any = {
        pageTitle: document.title,
        bodyText: document.body.textContent || '',
        headings: [] as string[],
        founderSection: null as any,
        potentialNames: [] as string[],
        linkedInLinks: [] as string[],
      };

      // Find all headings
      const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      info.headings = allHeadings.map(h => ({
        tag: h.tagName,
        text: h.textContent?.trim() || '',
        classes: h.className,
      }));

      // Find "Active Founders" heading
      const foundersHeading = allHeadings.find(h => {
        const text = h.textContent?.trim() || '';
        return text.toLowerCase().includes('active founders') || 
               text.toLowerCase() === 'founders';
      });

      if (foundersHeading) {
        info.founderSection = {
          headingText: foundersHeading.textContent?.trim(),
          headingTag: foundersHeading.tagName,
          headingClasses: foundersHeading.className,
        };

        // Get text content after the heading
        let current: Element | null = foundersHeading.nextElementSibling;
        const sectionText: string[] = [];
        
        for (let i = 0; i < 20 && current; i++) {
          const text = current.textContent?.trim() || '';
          if (text) {
            sectionText.push(text);
            
            // Also check for specific elements
            const nameElements = current.querySelectorAll('.text-xl.font-bold, div[class*="text-xl"]');
            nameElements.forEach(el => {
              const nameText = el.textContent?.trim() || '';
              if (nameText && nameText.length > 3 && nameText.length < 100) {
                info.potentialNames.push({
                  text: nameText,
                  element: el.tagName,
                  classes: el.className,
                  parentText: current?.textContent?.trim().substring(0, 200),
                });
              }
            });
          }
          current = current.nextElementSibling;
        }

        info.founderSection.nextElements = sectionText.slice(0, 10);
      }

      // Find all LinkedIn links
      const linkedInLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
      info.linkedInLinks = linkedInLinks.map(link => ({
        href: (link as HTMLAnchorElement).href,
        text: link.textContent?.trim(),
        nearbyText: link.parentElement?.textContent?.trim().substring(0, 200),
      }));

      // Extract potential names from body text
      const bodyText = document.body.textContent || '';
      const bodyLower = bodyText.toLowerCase();
      const foundersIndex = bodyLower.indexOf('active founders') >= 0 
        ? bodyLower.indexOf('active founders')
        : bodyLower.indexOf('founders');
      
      if (foundersIndex >= 0) {
        const afterFounders = bodyText.slice(foundersIndex, foundersIndex + 2000);
        const lines = afterFounders.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        info.potentialNamesFromText = lines.slice(1, 20).filter(line => {
          // Check if line looks like a name (First Last pattern)
          return /^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(line) && 
                 line.length >= 3 && 
                 line.length <= 100 &&
                 !line.toLowerCase().includes('active') &&
                 !line.toLowerCase().includes('founder');
        });
      }

      return info;
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 DEBUG RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n📄 Page Title: ${debugInfo.pageTitle}`);
    
    console.log(`\n📋 Headings Found (${debugInfo.headings.length}):`);
    debugInfo.headings.forEach((h: any, i: number) => {
      console.log(`   ${i + 1}. <${h.tag}> ${h.text} ${h.classes ? `(${h.classes})` : ''}`);
    });

    if (debugInfo.founderSection) {
      console.log(`\n✅ Found "Active Founders" Section:`);
      console.log(`   Heading: <${debugInfo.founderSection.headingTag}> ${debugInfo.founderSection.headingText}`);
      console.log(`   Classes: ${debugInfo.founderSection.headingClasses}`);
      
      console.log(`\n📝 Text After Heading (first 10 elements):`);
      debugInfo.founderSection.nextElements.forEach((text: string, i: number) => {
        console.log(`   ${i + 1}. ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      });
    } else {
      console.log(`\n❌ Could not find "Active Founders" heading`);
    }

    console.log(`\n👤 Potential Names from CSS Selectors (${debugInfo.potentialNames.length}):`);
    if (debugInfo.potentialNames.length === 0) {
      console.log('   ⚠️  No names found using CSS selectors!');
    } else {
      debugInfo.potentialNames.forEach((name: any, i: number) => {
        console.log(`   ${i + 1}. "${name.text}" (${name.element}, classes: ${name.classes})`);
        if (name.parentText) {
          console.log(`      Context: ${name.parentText.substring(0, 150)}...`);
        }
      });
    }

    console.log(`\n👤 Potential Names from Text Extraction (${debugInfo.potentialNamesFromText?.length || 0}):`);
    if (debugInfo.potentialNamesFromText && debugInfo.potentialNamesFromText.length > 0) {
      debugInfo.potentialNamesFromText.forEach((name: string, i: number) => {
        console.log(`   ${i + 1}. "${name}"`);
      });
    } else {
      console.log('   ⚠️  No names found using text extraction!');
    }

    console.log(`\n🔗 LinkedIn Links Found (${debugInfo.linkedInLinks.length}):`);
    debugInfo.linkedInLinks.forEach((link: any, i: number) => {
      console.log(`   ${i + 1}. ${link.href}`);
      if (link.text) console.log(`      Link text: ${link.text}`);
      if (link.nearbyText) console.log(`      Nearby: ${link.nearbyText.substring(0, 100)}...`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('💡 Recommendations:');
    
    if (!debugInfo.founderSection) {
      console.log('   - The "Active Founders" heading was not found');
      console.log('   - Check if the page structure has changed');
    }
    
    if (debugInfo.potentialNames.length === 0 && debugInfo.potentialNamesFromText?.length === 0) {
      console.log('   - No names found using any method');
      console.log('   - The CSS selectors may need updating');
      console.log('   - The page may use a different structure');
    }
    
    if (debugInfo.potentialNamesFromText && debugInfo.potentialNamesFromText.length > 0) {
      console.log(`   - Found ${debugInfo.potentialNamesFromText.length} potential name(s) using text extraction`);
      console.log('   - The text-based fallback should work');
    }

    console.log('='.repeat(60) + '\n');

    // Keep browser open for inspection
    console.log('🌐 Browser will stay open for 30 seconds so you can inspect the page...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } finally {
    await browser.close();
  }
}

// Get URL from command line
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));
const url = urlArg ? urlArg.split('=')[1] : 'https://www.ycombinator.com/companies/mlop';

debugFounderExtraction(url)
  .then(() => {
    console.log('\n✅ Debug complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });

