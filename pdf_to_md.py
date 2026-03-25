import fitz  # PyMuPDF
import sys
import os
import argparse

def convert_pdf_to_md(pdf_path, output_path=None):
    """
    Converts a PDF file to a Markdown file for faster RAG processing.
    """
    if not os.path.exists(pdf_path):
        print(f"Error: File '{pdf_path}' not found.")
        return False

    if not output_path:
        output_path = os.path.splitext(pdf_path)[0] + ".md"

    try:
        doc = fitz.open(pdf_path)
        md_content = f"# Source: {os.path.basename(pdf_path)}\n\n"
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text("text")
            
            # Simple cleaning: remove excessive whitespace
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            cleaned_text = '\n'.join(lines)
            
            md_content += f"## Page {page_num + 1}\n\n{cleaned_text}\n\n"
            
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        
        print(f"Successfully converted '{pdf_path}' to '{output_path}'")
        return True
    except Exception as e:
        print(f"An error occurred during conversion: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert PDF documents to Markdown files.")
    parser.add_argument("pdf_path", help="Path to the PDF file to convert")
    parser.add_argument("-o", "--output", help="Optional output path for the Markdown file")
    
    args = parser.parse_args()
    convert_pdf_to_md(args.pdf_path, args.output)
