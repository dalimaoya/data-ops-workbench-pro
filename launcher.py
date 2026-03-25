"""
数据运维工作台 - Windows 桌面启动器
Data Ops Workbench - Windows Desktop Launcher

Features:
- System tray icon (pystray)
- Status window with version, service status, address
- Start/Stop service button
- Open console button (webbrowser)
- Close window minimizes to tray
- Right-click tray to exit (stops service)
"""

import os
import sys
import subprocess
import threading
import webbrowser
import time
import tkinter as tk
from tkinter import ttk, messagebox

VERSION = "v3.4.1"
SERVICE_PORT = 8580
SERVICE_URL = f"http://localhost:{SERVICE_PORT}"

# Resolve paths relative to the exe/script location
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SERVER_EXE = os.path.join(BASE_DIR, "server", "app", "dataops-server.exe")


class DataOpsLauncher:
    def __init__(self):
        self.process = None
        self.running = False
        self.tray_icon = None
        self.root = None
        self._stop_event = threading.Event()

    # ── Service management ──

    def start_service(self):
        if self.running and self.process and self.process.poll() is None:
            return

        if not os.path.isfile(SERVER_EXE):
            if self.root:
                messagebox.showerror(
                    "错误",
                    f"找不到服务程序:\n{SERVER_EXE}"
                )
            return

        env = os.environ.copy()
        env["DATA_OPS_BASE_DIR"] = BASE_DIR
        env["DATA_OPS_DATA_DIR"] = os.path.join(BASE_DIR, "data")

        # Ensure directories exist
        for d in ("data", "backups", "logs"):
            os.makedirs(os.path.join(BASE_DIR, d), exist_ok=True)

        creation_flags = 0
        if sys.platform == "win32":
            creation_flags = subprocess.CREATE_NO_WINDOW

        try:
            self.process = subprocess.Popen(
                [SERVER_EXE, "--port", str(SERVICE_PORT)],
                env=env,
                creationflags=creation_flags,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self.running = True
            self._update_ui()
        except Exception as e:
            if self.root:
                messagebox.showerror("启动失败", str(e))

    def stop_service(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
        self.process = None
        self.running = False
        self._update_ui()

    def _check_status(self):
        """Background thread: poll service process status."""
        while not self._stop_event.is_set():
            if self.process is not None:
                if self.process.poll() is not None:
                    # Process exited unexpectedly
                    self.running = False
                    self.process = None
                    if self.root:
                        self.root.after(0, self._update_ui)
            self._stop_event.wait(2)

    # ── UI ──

    def _update_ui(self):
        if not self.root:
            return
        if self.running:
            self.status_var.set("● 运行中")
            self.status_label.config(foreground="#2ecc71")
            self.toggle_btn.config(text="停止服务")
        else:
            self.status_var.set("○ 已停止")
            self.status_label.config(foreground="#e74c3c")
            self.toggle_btn.config(text="启动服务")

    def _toggle_service(self):
        if self.running:
            self.stop_service()
        else:
            self.start_service()

    def _open_console(self):
        webbrowser.open(SERVICE_URL)

    def _on_close(self):
        """Minimize to tray instead of closing."""
        if self.root:
            self.root.withdraw()

    def _show_window(self):
        if self.root:
            self.root.deiconify()
            self.root.lift()
            self.root.focus_force()

    def _quit(self):
        self.stop_service()
        self._stop_event.set()
        if self.tray_icon:
            self.tray_icon.stop()
        if self.root:
            self.root.quit()
            self.root.destroy()

    def _build_window(self):
        self.root = tk.Tk()
        self.root.title(f"数据运维工作台 {VERSION}")
        self.root.geometry("400x320")
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        # Try to set icon
        ico_path = os.path.join(BASE_DIR, "icon.ico")
        if os.path.isfile(ico_path):
            try:
                self.root.iconbitmap(ico_path)
            except Exception:
                pass

        style = ttk.Style()
        style.configure("Title.TLabel", font=("Microsoft YaHei UI", 16, "bold"))
        style.configure("Info.TLabel", font=("Microsoft YaHei UI", 11))
        style.configure("Status.TLabel", font=("Microsoft YaHei UI", 12, "bold"))
        style.configure("Action.TButton", font=("Microsoft YaHei UI", 11), padding=8)

        main_frame = ttk.Frame(self.root, padding=24)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        ttk.Label(main_frame, text="数据运维工作台", style="Title.TLabel").pack(pady=(0, 8))
        ttk.Label(main_frame, text=f"版本: {VERSION}", style="Info.TLabel").pack()

        # Separator
        ttk.Separator(main_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=12)

        # Status row
        status_frame = ttk.Frame(main_frame)
        status_frame.pack()
        ttk.Label(status_frame, text="服务状态: ", style="Info.TLabel").pack(side=tk.LEFT)
        self.status_var = tk.StringVar(value="○ 已停止")
        self.status_label = ttk.Label(status_frame, textvariable=self.status_var,
                                       style="Status.TLabel", foreground="#e74c3c")
        self.status_label.pack(side=tk.LEFT)

        # Address
        ttk.Label(main_frame, text=f"地址: {SERVICE_URL}", style="Info.TLabel").pack(pady=(8, 0))

        # Separator
        ttk.Separator(main_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=12)

        # Buttons
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X)

        self.toggle_btn = ttk.Button(btn_frame, text="启动服务",
                                      style="Action.TButton", command=self._toggle_service)
        self.toggle_btn.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 6))

        open_btn = ttk.Button(btn_frame, text="打开控制台",
                               style="Action.TButton", command=self._open_console)
        open_btn.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(6, 0))

        # Footer
        ttk.Label(main_frame, text="关闭窗口最小化到托盘，右键托盘图标退出",
                   font=("Microsoft YaHei UI", 9), foreground="#999").pack(side=tk.BOTTOM, pady=(12, 0))

    def _create_tray_image(self):
        """Create a simple tray icon image."""
        from PIL import Image, ImageDraw
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        # Simple gear-like icon
        draw.ellipse([8, 8, 56, 56], fill="#2980b9", outline="#1a5276", width=2)
        draw.text((20, 18), "DO", fill="white")
        return img

    def _start_tray(self):
        """Start system tray icon in a background thread."""
        try:
            import pystray
            from pystray import MenuItem, Menu

            image = self._create_tray_image()

            menu = Menu(
                MenuItem("显示窗口", lambda: self.root.after(0, self._show_window), default=True),
                MenuItem("打开控制台", lambda: self._open_console()),
                Menu.SEPARATOR,
                MenuItem("退出", lambda: self.root.after(0, self._quit)),
            )

            self.tray_icon = pystray.Icon("dataops", image, "数据运维工作台", menu)
            self.tray_icon.run()
        except ImportError:
            # pystray not available — skip tray
            pass
        except Exception:
            pass

    def run(self):
        self._build_window()

        # Status checker thread
        checker = threading.Thread(target=self._check_status, daemon=True)
        checker.start()

        # System tray thread
        tray_thread = threading.Thread(target=self._start_tray, daemon=True)
        tray_thread.start()

        # Auto-start service
        self.root.after(500, self.start_service)

        self.root.mainloop()


if __name__ == "__main__":
    app = DataOpsLauncher()
    app.run()
