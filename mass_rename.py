import os

EXCLUDE_DIRS = {'.git', '.venv', 'node_modules', '__pycache__', '.temp', 'dist', 'build', '.next'}
TARGET_LOWER = "stitchcv"
REPLACE_LOWER = "stitchcv"
TARGET_TITLE = "StitchCV"
REPLACE_TITLE = "StitchCV"

def process_file_content(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        return False

    new_content = content.replace(TARGET_LOWER, REPLACE_LOWER).replace(TARGET_TITLE, REPLACE_TITLE).replace("stitchcv", "stitchcv").replace("Stitchcv", "Stitchcv")
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

def rename_paths():
    # Phase 1: File contents
    modified_files = 0
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for file in files:
            if file.endswith('.pyc') or file.endswith('.db') or file.endswith('.pdf') or file.startswith('.'):
                continue
            filepath = os.path.join(root, file)
            if process_file_content(filepath):
                modified_files += 1
                
    # Phase 2: Rename files and dirs (bottom up to avoid path invalidation)
    renamed_items = 0
    for root, dirs, files in os.walk('.', topdown=False):
        for d in dirs:
            if d in EXCLUDE_DIRS: continue
            if TARGET_LOWER in d or TARGET_TITLE in d:
                old_path = os.path.join(root, d)
                new_name = d.replace(TARGET_LOWER, REPLACE_LOWER).replace(TARGET_TITLE, REPLACE_TITLE)
                new_path = os.path.join(root, new_name)
                os.rename(old_path, new_path)
                renamed_items += 1
                
        for f in files:
            if TARGET_LOWER in f or TARGET_TITLE in f:
                old_path = os.path.join(root, f)
                new_name = f.replace(TARGET_LOWER, REPLACE_LOWER).replace(TARGET_TITLE, REPLACE_TITLE)
                new_path = os.path.join(root, new_name)
                os.rename(old_path, new_path)
                renamed_items += 1
                
    print(f"Updated contents in {modified_files} files.")
    print(f"Renamed {renamed_items} files/directories.")

if __name__ == '__main__':
    rename_paths()
