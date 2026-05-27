import paramiko, io

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(hostname='72.62.132.159', username='root', password='MyN3wP@s-123')

# Write SQL to a temp file on VPS
sql_content = '''UPDATE "Channel" SET "isFaceless" = true WHERE "channelType" = 'long' AND "isFaceless" = false;
SELECT "isFaceless", COUNT(*) FROM "Channel" WHERE "channelType" = 'long' GROUP BY "isFaceless";
'''

sftp = ssh.open_sftp()
with sftp.open('/tmp/fix_channels.sql', 'w') as f:
    f.write(sql_content)
sftp.close()

# Copy SQL into niche_db container and run
stdin, stdout, stderr = ssh.exec_command(
    'docker cp /tmp/fix_channels.sql niche_db:/tmp/fix_channels.sql && '
    'docker exec niche_db psql -U niche_user -d niche_db -f /tmp/fix_channels.sql'
)
print("Result:", stdout.read().decode())
print("Err:", stderr.read().decode())

ssh.close()
