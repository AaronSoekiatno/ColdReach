"""
Script to find actual funding round information for YC companies.
Searches for funding announcements and updates the dataset.
"""
import csv
import json
from pathlib import Path
import re
import time

def extract_company_slug(yc_link):
    """Extract company slug from YC link"""
    if not yc_link:
        return None
    match = re.search(r'/companies/([^/]+)', yc_link)
    if match:
        return match.group(1)
    return None

def parse_funding_info(search_result_text, company_name):
    """Parse funding information from search results"""
    # Common patterns for funding announcements
    patterns = [
        r'raised\s+(\$[\d.]+[MBK]?)\s+(?:in\s+)?(?:a\s+)?(seed|Series\s+[A-Z]|pre-seed|Series\s+[A-Z])\s+round',
        r'(seed|Series\s+[A-Z]|pre-seed)\s+round\s+of\s+(\$[\d.]+[MBK]?)',
        r'(\$[\d.]+[MBK]?)\s+(?:funding|raised)\s+(?:in\s+)?(seed|Series\s+[A-Z]|pre-seed)',
    ]
    
    funding_round = None
    funding_amount = None
    
    for pattern in patterns:
        match = re.search(pattern, search_result_text, re.IGNORECASE)
        if match:
            if len(match.groups()) == 2:
                if '$' in match.group(1):
                    funding_amount = match.group(1)
                    funding_round = match.group(2)
                else:
                    funding_round = match.group(1)
                    funding_amount = match.group(2)
            break
    
    return funding_round, funding_amount

def main():
    input_file = Path(r'c:\Users\aidan\Downloads\ycombinator - ycombinator.csv.csv')
    output_file = Path('yc_companies_with_funding.csv')
    progress_file = Path('funding_search_progress.json')
    
    print("="*70)
    print("FINDING ACTUAL FUNDING ROUND INFORMATION")
    print("="*70)
    
    # Read companies
    print(f"\n📖 Reading {input_file.name}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        companies = list(reader)
    
    print(f"   Found {len(companies)} companies")
    
    # Load progress if exists
    progress = {}
    if progress_file.exists():
        with open(progress_file, 'r', encoding='utf-8') as f:
            progress = json.load(f)
        print(f"   Loaded progress: {len(progress)} companies already processed")
    
    # Process companies
    enriched = []
    print(f"\n🔄 Processing companies...")
    print(f"   Note: This script prepares the structure.")
    print(f"   Use web search to find actual funding data for each company.\n")
    
    for idx, company in enumerate(companies, 1):
        company_name = company.get('Company_Name', '')
        batch = company.get('Batch', '')
        yc_link = company.get('YC_Link', '')
        company_slug = extract_company_slug(yc_link)
        
        # Check if we have progress for this company
        company_key = company_name.lower()
        if company_key in progress:
            funding_round = progress[company_key].get('funding_round', '')
            funding_amount = progress[company_key].get('funding_amount', '')
            funding_date = progress[company_key].get('funding_date', '')
            funding_source = progress[company_key].get('funding_source', 'Manual')
        else:
            # Default: Most YC companies are seed stage
            funding_round = 'Seed'
            funding_amount = ''  # To be filled
            funding_date = batch if batch else ''
            funding_source = 'YC Batch (Default - Needs Verification)'
        
        enriched_company = {
            **company,
            'funding_round': funding_round,
            'funding_amount': funding_amount,
            'funding_date': funding_date,
            'funding_source': funding_source,
            'company_slug': company_slug,
        }
        enriched.append(enriched_company)
        
        if idx <= 10:
            print(f"   [{idx}] {company_name}")
            print(f"       Batch: {batch}")
            print(f"       Slug: {company_slug}")
            print(f"       Funding: {funding_round} - {funding_amount}")
            print()
    
    # Save output
    print(f"\n💾 Writing to {output_file.name}...")
    if enriched:
        fieldnames = list(enriched[0].keys())
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(enriched)
        print(f"   ✅ CSV saved with {len(enriched)} companies")
    
    # Create search template
    search_template_file = Path('funding_search_template.txt')
    with open(search_template_file, 'w', encoding='utf-8') as f:
        f.write("="*70 + "\n")
        f.write("FUNDING ROUND SEARCH TEMPLATE\n")
        f.write("="*70 + "\n\n")
        f.write("Search queries for finding funding information:\n\n")
        for i, company in enumerate(companies[:20], 1):
            company_name = company.get('Company_Name', '')
            batch = company.get('Batch', '')
            f.write(f"{i}. {company_name} ({batch})\n")
            f.write(f"   - \"{company_name} raised funding\"\n")
            f.write(f"   - \"{company_name} seed round\"\n")
            f.write(f"   - \"{company_name} Y Combinator funding\"\n")
            f.write(f"   - site:crunchbase.com {company_name}\n")
            f.write(f"   - site:techcrunch.com {company_name} funding\n\n")
    
    print(f"   📝 Created search template: {search_template_file}")
    
    # Summary
    print(f"\n{'='*70}")
    print(f"✅ PREPARATION COMPLETE!")
    print(f"{'='*70}")
    print(f"📊 Total companies: {len(companies)}")
    print(f"📁 Output: {output_file}")
    print(f"\n💡 To find actual funding rounds:")
    print(f"   1. Search each company: '{company_name} raised funding'")
    print(f"   2. Check Crunchbase: site:crunchbase.com {company_name}")
    print(f"   3. Check TechCrunch: site:techcrunch.com {company_name} funding")
    print(f"   4. Update progress.json with found data")
    print(f"\n📋 Search template created: {search_template_file}")
    print(f"{'='*70}")

if __name__ == "__main__":
    main()

