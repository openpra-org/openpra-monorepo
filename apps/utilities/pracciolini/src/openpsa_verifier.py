import os
from lxml import etree

def validate_xml_against_rng(xml_file_path: str, rng_file_path: str) -> bool:
    if not os.path.exists(xml_file_path):
        raise FileNotFoundError(f"XML file not found: {xml_file_path}")
    if not os.path.exists(rng_file_path):
        raise FileNotFoundError(f"RNG schema file not found: {rng_file_path}")
        
    with open(rng_file_path, 'rb') as f:
        rng_doc = etree.parse(f)
    rng_schema = etree.RelaxNG(rng_doc)
    
    with open(xml_file_path, 'rb') as f:
        xml_doc = etree.parse(f)
        
    if rng_schema.validate(xml_doc):
        return True
    else:
        raise ValueError(f"Validation failed for {xml_file_path}:\n{rng_schema.error_log}")

def process_directory(directory_path: str, rng_file_path: str) -> dict:
    results = {"success": [], "failed": []}
    
    if not os.path.isdir(directory_path):
        raise NotADirectoryError(f"Directory not found: {directory_path}")
        
    for root, _, files in os.walk(directory_path):
        for file in files:
            if file.endswith(".xml"):
                full_path = os.path.join(root, file)
                try:
                    validate_xml_against_rng(full_path, rng_file_path)
                    print(f"PASSED: {full_path}")
                    results["success"].append(full_path)
                except Exception as e:
                    print(f"FAILED: {full_path}")
                    print(f"Reason: {str(e)}")
                    results["failed"].append({
                        "file": full_path,
                        "error": str(e)
                    })
                    
    return results

def main():
    import argparse
    import sys
    
    parser = argparse.ArgumentParser(description="OpenPSA MEF XML Verifier")
    parser.add_argument("-d", "--directory", required=True, help="Directory containing XML files to validate")
    parser.add_argument("-r", "--rng", required=True, help="Path to the RELAX NG schema (.rng) file")
    
    args = parser.parse_args()
    
    print(f"Starting validation of directory: {args.directory}")
    print(f"Using schema: {args.rng}")
    
    try:
        results = process_directory(args.directory, args.rng)
        
        print("\n--- Validation Summary ---")
        print(f"Total XML files found: {len(results['success']) + len(results['failed'])}")
        print(f"Passed: {len(results['success'])}")
        print(f"Failed: {len(results['failed'])}")
        
        if len(results["failed"]) > 0:
            print("\nValidation failed for one or more files.")
            sys.exit(1)
        else:
            print("\nAll files validated successfully.")
            sys.exit(0)
            
    except Exception as e:
        print(f"Error during validation: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
