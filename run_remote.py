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
        ssh.connect(hostname='72.62.132.159', username='root', password='MyN3wP@s-123')
        # Read script if arg starts with @
        if command.startswith('@'):
            with open(command[1:], 'r') as f:
                script = f.read()
            stdin, stdout, stderr = ssh.exec_command('python3 -c "' + script.replace('"', '\\"') + '"')
        else:
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
