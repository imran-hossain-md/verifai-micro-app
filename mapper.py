import os

def generate_project_map(root_dir, output_file):
    # যে ফোল্ডারগুলো আমরা ম্যাপে দেখতে চাই না (এগুলো অনেক বড় হয়)
    exclude_dirs = {'.git', 'node_modules', '__pycache__', 'build', 'dist', '.vscode'}
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"PROJECT STRUCTURE MAP: {os.path.basename(os.path.abspath(root_dir))}\n")
        f.write("="*50 + "\n\n")
        
        for root, dirs, files in os.walk(root_dir):
            # বাদ দেওয়া ফোল্ডারগুলো ফিল্টার করা
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            level = root.replace(root_dir, '').count(os.sep)
            indent = ' ' * 4 * level
            folder_name = os.path.basename(root)
            
            if folder_name == os.path.basename(root_dir):
                f.write(f"ROOT: {folder_name}/\n")
            else:
                f.write(f"{indent}├── {folder_name}/\n")
            
            sub_indent = ' ' * 4 * (level + 1)
            for file in files:
                if file != 'mapper.py':  # এই স্ক্রিপ্ট ফাইলটি ম্যাপে দেখাবে না
                    f.write(f"{sub_indent}└── {file}\n")

    print(f"✅ সাকসেস! প্রজেক্ট ম্যাপ তৈরি হয়েছে: {output_file}")

if __name__ == "__main__":
    current_directory = os.getcwd()
    output_filename = "project_map.txt"
    generate_project_map(current_directory, output_filename)