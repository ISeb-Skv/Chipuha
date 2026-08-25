import os
import time
import threading

def clean_old_files(upload_folder, interval=3600):
    def _clean():
        while True:
            time.sleep(interval)
            try:
                now = time.time()
                for filename in os.listdir(upload_folder):
                    filepath = os.path.join(upload_folder, filename)
                    if os.path.isfile(filepath):
                        mtime = os.path.getmtime(filepath)
                        if now - mtime > 36000:
                            os.remove(filepath)
                            print(f"Удалён старый файл: {filename}")
            except Exception as e:
                print(f"Ошибка очистки файлов: {e}")
    thread = threading.Thread(target=_clean, daemon=True)
    thread.start()