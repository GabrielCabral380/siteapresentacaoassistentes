import os

search_paths = [
    r"C:\Users\Usuario\Desktop",
    r"C:\Users\Usuario\Desktop\PROJETOS",
    r"C:\Users\Usuario\Desktop\PROJETO GABRIEL",
    r"C:\Users\Usuario\AppData\Roaming",
    r"C:\Users\Usuario\AppData\Local",
    r"C:\Users\Usuario"
]

print("=== Searching for OpenClaw ===")

for path in search_paths:
    if not os.path.exists(path):
        continue
    try:
        entries = os.listdir(path)
        for e in entries:
            if "claw" in e.lower() or "openclaw" in e.lower():
                print("Found match:", os.path.join(path, e))
    except Exception as err:
        pass

# Recursive check in Desktop and PROJETOS
for base in [r"C:\Users\Usuario\Desktop\PROJETOS", r"C:\Users\Usuario\Desktop"]:
    if os.path.exists(base):
        for root, dirs, files in os.walk(base):
            if "node_modules" in dirs:
                dirs.remove("node_modules")
            if ".git" in dirs:
                dirs.remove(".git")
            for d in dirs:
                if "claw" in d.lower():
                    print("Dir match:", os.path.join(root, d))
            for f in files:
                if "claw" in f.lower():
                    print("File match:", os.path.join(root, f))
