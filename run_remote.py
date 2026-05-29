import paramiko
import sys

def main():
    if len(sys.argv) < 2:
        print("Usage: python run_remote.py '<command>'")
        sys.exit(1)
        
    command = sys.argv[1]
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        key = paramiko.Ed25519Key(filename=r'C:\Users\HP\.ssh\id_vps_waqas')
        ssh.connect(hostname='72.62.132.159', username='waqas', pkey=key)
        
        # Read script if arg starts with @
        if command.startswith('@'):
            with open(command[1:], 'r') as f:
                script = f.read()
            # Run with sudo if executing python script that might need docker permissions
            stdin, stdout, stderr = ssh.exec_command('sudo python3 -c "' + script.replace('"', '\\"') + '"')
        else:
            # Automatic prepending of sudo if it's a docker command
            if "docker" in command and not command.startswith("sudo"):
                command = "sudo " + command
            stdin, stdout, stderr = ssh.exec_command(command)
        
        out = stdout.read()
        err = stderr.read()
        
        if out:
            print("--- STDOUT ---")
            sys.stdout.buffer.write(out)
        if err:
            print("--- STDERR ---")
            sys.stdout.buffer.write(err)
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
