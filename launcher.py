#!/usr/bin/env python3
"""
数据运维工作台 - Windows 图形启动器
tkinter 主窗口 + pystray 系统托盘

v3.4.2: CI 编译改为 --standalone 模式（不再用 --onefile），
        减少在用户机器上因缺少 VC++ Runtime 等依赖导致的启动失败。
        如果 standalone 也不稳定，start.bat 为主启动方式。
"""

import os
import sys
import signal
import subprocess
import threading
import webbrowser
import json
import tkinter as tk
from tkinter import ttk, messagebox
from urllib.request import urlopen, Request
from urllib.error import URLError

CURRENT_VERSION = "3.8.0"
PORT = 8580
URL = f"http://localhost:{PORT}"

# ── 定位可执行文件 ──────────────────────────────────────────────
def _find_server_bin():
    """自动检测 dataops-server 可执行文件路径"""
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.abspath(__file__))

    candidates = [
        os.path.join(base, "server", "app", "dataops-server.exe"),
        os.path.join(base, "server", "app", "dataops-server"),
        os.path.join(base, "dataops-server.exe"),
        os.path.join(base, "dataops-server"),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return None


# ── 托盘图标（纯代码生成，不依赖外部图片）──────────────────────
def _create_icon_image(size=64):
    """用 Pillow 生成一个简单的蓝色圆形图标"""
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([2, 2, size - 2, size - 2], fill=(52, 120, 246), outline=(30, 80, 200), width=2)
    # 中间白色 "D" 字
    try:
        from PIL import ImageFont
        font = ImageFont.truetype("arial.ttf", size // 2)
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), "D", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]), "D", fill="white", font=font)
    return img


# ── 版本在线检测 ────────────────────────────────────────────────
GITHUB_RELEASES_API = "https://api.github.com/repos/dalimaoya/data-ops-workbench-pro/releases/latest"
GITHUB_RELEASES_PAGE = "https://github.com/dalimaoya/data-ops-workbench-pro/releases/latest"


def _parse_version(v: str):
    """Parse version string into a tuple of ints for comparison."""
    parts = []
    for p in v.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    return tuple(parts)


def _check_update(current_version, callback):
    """后台线程检查 GitHub Releases 最新版本，仅当远程版本大于本地版本时提示"""
    def _worker():
        try:
            req = Request(GITHUB_RELEASES_API, headers={"Accept": "application/vnd.github.v3+json",
                                                         "User-Agent": "DataOpsWorkbench"})
            with urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            tag = data.get("tag_name", "")
            latest = tag.lstrip("vV")
            if latest and _parse_version(latest) > _parse_version(current_version):
                callback(latest)
        except Exception:
            pass  # 无网络 / API 不可达 → 静默跳过
    threading.Thread(target=_worker, daemon=True).start()


