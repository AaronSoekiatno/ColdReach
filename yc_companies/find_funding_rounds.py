"""
Script to find funding rounds for YC companies.
Uses web search to find funding information for each company.
"""
import csv
import json
import time
from pathlib import Path
import re

def search_funding_round(company_name, yc_link):
    """Search for funding round information"""
    # This will be called by the AI assistant to search for funding info
    search_queries = [
        f"{company_name} funding round seed series",
        f"{company_name} raised funding Y Combinator",
        f"{company_name} Crunchbase funding"
    ]
    return search_queries

def extract_company_slug(yc_link):
    """Extract company slug from YC link"""
    if not yc_link:
        return None
    match = re.search(r'/companies/([^/]+)', yc_link)
    if match:
        return match.group(1)
    return None

def main():
    input_file = Path(r'c:\Users\aidan\Downloads\ycombinator - ycombinator.csv.csv')
    output_file = Path('yc_companies_with_rounds.csv')
    
    print("="*70)
    print("FINDING FUNDING ROUNDS FOR YC COMPANIES")
    print("="*70)
    
    # Read companies
    print(f"\n📖 Reading {input_file.name}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        companies = list(reader)
    
    print(f"   Found {len(companies)} companies")
    
    # Prepare output
    enriched = []
    
    print(f"\n🔍 Companies to process: {len(companies)}")
    print(f"   Note: This script prepares the data structure.")
    print(f"   Funding round information will need to be searched for each company.\n")
    
    # Show first few companies as examples
    for i, company in enumerate(companies[:5], 1):
        company_slug = extract_company_slug(company.get('YC_Link', ''))
        print(f"{i}. {company.get('Company_Name', 'N/A')}")
        print(f"   YC Link: {company.get('YC_Link', 'N/A')}")
        print(f"   Batch: {company.get('Batch', 'N/A')}")
        print(f"   Slug: {company_slug}")
        print()
    
    # Add funding_round column (empty for now)
    for company in companies:
        enriched_company = {
            **company,
            'funding_round': '',  # To be filled
            'funding_amount': '',  # To be filled
            'funding_date': '',    # To be filled
        }
        enriched.append(enriched_company)
    
    # Save output
    print(f"\n💾 Writing to {output_file.name}...")
    if enriched:
        fieldnames = list(enriched[0].keys())
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(enriched)
        print(f"   ✅ CSV saved with {len(enriched)} companies")
        print(f"   📝 Added columns: funding_round, funding_amount, funding_date")
    
    print(f"\n{'='*70}")
    print("✅ PREPARATION COMPLETE!")
    print(f"{'='*70}")
    print(f"📊 Total companies: {len(companies)}")
    print(f"📁 Output: {output_file}")
    print(f"\n💡 Next step: Search for funding round information for each company")
    print(f"   You can use web search or APIs like Crunchbase to find funding data")
    print(f"{'='*70}")

if __name__ == "__main__":
    main()

