import subprocess
import sys

sql = """
UPDATE "Channel" 
SET "isFaceless" = true, "niche" = 'Education' 
WHERE "channelType" = 'long';
"""

# Run docker exec with the SQL command
cmd = ['docker', 'exec', 'coolify-db', 'psql', '-U', 'coolify', '-d', 'coolify_db', '-c', sql]
try:
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    print("STDOUT:", result.stdout)
except subprocess.CalledProcessError as e:
    print("STDERR:", e.stderr)
    sys.exit(1)
