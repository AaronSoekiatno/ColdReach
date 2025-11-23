import json
import csv
from pathlib import Path
import re

def extract_company_name_from_yc_link(yc_link):
    """Extract company name from YC link"""
    if not yc_link:
        return None
    # Extract from URL like: https://www.ycombinator.com/companies/blue
    match = re.search(r'/companies/([^/]+)', yc_link)
    if match:
        return match.group(1)
    return None

def search_founder_info(company_name, yc_link, description):
    """Search for founder information using web search"""
    # This will use web_search tool to find real founder data
    search_queries = [
        f"{company_name} Y Combinator founder",
        f"{company_name} founder CEO",
        f"{company_name} YC Summer 2025"
    ]
    
    # Extract potential company slug from YC link
    company_slug = extract_company_name_from_yc_link(yc_link)
    if company_slug:
        search_queries.append(f"{company_slug} founder")
    
    return search_queries

def main():
    # Read the enriched JSON to find pattern companies
    json_file = Path('final_enriched_summer25 - final_enriched_summer25.json')
    
    print("="*70)
    print("FINDING REAL FOUNDER DATA FOR PATTERN COMPANIES")
    print("="*70)
    
    with open(json_file, 'r', encoding='utf-8') as f:
        companies = json.load(f)
    
    pattern_companies = [c for c in companies if c.get('data_quality') == '🤖 PATTERN']
    
    print(f"\n📊 Found {len(pattern_companies)} companies with pattern data")
    print(f"🔍 Starting web search for founder information...\n")
    
    # This script will prepare search queries
    # The actual web search will be done by the AI assistant
    for idx, company in enumerate(pattern_companies[:10], 1):  # Start with first 10
        print(f"[{idx}/{len(pattern_companies)}] {company['Company_Name']}")
        print(f"   YC Link: {company.get('YC_Link', 'N/A')}")
        print(f"   Description: {company.get('company_description', 'N/A')[:60]}...")
        print()

if __name__ == "__main__":
    main()

