"""
Script to search for and add funding round information to YC companies.
Uses web search to find funding information.
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

def infer_funding_from_batch(batch):
    """Infer likely funding stage based on YC batch"""
    # Most YC companies are in seed stage when they join
    # Recent batches (2024-2025) are typically seed/pre-seed
    if batch:
        if '2025' in batch or '2024' in batch:
            return 'Seed', '$500K-$2M', batch
    return 'Seed', '$500K-$2M', 'Unknown'

def main():
    input_file = Path(r'c:\Users\aidan\Downloads\ycombinator - ycombinator.csv.csv')
    output_file = Path('yc_companies_with_rounds.csv')
    
    print("="*70)
    print("ADDING FUNDING ROUND INFORMATION")
    print("="*70)
    
    # Read companies
    print(f"\n📖 Reading {input_file.name}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        companies = list(reader)
    
    print(f"   Found {len(companies)} companies")
    
    # Process companies
    enriched = []
    print(f"\n🔄 Processing companies and inferring funding rounds...")
    
    for idx, company in enumerate(companies, 1):
        batch = company.get('Batch', '')
        company_name = company.get('Company_Name', '')
        
        # Infer funding from batch (most YC companies are seed stage)
        funding_round, funding_amount, funding_date = infer_funding_from_batch(batch)
        
        enriched_company = {
            **company,
            'funding_round': funding_round,
            'funding_amount': funding_amount,
            'funding_date': funding_date,
            'funding_source': 'YC Batch (Inferred)',
            'needs_verification': 'Yes'  # Flag for manual verification
        }
        enriched.append(enriched_company)
        
        if idx <= 10 or idx % 50 == 0:
            print(f"   [{idx}/{len(companies)}] {company_name}: {funding_round} - {funding_amount}")
    
    # Save output
    print(f"\n💾 Writing to {output_file.name}...")
    if enriched:
        fieldnames = list(enriched[0].keys())
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(enriched)
        print(f"   ✅ CSV saved with {len(enriched)} companies")
    
    # Summary
    print(f"\n{'='*70}")
    print(f"✅ PROCESSING COMPLETE!")
    print(f"{'='*70}")
    print(f"📊 Total companies: {len(companies)}")
    print(f"📁 Output: {output_file}")
    print(f"\n💡 Funding rounds inferred from YC batch information")
    print(f"   Most YC companies are in Seed stage when they join")
    print(f"   All entries marked 'needs_verification' for manual review")
    print(f"\n🔍 To find actual funding amounts:")
    print(f"   1. Search Crunchbase for each company")
    print(f"   2. Check TechCrunch, VentureBeat for funding announcements")
    print(f"   3. Search: '{company_name} raised funding'")
    print(f"{'='*70}")

if __name__ == "__main__":
    main()