# ══════════════════════════════════════════════════════════════════
class LauncherApp:
    def __init__(self):
        self.process = None
        self.tray_icon = None
        self.running = False

        self.server_bin = _find_server_bin()

        # ── tkinter 主窗口 ──
        self.root = tk.Tk()
        self.root.title("数据运维工作台")
        self.root.geometry("420x320")
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        self._build_ui()
        self._start_tray()
        self._check_for_update()

    # ── 版本检测回调 ────────────────────────────────────────────
    def _check_for_update(self):
        """启动后台线程检测新版本，有新版本时弹窗提示。"""
        def _on_new_version(latest: str):
            self.root.after(0, lambda: self._show_update_dialog(latest))
        _check_update(CURRENT_VERSION, _on_new_version)

    def _show_update_dialog(self, latest: str):
        """弹窗提示用户发现新版本。"""
        if messagebox.askyesno("发现新版本", f"发现新版本 v{latest}，是否前往下载？"):
            webbrowser.open(GITHUB_RELEASES_PAGE)

    # ── UI 布局 ──────────────────────────────────────────────────
    def _build_ui(self):
        root = self.root
        root.configure(bg="#f5f7fa")

        # 标题
        title_frame = tk.Frame(root, bg="#3478f6", height=60)
        title_frame.pack(fill=tk.X)
        title_frame.pack_propagate(False)
        tk.Label(title_frame, text="数据运维工作台", font=("Microsoft YaHei", 16, "bold"),
                 fg="white", bg="#3478f6").pack(pady=14)

        # 信息区
        info_frame = tk.Frame(root, bg="#f5f7fa", padx=24, pady=16)
        info_frame.pack(fill=tk.X)

        tk.Label(info_frame, text=f"版本：v{CURRENT_VERSION}", font=("Microsoft YaHei", 10),
                 bg="#f5f7fa", fg="#555").grid(row=0, column=0, sticky="w", pady=2)

        tk.Label(info_frame, text="服务状态：", font=("Microsoft YaHei", 10),
                 bg="#f5f7fa", fg="#555").grid(row=1, column=0, sticky="w", pady=2)
        self.status_label = tk.Label(info_frame, text="已停止", font=("Microsoft YaHei", 10, "bold"),
                                     bg="#f5f7fa", fg="#e74c3c")
        self.status_label.grid(row=1, column=1, sticky="w", pady=2)

        tk.Label(info_frame, text=f"地址：{URL}", font=("Microsoft YaHei", 10),
                 bg="#f5f7fa", fg="#555").grid(row=2, column=0, columnspan=2, sticky="w", pady=2)

        if not self.server_bin:
            tk.Label(info_frame, text="⚠ 未找到 dataops-server，请检查目录结构",
                     font=("Microsoft YaHei", 9), bg="#f5f7fa", fg="#e67e22").grid(
                row=3, column=0, columnspan=2, sticky="w", pady=4)

        # 按钮区
        btn_frame = tk.Frame(root, bg="#f5f7fa", padx=24, pady=8)
        btn_frame.pack(fill=tk.X)

        style = ttk.Style()
        style.configure("Action.TButton", font=("Microsoft YaHei", 10), padding=8)

        self.toggle_btn = ttk.Button(btn_frame, text="启动服务", style="Action.TButton",
                                     command=self._toggle_service)
        self.toggle_btn.pack(fill=tk.X, pady=4)

        ttk.Button(btn_frame, text="打开控制台", style="Action.TButton",
                   command=lambda: webbrowser.open(URL)).pack(fill=tk.X, pady=4)

        # 底部状态栏
        footer = tk.Frame(root, bg="#eee", height=28)
        footer.pack(fill=tk.X, side=tk.BOTTOM)
        footer.pack_propagate(False)
        tk.Label(footer, text="关闭窗口 → 最小化到托盘  |  托盘右键 → 完全退出",
                 font=("Microsoft YaHei", 8), bg="#eee", fg="#999").pack(pady=4)

    # ── 端口占用检测 ───────────────────────────────────────────────
    def _kill_port_occupier(self):
        """检测并终止占用 PORT 的旧进程"""
        if sys.platform != "win32":
            return
        try:
            result = subprocess.run(
                ["netstat", "-aon"],
                capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.splitlines():
                if f":{PORT} " in line and "LISTENING" in line:
                    parts = line.strip().split()
                    pid = parts[-1]
                    if pid.isdigit() and int(pid) > 0:
                        try:
                            subprocess.run(["taskkill", "/F", "/PID", pid],
                                           capture_output=True, timeout=5)
                        except Exception:
                            pass
        except Exception:
            pass

    # ── 健康检查 + 自动打开浏览器 ────────────────────────────────
    def _wait_and_open_browser(self):
        """轮询健康检查，通过后自动打开浏览器"""
        import time
        max_wait = 60
        waited = 0
        while waited < max_wait:
            try:
                req = Request(f"{URL}/api/health", headers={"User-Agent": "DataOpsLauncher"})
                with urlopen(req, timeout=2) as resp:
                    if resp.status == 200:
                        # 健康检查通过
                        webbrowser.open(URL)
                        self.root.after(0, lambda: self.status_label.config(text="运行中 ✓", fg="#27ae60"))
                        return
            except Exception:
                pass
            time.sleep(2)
            waited += 2
        # 超时也不报错，用户可手动点"打开控制台"

    # ── 服务控制 ─────────────────────────────────────────────────
    def _toggle_service(self):
        if self.running:
            self._stop_service()
        else:
            self._start_service()

    def _start_service(self):
        if not self.server_bin:
            messagebox.showerror("错误", "未找到 dataops-server 可执行文件。\n请确认目录结构正确。")
            return
        if self.running:
            return

        base_dir = os.path.dirname(self.server_bin)
        # 往上两级到发布包根目录
        release_root = os.path.abspath(os.path.join(base_dir, "..", ".."))
        env = os.environ.copy()
        env["DATA_OPS_BASE_DIR"] = release_root
        env["DATA_OPS_DATA_DIR"] = os.path.join(release_root, "data")

        # 确保目录存在
        for d in ("data", "backups", "logs"):
            os.makedirs(os.path.join(release_root, d), exist_ok=True)

        creation_flags = 0
        if sys.platform == "win32":
            creation_flags = subprocess.CREATE_NO_WINDOW

        # 检测端口占用
        self._kill_port_occupier()

        try:
            self.process = subprocess.Popen(
                [self.server_bin, "--port", str(PORT)],
                env=env,
                creationflags=creation_flags,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self.running = True
            self._update_status()
            # 后台线程做健康检查，通过后自动打开浏览器
            threading.Thread(target=self._wait_and_open_browser, daemon=True).start()
        except Exception as e:
            messagebox.showerror("启动失败", str(e))

    def _stop_service(self):
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            except Exception:
                pass
            self.process = None
        self.running = False
        self._update_status()

    def _update_status(self):
        if self.running:
            self.status_label.config(text="运行中", fg="#27ae60")
            self.toggle_btn.config(text="停止服务")
        else:
            self.status_label.config(text="已停止", fg="#e74c3c")
            self.toggle_btn.config(text="启动服务")

    # ── 系统托盘 ─────────────────────────────────────────────────
    def _start_tray(self):
        try:
            import pystray
            icon_image = _create_icon_image()
            menu = pystray.Menu(
                pystray.MenuItem("打开控制台", lambda: webbrowser.open(URL)),
                pystray.MenuItem("显示窗口", self._show_window),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("退出", self._quit_app),
            )
            self.tray_icon = pystray.Icon("dataops", icon_image, "数据运维工作台", menu)
            tray_thread = threading.Thread(target=self.tray_icon.run, daemon=True)
            tray_thread.start()
        except ImportError:
            # 没有 pystray 时退化：关闭窗口直接退出
            self.root.protocol("WM_DELETE_WINDOW", self._quit_app)

    def _on_close(self):
        """关闭窗口 → 隐藏到托盘"""
        if self.tray_icon:
            self.root.withdraw()
        else:
            self._quit_app()

    def _show_window(self, *_args):
        self.root.after(0, self.root.deiconify)

    def _quit_app(self, *_args):
        self._stop_service()
        if self.tray_icon:
            try:
                self.tray_icon.stop()
            except Exception:
                pass
        try:
            self.root.destroy()
        except Exception:
            pass
        os._exit(0)

    # ── 启动主循环 ───────────────────────────────────────────────
    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    app = LauncherApp()
    app.run()
