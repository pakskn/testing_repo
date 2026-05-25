import paramiko
import sys
import os

def main():
    if len(sys.argv) < 3:
        print("Usage: python upload_file.py <local_path> <remote_path>")
        sys.exit(1)
        
    local_path = sys.argv[1]
    remote_path = sys.argv[2]
    
    if not os.path.exists(local_path):
        print(f"Error: Local file {local_path} does not exist")
        sys.exit(1)
        
    print(f"Uploading {local_path} to {remote_path}...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname='72.62.132.159', username='root', password='MyN3wP@s-123')
        sftp = ssh.open_sftp()
        sftp.put(local_path, remote_path)
        print("Upload successful!")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
