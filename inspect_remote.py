import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
key = paramiko.Ed25519Key(filename=r'C:\Users\HP\.ssh\id_vps_waqas')
ssh.connect(hostname='72.62.132.159', username='waqas', pkey=key)

# Get niche_db connection details from env
stdin, stdout, stderr = ssh.exec_command("sudo docker exec niche_app env | grep DATABASE_URL")
db_url = stdout.read().decode().strip()
print("DB URL:", db_url)

# List tables in niche_db container
stdin2, stdout2, stderr2 = ssh.exec_command("sudo docker exec niche_db psql -U niche_user -d niche_db -c '\\dt' 2>/dev/null || sudo docker exec niche_db psql -U coolify -d coolify -c '\\dt' 2>/dev/null")
print("niche_db info:\n", stdout2.read().decode())
print("Err:", stderr2.read().decode())

ssh.close()
