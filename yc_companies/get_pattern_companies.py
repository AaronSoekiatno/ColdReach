import json
from pathlib import Path

json_file = Path('final_enriched_summer25 - final_enriched_summer25.json')

with open(json_file, 'r', encoding='utf-8') as f:
    companies = json.load(f)

pattern_companies = [c for c in companies if c.get('data_quality') == '🤖 PATTERN']

print(f"Found {len(pattern_companies)} companies with pattern data:\n")
for i, company in enumerate(pattern_companies, 1):
    print(f"{i}. {company['Company_Name']}")
    print(f"   YC: {company.get('YC_Link', 'N/A')}")
    print(f"   Desc: {company.get('company_description', 'N/A')[:80]}")
    print()

