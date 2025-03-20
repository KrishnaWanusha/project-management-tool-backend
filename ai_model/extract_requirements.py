import sys
import json
import pandas as pd
import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from tabula import read_pdf

nltk.download('punkt')
nltk.download('stopwords')
nltk.download('punkt_tab')

stop_words = set(stopwords.words('english'))

def preprocess_text(text):
    if isinstance(text, str):
        text = text.lower()
        text = re.sub(r'[^a-zA-Z\s]', '', text)
        text = text.strip()
    else:
        text = ""  # Return empty string if the text is not a valid string
    return text

# Get the PDF file path from command-line argument
pdf_path = sys.argv[1]
tables = read_pdf(pdf_path, pages="all", multiple_tables=True)

extracted_requirements = []

for table in tables:
    # Check for 'Number' or 'Name' column and decide accordingly
    column_to_check = None
    if 'Number' in table.columns:
        column_to_check = 'Number'
    elif 'Name' in table.columns:
        column_to_check = 'Name'
    
    if column_to_check and table[column_to_check].astype(str).str.contains('Summary', case=False, na=False).any():
        use_case_name, summary, priority, trigger, pre_conditions, post_conditions = "", "", "", "", "", ""

        for _, row in table.iterrows():
            column_name = row[column_to_check]
            if isinstance(column_name, float):
                continue
            column_value = row.iloc[1]
            
            if 'name' in column_name.lower():
                use_case_name = preprocess_text(column_value)
            elif 'summary' in column_name.lower():
                summary = preprocess_text(column_value)
            elif 'priority' in column_name.lower():
                priority = preprocess_text(column_value)
            elif 'trigger' in column_name.lower():
                trigger = preprocess_text(column_value)
            elif 'pre-condition' in column_name.lower():
                pre_conditions = preprocess_text(column_value)
            elif 'post-condition' in column_name.lower():
                post_conditions = preprocess_text(column_value)

        extracted_requirements.append(summary)

# Output JSON result
print(json.dumps(extracted_requirements))
