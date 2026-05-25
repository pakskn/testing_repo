import os
import subprocess

def main():
    schema_path = "/root/niche-finder/testing_repo/prisma/schema.prisma"
    
    print("Reading schema.prisma...")
    with open(schema_path, "r") as f:
        schema = f.read()
        
    print("Swapping provider to postgresql...")
    postgres_schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"')
    
    with open(schema_path, "w") as f:
        f.write(postgres_schema)
        
    try:
        print("Running prisma db push...")
        # Run db push in the testing_repo directory
        result = subprocess.run(
            ["npx", "prisma", "db", "push"],
            cwd="/root/niche-finder/testing_repo",
            capture_output=True,
            text=True
        )
        print("--- STDOUT ---")
        print(result.stdout)
        print("--- STDERR ---")
        print(result.stderr)
        
    finally:
        print("Restoring provider to sqlite...")
        with open(schema_path, "w") as f:
            f.write(schema)
            
    print("Done!")

if __name__ == "__main__":
    main()
