from transformers import PegasusForConditionalGeneration, PegasusTokenizer
import sys

# Load PEGASUS model and tokenizer
model_name = "google/pegasus-xsum"
tokenizer = PegasusTokenizer.from_pretrained(model_name)
model = PegasusForConditionalGeneration.from_pretrained(model_name)

def summarize_text(text):
    try:
        inputs = tokenizer([text], return_tensors="pt", max_length=512, truncation=True, padding="longest")
        summary_ids = model.generate(inputs['input_ids'], max_length=150, num_beams=4, early_stopping=True)
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary
    except Exception as e:
        print(f"Error during summarization: {e}")
        return None

if __name__ == '__main__':
    input_text = sys.argv[1]
    
    summary = summarize_text(input_text)
    if summary:
        print(f"Summary: {summary}")
    else:
        print("Summarization failed.")
